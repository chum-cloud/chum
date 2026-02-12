use anchor_lang::prelude::*;
use anchor_lang::system_program;
use mpl_core::accounts::BaseAssetV1;
use crate::state::{Config, ArtCandidate, ArtEntry, VoteReceipt};
use crate::errors::ChumError;

#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump,
        constraint = !config.paused @ ChumError::SystemPaused,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"candidate", candidate.mint.as_ref()],
        bump = candidate.bump,
        constraint = !candidate.won @ ChumError::AlreadyWon,
        constraint = !candidate.withdrawn @ ChumError::AlreadyWithdrawn,
    )]
    pub candidate: Account<'info, ArtCandidate>,

    /// CHECK: Treasury PDA receives payment (only used for paid votes)
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = config.treasury_bump,
    )]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Unified vote instruction.
/// - `is_paid = true`: pay escalating SOL price for `num_votes` votes
/// - `is_paid = false`: use remaining_accounts for NFT/minter proof (free votes)
pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, Vote<'info>>,
    num_votes: u32,
    is_paid: bool,
) -> Result<()> {
    if is_paid {
        handler_paid(ctx, num_votes)
    } else {
        handler_free(ctx, num_votes)
    }
}

fn handler_paid(ctx: Context<Vote>, num_votes: u32) -> Result<()> {
    require!(num_votes > 0, ChumError::InvalidVoteCount);

    let config = &ctx.accounts.config;
    let candidate = &mut ctx.accounts.candidate;
    let base_price = config.base_vote_price as u128;

    // Calculate total cost with escalating formula
    let mut total_cost: u128 = 0;
    for i in 0..num_votes {
        let current_votes = (candidate.votes as u128)
            .checked_add(i as u128)
            .ok_or(ChumError::MathOverflow)?;
        let tier = current_votes / 10;

        // price = base_vote_price × 3^tier / 2^tier
        let pow3 = 3u128.checked_pow(tier as u32).ok_or(ChumError::MathOverflow)?;
        let pow2 = 2u128.checked_pow(tier as u32).ok_or(ChumError::MathOverflow)?;

        let price = base_price
            .checked_mul(pow3)
            .ok_or(ChumError::MathOverflow)?
            .checked_div(pow2)
            .ok_or(ChumError::MathOverflow)?;

        total_cost = total_cost
            .checked_add(price)
            .ok_or(ChumError::MathOverflow)?;
    }

    let total_cost_u64: u64 = total_cost.try_into().map_err(|_| ChumError::MathOverflow)?;

    // Transfer total_cost to treasury
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.voter.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        total_cost_u64,
    )?;

    candidate.votes = candidate.votes
        .checked_add(num_votes)
        .ok_or(ChumError::MathOverflow)?;

    Ok(())
}

