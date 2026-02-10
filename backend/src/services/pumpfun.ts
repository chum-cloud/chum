/**
 * PumpFun token creation via PumpPortal API
 * 
 * Flow:
 * 1. Upload metadata (name, symbol, desc, image) to pump.fun IPFS
 * 2. Build create transaction via pumpportal.fun/api/trade-local
 * 3. Return unsigned transaction for agent to sign
 * 
 * The agent signs client-side with their keypair + a generated mint keypair.
 * We never touch private keys.
 */

import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const PUMPPORTAL_API = 'https://pumpportal.fun/api';
const PUMPFUN_IPFS = 'https://pump.fun/api/ipfs';

interface CreateTokenParams {
  creatorWallet: string;
  name: string;
  symbol: string;
  description: string;
  imageBase64?: string;     // base64 encoded image
  imageUrl?: string;        // OR a URL to fetch
  twitter?: string;
  telegram?: string;
  website?: string;
  devBuyAmount?: number;    // tokens to buy on creation (0 = no dev buy)
  slippage?: number;
  priorityFee?: number;
}

interface CreateTokenResult {
  success: boolean;
  mintAddress?: string;
  mintSecretKey?: string;   // base58 encoded — agent needs this to sign
  transaction?: string;     // base58 encoded unsigned tx
  metadataUri?: string;
  error?: string;
}

/**
 * Step 1: Upload token metadata to pump.fun IPFS
 */
async function uploadMetadata(params: {
  name: string;
  symbol: string;
  description: string;
  imageBase64?: string;
  imageUrl?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}): Promise<{ metadataUri: string } | { error: string }> {
  try {
    const formData = new FormData();
    formData.append('name', params.name);
    formData.append('symbol', params.symbol);
    formData.append('description', params.description);
    formData.append('showName', 'true');

    if (params.twitter) formData.append('twitter', params.twitter);
    if (params.telegram) formData.append('telegram', params.telegram);
    if (params.website) formData.append('website', params.website);

    // Handle image
    if (params.imageBase64) {
      const buffer = Buffer.from(params.imageBase64, 'base64');
      const blob = new Blob([buffer], { type: 'image/png' });
      formData.append('file', blob, 'token.png');
    } else if (params.imageUrl) {
      const imgRes = await fetch(params.imageUrl);
      const imgBuffer = await imgRes.arrayBuffer();
      const blob = new Blob([imgBuffer], { type: 'image/png' });
      formData.append('file', blob, 'token.png');
    } else {
      return { error: 'Either imageBase64 or imageUrl is required' };
    }

    const response = await fetch(PUMPFUN_IPFS, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: `IPFS upload failed: ${response.status} ${text}` };
    }

    const data: any = await response.json();
    if (!data.metadataUri) {
      return { error: 'No metadataUri in IPFS response' };
    }

    return { metadataUri: data.metadataUri };
  } catch (err: any) {
    return { error: `IPFS upload error: ${err.message}` };
  }
}

/**
 * Step 2: Build create transaction via PumpPortal
 * Returns an unsigned base58-encoded transaction
 */
async function buildCreateTransaction(params: {
  creatorWallet: string;
  mintPublicKey: string;
  name: string;
  symbol: string;
  metadataUri: string;
  devBuyAmount?: number;
  slippage?: number;
  priorityFee?: number;
}): Promise<{ transaction: string } | { error: string }> {
  try {
    const txArgs = [
      {
        publicKey: params.creatorWallet,
        action: 'create',
        tokenMetadata: {
          name: params.name,
          symbol: params.symbol,
          uri: params.metadataUri,
        },
        mint: params.mintPublicKey,
        denominatedInSol: 'true',
        amount: params.devBuyAmount || 0,
        slippage: params.slippage || 10,
        priorityFee: params.priorityFee || 0.0005,
        pool: 'pump',
      },
    ];

    const response = await fetch(`${PUMPPORTAL_API}/trade-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txArgs),
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: `PumpPortal error: ${response.status} ${text}` };
    }

    const transactions: any = await response.json();
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return { error: 'No transaction returned from PumpPortal' };
    }

    return { transaction: transactions[0] };
  } catch (err: any) {
    return { error: `PumpPortal error: ${err.message}` };
  }
}

/**
 * Full create flow:
 * 1. Generate mint keypair
 * 2. Upload metadata to IPFS
 * 3. Build unsigned transaction
 * 4. Return everything the agent needs to sign and submit
 */
export async function createToken(params: CreateTokenParams): Promise<CreateTokenResult> {
  // Generate a random mint keypair
  const mintKeypair = Keypair.generate();
  const mintAddress = mintKeypair.publicKey.toBase58();
  const mintSecretKey = bs58.encode(mintKeypair.secretKey);

  // Upload metadata
  const ipfsResult = await uploadMetadata({
    name: params.name,
    symbol: params.symbol,
    description: params.description,
    imageBase64: params.imageBase64,
    imageUrl: params.imageUrl,
    twitter: params.twitter,
    telegram: params.telegram,
    website: params.website,
  });

  if ('error' in ipfsResult) {
    return { success: false, error: ipfsResult.error };
  }

  // Build transaction
  const txResult = await buildCreateTransaction({
    creatorWallet: params.creatorWallet,
    mintPublicKey: mintAddress,
    name: params.name,
    symbol: params.symbol,
    metadataUri: ipfsResult.metadataUri,
    devBuyAmount: params.devBuyAmount,
    slippage: params.slippage,
    priorityFee: params.priorityFee,
  });

  if ('error' in txResult) {
    return { success: false, error: txResult.error };
  }

  return {
    success: true,
    mintAddress,
    mintSecretKey,
    transaction: txResult.transaction,
    metadataUri: ipfsResult.metadataUri,
  };
}

/**
 * Build a buy/sell transaction via PumpPortal
 */
export async function buildTradeTransaction(params: {
  wallet: string;
  tokenAddress: string;
  side: 'buy' | 'sell';
  amount: number;
  denominatedInSol?: boolean;
  slippage?: number;
  priorityFee?: number;
}): Promise<{ transaction: string } | { error: string }> {
  try {
    const txArgs = [
      {
        publicKey: params.wallet,
        action: params.side,
        mint: params.tokenAddress,
        denominatedInSol: String(params.denominatedInSol ?? true),
        amount: params.amount,
        slippage: params.slippage || 10,
        priorityFee: params.priorityFee || 0.0005,
        pool: 'auto',
      },
    ];

    const response = await fetch(`${PUMPPORTAL_API}/trade-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txArgs),
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: `PumpPortal error: ${response.status} ${text}` };
    }

    const transactions: any = await response.json();
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return { error: 'No transaction returned' };
    }

    return { transaction: transactions[0] };
  } catch (err: any) {
    return { error: `Trade error: ${err.message}` };
  }
}
