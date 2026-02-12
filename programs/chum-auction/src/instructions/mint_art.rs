use anchor_lang::prelude::*;
use anchor_lang::system_program;
use mpl_core::instructions::CreateV1CpiBuilder;
use mpl_core::types::{Attribute, Plugin, PluginAuthorityPair, PluginAuthority};
use crate::state::Config;
use crate::errors::ChumError;

#[derive(Accounts)]
pub struct MintArt<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump,
        constraint = !config.paused @ ChumError::SystemPaused,
    )]
    pub config: Account<'info, Config>,

    /// CHECK: Team wallet receives mint fee
    #[account(
        mut,
        constraint = team_wallet.key() == config.team_wallet @ ChumError::Unauthorized,
    )]
    pub team_wallet: UncheckedAccount<'info>,

    /// CHECK: The new NFT asset account (Metaplex Core asset, created by CPI)
    #[account(mut)]
    pub asset: Signer<'info>,

    /// CHECK: The CHUM: ARTWORK collection
    #[account(
        mut,
        constraint = collection.key() == config.collection @ ChumError::WrongCollection,
    )]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: Collection authority PDA signs the CreateV1 CPI
    #[account(
        seeds = [b"collection_auth"],
        bump = config.collection_authority_bump,
    )]
    pub collection_authority: UncheckedAccount<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MintArt>, name: String, uri: String) -> Result<()> {
    require!(name.len() <= 50, ChumError::NameTooLong);
    require!(uri.len() <= 200, ChumError::UriTooLong);

    let config = &mut ctx.accounts.config;

    // Transfer mint_fee to team_wallet
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.team_wallet.to_account_info(),
            },
        ),
        config.mint_fee,
    )?;

    // CPI to Metaplex Core CreateV1
    let bump = config.collection_authority_bump;
    let signer_seeds: &[&[u8]] = &[b"collection_auth", &[bump]];

    CreateV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(Some(&ctx.accounts.collection.to_account_info()))
        .authority(Some(&ctx.accounts.collection_authority.to_account_info()))
        .payer(&ctx.accounts.creator.to_account_info())
        .owner(Some(&ctx.accounts.creator.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(name)
        .uri(uri)
        .plugins(vec![
            PluginAuthorityPair {
                plugin: Plugin::Attributes(mpl_core::types::Attributes {
                    attribute_list: vec![
                        Attribute {
                            key: "Status".to_string(),
                            value: "Artwork".to_string(),
                        },
                    ],
                }),
                authority: Some(PluginAuthority::UpdateAuthority),
            },
        ])
        .invoke_signed(&[signer_seeds])?;

    config.total_minted = config.total_minted
        .checked_add(1)
        .ok_or(ChumError::MathOverflow)?;

    Ok(())
}
