import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { ChumAuction } from "../target/types/chum_auction";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { expect } from "chai";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore, createCollectionV1 } from "@metaplex-foundation/mpl-core";
import { generateSigner, keypairIdentity } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";

const MPL_CORE_PROGRAM_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

// Helper: create a Metaplex Core collection using UMI
async function createCollection(
  connection: anchor.web3.Connection,
  payer: Keypair,
  name: string,
  uri: string,
  updateAuthority?: PublicKey
): Promise<Keypair> {
  const umi = createUmi("https://api.devnet.solana.com").use(mplCore());
  umi.use(keypairIdentity(fromWeb3JsKeypair(payer)));

  const collectionSigner = generateSigner(umi);

  const builder = createCollectionV1(umi, {
    collection: collectionSigner,
    name,
    uri,
    ...(updateAuthority ? { updateAuthority: fromWeb3JsPublicKey(updateAuthority) } : {}),
  });

  await builder.sendAndConfirm(umi);

  // Return a Keypair-like object with the public key
  const pubkey = toWeb3JsPublicKey(collectionSigner.publicKey);
  // We need to return a Keypair for compatibility, but we only need .publicKey
  const fakeKeypair = Keypair.generate();
  Object.defineProperty(fakeKeypair, 'publicKey', { value: pubkey });
  return fakeKeypair;
}

// Derive PDAs
function findConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
}

function findTreasuryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    programId
  );
}

function findArtVaultPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("art_vault")],
    programId
  );
}

function findCollectionAuthPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collection_auth")],
    programId
  );
}

function findCandidatePda(
  mint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("candidate"), mint.toBuffer()],
    programId
  );
}

function findEpochStatePda(
  epoch: BN,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("epoch"), epoch.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

function findAuctionPda(
  epoch: BN,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("auction"), epoch.toArrayLike(Buffer, "le", 8)],
    programId
  );
}

function findArtEntryPda(
  mint: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("art"), mint.toBuffer()],
    programId
  );
}