fn handler_free<'info>(
    ctx: Context<'_, '_, 'info, 'info, Vote<'info>>,
    num_votes: u32,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let voter_key = ctx.accounts.voter.key();
    let epoch = config.current_epoch;
    let epoch_bytes = epoch.to_le_bytes();

    let remaining = &ctx.remaining_accounts;
    let mut free_votes: u32 = 0;
    let mut i = 0;

    while i < remaining.len() {
        if i + 1 >= remaining.len() {
            break;
        }

        let proof_account = &remaining[i];
        let receipt_account = &remaining[i + 1];

        // Try to deserialize as Metaplex Core BaseAssetV1
        let asset_result = BaseAssetV1::try_from(proof_account);

        if let Ok(asset) = asset_result {
            // It's an NFT — check owner is voter
            require!(asset.owner == voter_key, ChumError::NotOwner);

            let mint_key = proof_account.key();

            // Check collection: Fellow Villains or Founder Key
            {
                let update_authority = &asset.update_authority;
                match update_authority {
                    mpl_core::types::UpdateAuthority::Collection(coll) => {
                        if *coll == config.fellow_villains_collection {
                            // Fellow Villain — valid
                        } else if *coll == config.collection {
                            // Must be a Founder Key — need ArtEntry proof
                            if i + 2 >= remaining.len() {
                                i += 2;
                                continue;
                            }
                            let art_entry_account = &remaining[i + 2];
                            // Verify ArtEntry PDA
                            let (expected_pda, _) = Pubkey::find_program_address(
                                &[b"art", mint_key.as_ref()],
                                ctx.program_id,
                            );
                            if art_entry_account.key() != expected_pda {
                                i += 3;
                                continue;
                            }
                            let art_entry_data = art_entry_account.try_borrow_data()?;
                            if art_entry_data.len() < 8 + ArtEntry::INIT_SPACE {
                                i += 3;
                                continue;
                            }
                            // Skip 8-byte discriminator, read is_founder_key (offset: 32 + 32 = 64, then bool at 64)
                            let is_founder_key = art_entry_data[8 + 64] != 0;
                            if !is_founder_key {
                                i += 3;
                                continue;
                            }
                            // Consume the extra ArtEntry account
                            i += 1;
                        } else {
                            i += 2;
                            continue;
                        }
                    }
                    _ => {
                        i += 2;
                        continue;
                    }
                }
            }

            // Create VoteReceipt PDA — if it already exists, skip
            let (receipt_pda, receipt_bump) = Pubkey::find_program_address(
                &[b"voted", mint_key.as_ref(), &epoch_bytes],
                ctx.program_id,
            );
            if receipt_account.key() != receipt_pda {
                i += 2;
                continue;
            }

            // Check if already initialized (has data)
            if receipt_account.data_len() > 0 && receipt_account.lamports() > 0 {
                // Already voted with this NFT this epoch — skip
                i += 2;
                continue;
            }

            // Init the VoteReceipt account
            let space = 8 + VoteReceipt::INIT_SPACE;
            let rent = Rent::get()?;
            let lamports = rent.minimum_balance(space);

            anchor_lang::system_program::create_account(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::CreateAccount {
                        from: ctx.accounts.voter.to_account_info(),
                        to: receipt_account.to_account_info(),
                    },
                ).with_signer(&[&[b"voted", mint_key.as_ref(), &epoch_bytes, &[receipt_bump]]]),
                lamports,
                space as u64,
                ctx.program_id,
            )?;

            // Write VoteReceipt data
            let mut data = receipt_account.try_borrow_mut_data()?;
            let disc = VoteReceipt::DISCRIMINATOR;
            data[..8].copy_from_slice(&disc);
            data[8..40].copy_from_slice(mint_key.as_ref());
            data[40..48].copy_from_slice(&epoch.to_le_bytes());
            data[48..80].copy_from_slice(voter_key.as_ref());
            data[80] = receipt_bump;

            free_votes = free_votes.checked_add(1).ok_or(ChumError::MathOverflow)?;
            i += 2;
        } else {
            // Try ArtCandidate (minter proof)
            let candidate_data = proof_account.try_borrow_data()?;
            if candidate_data.len() >= 8 + ArtCandidate::INIT_SPACE {
                let disc = &candidate_data[..8];
                let expected_disc = ArtCandidate::DISCRIMINATOR;
                if disc == expected_disc {
                    // Parse fields manually
                    let mint_bytes: [u8; 32] = candidate_data[8..40].try_into().unwrap();
                    let creator_bytes: [u8; 32] = candidate_data[40..72].try_into().unwrap();
                    let candidate_mint = Pubkey::from(mint_bytes);
                    let candidate_creator = Pubkey::from(creator_bytes);
                    // won at offset 8+32+32+4+8 = 84
                    let won = candidate_data[84] != 0;
                    // withdrawn at offset 85
                    let withdrawn = candidate_data[85] != 0;

                    if candidate_creator == voter_key && !won && !withdrawn {
                        let mint_key = candidate_mint;
                        let (receipt_pda, receipt_bump) = Pubkey::find_program_address(
                            &[b"voted", mint_key.as_ref(), &epoch_bytes],
                            ctx.program_id,
                        );

                        drop(candidate_data);

                        if receipt_account.key() == receipt_pda
                            && (receipt_account.data_len() == 0 || receipt_account.lamports() == 0)
                        {
                            let space = 8 + VoteReceipt::INIT_SPACE;
                            let rent = Rent::get()?;
                            let lamports = rent.minimum_balance(space);

                            anchor_lang::system_program::create_account(
                                CpiContext::new(
                                    ctx.accounts.system_program.to_account_info(),
                                    anchor_lang::system_program::CreateAccount {
                                        from: ctx.accounts.voter.to_account_info(),
                                        to: receipt_account.to_account_info(),
                                    },
                                ).with_signer(&[&[b"voted", mint_key.as_ref(), &epoch_bytes, &[receipt_bump]]]),
                                lamports,
                                space as u64,
                                ctx.program_id,
                            )?;

                            let mut data = receipt_account.try_borrow_mut_data()?;
                            let disc = VoteReceipt::DISCRIMINATOR;
                            data[..8].copy_from_slice(&disc);
                            data[8..40].copy_from_slice(mint_key.as_ref());
                            data[40..48].copy_from_slice(&epoch.to_le_bytes());
                            data[48..80].copy_from_slice(voter_key.as_ref());
                            data[80] = receipt_bump;

                            free_votes = free_votes.checked_add(1).ok_or(ChumError::MathOverflow)?;
                        }
                    } else {
                        drop(candidate_data);
                    }
                } else {
                    drop(candidate_data);
                }
            } else {
                drop(candidate_data);
            }
            i += 2;
        }
    }

    // Clamp num_votes to available free votes
    let actual_votes = if num_votes == 0 {
        1u32.min(free_votes)
    } else {
        num_votes.min(free_votes)
    };

    if actual_votes > 0 {
        ctx.accounts.candidate.votes = ctx.accounts.candidate.votes
            .checked_add(actual_votes)
            .ok_or(ChumError::MathOverflow)?;
    }

    Ok(())
}