function findVoteReceiptPda(
  mint: PublicKey,
  epoch: BN,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("voted"),
      mint.toBuffer(),
      epoch.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("CHUM Art Auction", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ChumAuction as Program<ChumAuction>;
  const connection = provider.connection;
  const authority = (provider.wallet as anchor.Wallet).payer;

  const programId = program.programId;
  const [configPda] = findConfigPda(programId);
  const [treasuryPda] = findTreasuryPda(programId);
  const [artVaultPda] = findArtVaultPda(programId);
  const [collectionAuthPda] = findCollectionAuthPda(programId);

  // Test config
  const MINT_FEE = new BN(15_000_000); // 0.015 SOL
  const JOIN_FEE = new BN(15_000_000);
  const BASE_VOTE_PRICE = new BN(2_000_000); // 0.002 SOL
  const EPOCH_DURATION = new BN(5); // 5 seconds for testing
  const AUCTION_DURATION = new BN(3); // 3 seconds for testing
  const RESERVE_BID = new BN(200_000_000); // 0.2 SOL

  let collectionKeypair: Keypair;
  let fellowVillainsCollection: Keypair;
  let teamWallet: Keypair;

  // Track minted assets
  let art1Keypair: Keypair;
  let art2Keypair: Keypair;
  let art3Keypair: Keypair;

  // Second wallet
  let wallet2: Keypair;

  before(async () => {
    teamWallet = Keypair.generate();

    fellowVillainsCollection = await createCollection(
      connection,
      authority,
      "CHUM: Fellow Villains",
      "https://example.com/fv"
    );
    console.log(
      "Fellow Villains collection:",
      fellowVillainsCollection.publicKey.toBase58()
    );

    collectionKeypair = await createCollection(
      connection,
      authority,
      "CHUM: ARTWORK",
      "https://example.com/artwork",
      collectionAuthPda
    );
    console.log(
      "CHUM: ARTWORK collection:",
      collectionKeypair.publicKey.toBase58()
    );

    wallet2 = Keypair.generate();
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: authority.publicKey,
        toPubkey: wallet2.publicKey,
        lamports: 0.5 * LAMPORTS_PER_SOL,
      })
    );
    await sendAndConfirmTransaction(connection, tx, [authority], {
      commitment: "confirmed",
    });
    console.log("Wallet 2:", wallet2.publicKey.toBase58());
  });

  // ============================================================
  // Test 1: Initialize
  // ============================================================
  it("Test 1: Initialize", async () => {
    const tx = await program.methods
      .initialize(
        teamWallet.publicKey,
        collectionKeypair.publicKey,
        fellowVillainsCollection.publicKey,
        MINT_FEE,
        JOIN_FEE,
        BASE_VOTE_PRICE,
        EPOCH_DURATION,
        AUCTION_DURATION,
        RESERVE_BID
      )
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        treasury: treasuryPda,
        artVault: artVaultPda,
        collectionAuthority: collectionAuthPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Initialize tx:", tx);

    const config = await program.account.config.fetch(configPda);
    expect(config.authority.toBase58()).to.equal(
      authority.publicKey.toBase58()
    );
    expect(config.teamWallet.toBase58()).to.equal(
      teamWallet.publicKey.toBase58()
    );
    expect(config.collection.toBase58()).to.equal(
      collectionKeypair.publicKey.toBase58()
    );
    expect(config.fellowVillainsCollection.toBase58()).to.equal(
      fellowVillainsCollection.publicKey.toBase58()
    );
    expect(config.mintFee.toNumber()).to.equal(MINT_FEE.toNumber());
    expect(config.joinFee.toNumber()).to.equal(JOIN_FEE.toNumber());
    expect(config.baseVotePrice.toNumber()).to.equal(
      BASE_VOTE_PRICE.toNumber()
    );
    expect(config.currentEpoch.toNumber()).to.equal(1);
    expect(config.epochDuration.toNumber()).to.equal(
      EPOCH_DURATION.toNumber()
    );
    expect(config.auctionDuration.toNumber()).to.equal(
      AUCTION_DURATION.toNumber()
    );
    expect(config.reserveBid.toNumber()).to.equal(RESERVE_BID.toNumber());
    expect(config.totalMinted.toNumber()).to.equal(0);
    expect(config.totalFounderKeys.toNumber()).to.equal(0);
    expect(config.paused).to.equal(false);

    console.log("✅ Config initialized successfully");
  });

  // ============================================================
  // Test 2: Mint Art
  // ============================================================
  it("Test 2: Mint Art", async () => {
    art1Keypair = Keypair.generate();

    const teamWalletBalBefore = await connection.getBalance(
      teamWallet.publicKey
    );

    const tx = await program.methods
      .mintArt("CHUM: Reanimated #0001", "https://arweave.net/test1")
      .accounts({
        creator: authority.publicKey,
        config: configPda,
        teamWallet: teamWallet.publicKey,
        asset: art1Keypair.publicKey,
        collection: collectionKeypair.publicKey,
        collectionAuthority: collectionAuthPda,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([art1Keypair])
      .rpc({ commitment: "confirmed" });

    console.log("Mint art tx:", tx);

    const teamWalletBalAfter = await connection.getBalance(
      teamWallet.publicKey
    );
    expect(teamWalletBalAfter - teamWalletBalBefore).to.equal(
      MINT_FEE.toNumber()
    );

    const config = await program.account.config.fetch(configPda);
    expect(config.totalMinted.toNumber()).to.equal(1);

    const assetInfo = await connection.getAccountInfo(art1Keypair.publicKey);
    expect(assetInfo).to.not.be.null;

    console.log("✅ Art minted, fee went to team wallet");
  });

  // ============================================================
  // Test 3: Join Voting
  // ============================================================
  it("Test 3: Join Voting", async () => {
    const [candidatePda] = findCandidatePda(art1Keypair.publicKey, programId);
    const treasuryBalBefore = await connection.getBalance(treasuryPda);

    const tx = await program.methods
      .joinVoting()
      .accounts({
        creator: authority.publicKey,
        config: configPda,
        treasury: treasuryPda,
        artVault: artVaultPda,
        candidate: candidatePda,
        asset: art1Keypair.publicKey,
        collection: collectionKeypair.publicKey,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Join voting tx:", tx);

    const treasuryBalAfter = await connection.getBalance(treasuryPda);
    expect(treasuryBalAfter - treasuryBalBefore).to.equal(
      JOIN_FEE.toNumber()
    );

    const candidate = await program.account.artCandidate.fetch(candidatePda);
    expect(candidate.mint.toBase58()).to.equal(
      art1Keypair.publicKey.toBase58()
    );
    expect(candidate.creator.toBase58()).to.equal(
      authority.publicKey.toBase58()
    );
    expect(candidate.votes).to.equal(0);
    expect(candidate.epochJoined.toNumber()).to.equal(1);
    expect(candidate.won).to.equal(false);
    expect(candidate.withdrawn).to.equal(false);

    console.log("✅ Joined voting, fee went to treasury");
  });

  // ============================================================
  // Test 4: Mint + Join with second wallet
  // ============================================================
  it("Test 4: Mint + Join with second wallet", async () => {
    art2Keypair = Keypair.generate();

    const tx1 = await program.methods
      .mintArt("CHUM: Reanimated #0002", "https://arweave.net/test2")
      .accounts({
        creator: wallet2.publicKey,
        config: configPda,
        teamWallet: teamWallet.publicKey,
        asset: art2Keypair.publicKey,
        collection: collectionKeypair.publicKey,
        collectionAuthority: collectionAuthPda,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet2, art2Keypair])
      .rpc({ commitment: "confirmed" });

    console.log("Mint art2 tx:", tx1);

    const [candidatePda2] = findCandidatePda(art2Keypair.publicKey, programId);

    const tx2 = await program.methods
      .joinVoting()
      .accounts({
        creator: wallet2.publicKey,
        config: configPda,
        treasury: treasuryPda,
        artVault: artVaultPda,
        candidate: candidatePda2,
        asset: art2Keypair.publicKey,
        collection: collectionKeypair.publicKey,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet2])
      .rpc({ commitment: "confirmed" });

    console.log("Join voting2 tx:", tx2);

    const config = await program.account.config.fetch(configPda);
    expect(config.totalMinted.toNumber()).to.equal(2);

    const candidate = await program.account.artCandidate.fetch(candidatePda2);
    expect(candidate.creator.toBase58()).to.equal(
      wallet2.publicKey.toBase58()
    );

    console.log("✅ Second wallet minted and joined");
  });

  // ============================================================
  // Test 5: Vote Paid on first candidate (using merged vote instruction)
  // ============================================================
  it("Test 5: Vote Paid (5 votes on first candidate)", async () => {
    const [candidatePda] = findCandidatePda(art1Keypair.publicKey, programId);
    const treasuryBalBefore = await connection.getBalance(treasuryPda);

    const tx = await program.methods
      .vote(5, true)
      .accounts({
        voter: authority.publicKey,
        config: configPda,
        candidate: candidatePda,
        treasury: treasuryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Vote paid tx:", tx);

    const candidate = await program.account.artCandidate.fetch(candidatePda);
    expect(candidate.votes).to.equal(5);

    const treasuryBalAfter = await connection.getBalance(treasuryPda);
    const paid = treasuryBalAfter - treasuryBalBefore;
    expect(paid).to.equal(5 * BASE_VOTE_PRICE.toNumber());
    console.log(`✅ Paid ${paid / LAMPORTS_PER_SOL} SOL for 5 votes`);
  });

  // ============================================================
  // Test 6: Vote Paid on second candidate
  // ============================================================
  it("Test 6: Vote Paid on second candidate (2 votes)", async () => {
    const [candidatePda2] = findCandidatePda(art2Keypair.publicKey, programId);

    const tx = await program.methods
      .vote(2, true)
      .accounts({
        voter: authority.publicKey,
        config: configPda,
        candidate: candidatePda2,
        treasury: treasuryPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Vote paid on candidate 2 tx:", tx);

    const candidate = await program.account.artCandidate.fetch(candidatePda2);
    expect(candidate.votes).to.equal(2);

    console.log("✅ Voted on second candidate");
  });

  // ============================================================
  // Test 7: End Epoch (now also starts auction)
  // ============================================================
  it("Test 7: End Epoch (includes auction start)", async () => {
    // Wait for epoch duration
    console.log("Waiting for epoch to end (5s)...");
    await sleep(6000);

    // Fund treasury with enough SOL for reserve bid
    const treasuryBal = await connection.getBalance(treasuryPda);
    const needed = RESERVE_BID.toNumber() + 10_000_000 - treasuryBal;
    if (needed > 0) {
      const fundTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: treasuryPda,
          lamports: needed,
        })
      );
      await sendAndConfirmTransaction(connection, fundTx, [authority], {
        commitment: "confirmed",
      });
      console.log(`Funded treasury with ${needed / LAMPORTS_PER_SOL} SOL`);
    }

    const [candidatePda1] = findCandidatePda(art1Keypair.publicKey, programId);
    const configBefore = await program.account.config.fetch(configPda);
    const currentEpoch = configBefore.currentEpoch;
    const [epochStatePda] = findEpochStatePda(currentEpoch, programId);
    const [auctionPda] = findAuctionPda(currentEpoch, programId);
    const candidate = await program.account.artCandidate.fetch(candidatePda1);

    const tx = await program.methods
      .endEpoch()
      .accounts({
        authority: authority.publicKey,
        config: configPda,
        winningCandidate: candidatePda1,
        epochState: epochStatePda,
        treasury: treasuryPda,
        artVault: artVaultPda,
        asset: art1Keypair.publicKey,
        collection: collectionKeypair.publicKey,
        creator: candidate.creator,
        auction: auctionPda,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log("End epoch tx:", tx);

    // Verify epoch state
    const epochState = await program.account.epochState.fetch(epochStatePda);
    expect(epochState.epoch.toNumber()).to.equal(currentEpoch.toNumber());
    expect(epochState.winnerMint.toBase58()).to.equal(
      art1Keypair.publicKey.toBase58()
    );
    expect(epochState.finalized).to.equal(true);
    expect(epochState.auctionStarted).to.equal(true);

    // Verify candidate marked as won
    const candidateAfter = await program.account.artCandidate.fetch(candidatePda1);
    expect(candidateAfter.won).to.equal(true);

    // Verify epoch advanced
    const configAfter = await program.account.config.fetch(configPda);
    expect(configAfter.currentEpoch.toNumber()).to.equal(
      currentEpoch.toNumber() + 1
    );

    // Verify auction created
    const auction = await program.account.auction.fetch(auctionPda);
    expect(auction.epoch.toNumber()).to.equal(currentEpoch.toNumber());
    expect(auction.artMint.toBase58()).to.equal(
      art1Keypair.publicKey.toBase58()
    );
    expect(auction.reserveBid.toNumber()).to.equal(RESERVE_BID.toNumber());
    expect(auction.settled).to.equal(false);

    console.log("✅ Epoch ended, winner selected, auction started");
  });

  // ============================================================
  // Test 8: Place Bid
  // ============================================================
  it("Test 8: Place Bid (0.21 SOL)", async () => {
    const epoch = new BN(1);
    const [auctionPda] = findAuctionPda(epoch, programId);
    const bidAmount = new BN(210_000_000); // 0.21 SOL

    const tx = await program.methods
      .placeBid(epoch, bidAmount)
      .accounts({
        bidder: authority.publicKey,
        auction: auctionPda,
        treasury: treasuryPda,
        previousBidder: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Place bid tx:", tx);

    const auction = await program.account.auction.fetch(auctionPda);
    expect(auction.currentBid.toNumber()).to.equal(bidAmount.toNumber());
    expect(auction.currentBidder.toBase58()).to.equal(
      authority.publicKey.toBase58()
    );
    expect(auction.bidCount).to.equal(1);

    console.log("✅ Bid placed at 0.21 SOL");
  });

  // ============================================================
  // Test 9: Place Higher Bid
  // ============================================================
  it("Test 9: Place Higher Bid (wallet2 bids 0.22 SOL)", async () => {
    const epoch = new BN(1);
    const [auctionPda] = findAuctionPda(epoch, programId);
    const bidAmount = new BN(220_000_000); // 0.22 SOL

    const authorityBalBefore = await connection.getBalance(
      authority.publicKey
    );

    const tx = await program.methods
      .placeBid(epoch, bidAmount)
      .accounts({
        bidder: wallet2.publicKey,
        auction: auctionPda,
        treasury: treasuryPda,
        previousBidder: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet2])
      .rpc({ commitment: "confirmed" });

    console.log("Higher bid tx:", tx);

    const auction = await program.account.auction.fetch(auctionPda);
    expect(auction.currentBid.toNumber()).to.equal(bidAmount.toNumber());
    expect(auction.currentBidder.toBase58()).to.equal(
      wallet2.publicKey.toBase58()
    );
    expect(auction.bidCount).to.equal(2);

    const authorityBalAfter = await connection.getBalance(
      authority.publicKey
    );
    expect(authorityBalAfter - authorityBalBefore).to.equal(210_000_000);

    console.log("✅ Higher bid placed, previous bidder refunded");
  });

  // ============================================================
  // Test 10: Settle Auction
  // ============================================================
  it("Test 10: Settle Auction", async () => {
    console.log("Waiting for auction to end (3s)...");
    await sleep(4000);

    const epoch = new BN(1);
    const [auctionPda] = findAuctionPda(epoch, programId);
    const [candidatePda1] = findCandidatePda(art1Keypair.publicKey, programId);
    const [artEntryPda] = findArtEntryPda(art1Keypair.publicKey, programId);
    const candidate = await program.account.artCandidate.fetch(candidatePda1);

    const creatorBalBefore = await connection.getBalance(candidate.creator);
    const configBefore = await program.account.config.fetch(configPda);

    const tx = await program.methods
      .settleAuction(epoch)
      .accounts({
        payer: authority.publicKey,
        config: configPda,
        auction: auctionPda,
        candidate: candidatePda1,
        treasury: treasuryPda,
        artVault: artVaultPda,
        collectionAuthority: collectionAuthPda,
        asset: art1Keypair.publicKey,
        collection: collectionKeypair.publicKey,
        winner: wallet2.publicKey,
        creator: candidate.creator,
        artEntry: artEntryPda,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    console.log("Settle auction tx:", tx);

    const auction = await program.account.auction.fetch(auctionPda);
    expect(auction.settled).to.equal(true);

    const artEntry = await program.account.artEntry.fetch(artEntryPda);
    expect(artEntry.isFounderKey).to.equal(true);
    expect(artEntry.epochWon.toNumber()).to.equal(1);
    expect(artEntry.creator.toBase58()).to.equal(
      candidate.creator.toBase58()
    );

    const creatorBalAfter = await connection.getBalance(candidate.creator);
    const creatorShare = Math.floor(220_000_000 * 60 / 100);
    expect(creatorBalAfter - creatorBalBefore).to.equal(creatorShare);

    const configAfter = await program.account.config.fetch(configPda);
    expect(configAfter.totalFounderKeys.toNumber()).to.equal(
      configBefore.totalFounderKeys.toNumber() + 1
    );

    console.log("✅ Auction settled, creator got 60%, Founder Key created");
  });

  // ============================================================
  // Test 11: Double Vote Prevention (vote free with minter proof)
  // ============================================================
  it("Test 11: Double Vote Prevention", async () => {
    art3Keypair = Keypair.generate();

    await program.methods
      .mintArt("CHUM: Reanimated #0003", "https://arweave.net/test3")
      .accounts({
        creator: authority.publicKey,
        config: configPda,
        teamWallet: teamWallet.publicKey,
        asset: art3Keypair.publicKey,
        collection: collectionKeypair.publicKey,
        collectionAuthority: collectionAuthPda,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([art3Keypair])
      .rpc({ commitment: "confirmed" });

    const [candidatePda3] = findCandidatePda(art3Keypair.publicKey, programId);

    await program.methods
      .joinVoting()
      .accounts({
        creator: authority.publicKey,
        config: configPda,
        treasury: treasuryPda,
        artVault: artVaultPda,
        candidate: candidatePda3,
        asset: art3Keypair.publicKey,
        collection: collectionKeypair.publicKey,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });

    const config = await program.account.config.fetch(configPda);
    const epoch = config.currentEpoch;
    const [voteReceiptPda] = findVoteReceiptPda(
      art3Keypair.publicKey,
      epoch,
      programId
    );

    // First free vote should succeed
    await program.methods
      .vote(1, false)
      .accounts({
        voter: authority.publicKey,
        config: configPda,
        candidate: candidatePda3,
        treasury: treasuryPda,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([
        {
          pubkey: candidatePda3,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: voteReceiptPda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .rpc({ commitment: "confirmed" });

    const candidateAfter1 = await program.account.artCandidate.fetch(
      candidatePda3
    );
    const votesAfterFirst = candidateAfter1.votes;
    console.log("Votes after first free vote:", votesAfterFirst);

    // Second vote with same proof — VoteReceipt exists, should NOT add votes
    await program.methods
      .vote(1, false)
      .accounts({
        voter: authority.publicKey,
        config: configPda,
        candidate: candidatePda3,
        treasury: treasuryPda,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([
        {
          pubkey: candidatePda3,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: voteReceiptPda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .rpc({ commitment: "confirmed" });

    const candidateAfter2 = await program.account.artCandidate.fetch(
      candidatePda3
    );
    expect(candidateAfter2.votes).to.equal(votesAfterFirst);

    console.log("✅ Double vote prevented (VoteReceipt already exists)");
  });

  // ============================================================
  // Test 12: Update Config
  // ============================================================
  it("Test 12: Update Config", async () => {
    const configBefore = await program.account.config.fetch(configPda);

    const newAuctionDuration = new BN(10);

    await program.methods
      .updateConfig(
        null,
        null,
        null,
        null,
        newAuctionDuration,
        null,
        null,
        null
      )
      .accounts({
        authority: authority.publicKey,
        config: configPda,
      })
      .rpc({ commitment: "confirmed" });

    const configAfter = await program.account.config.fetch(configPda);
    expect(configAfter.auctionDuration.toNumber()).to.equal(10);
    expect(configAfter.mintFee.toNumber()).to.equal(
      configBefore.mintFee.toNumber()
    );
    expect(configAfter.epochDuration.toNumber()).to.equal(
      configBefore.epochDuration.toNumber()
    );

    // Restore original value
    await program.methods
      .updateConfig(
        null,
        null,
        null,
        null,
        AUCTION_DURATION,
        null,
        null,
        null
      )
      .accounts({
        authority: authority.publicKey,
        config: configPda,
      })
      .rpc({ commitment: "confirmed" });

    console.log("✅ Config updated and restored");
  });
});
