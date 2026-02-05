import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config.js';

// Protocol constants
const CHUM_ROOM = config.chumWalletAddress;
const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const CHUM_MAGIC = [0x43, 0x48]; // "CH"

// Message type mapping
const MSG_TYPES: Record<number, string> = {
  0x01: 'ALPHA',
  0x02: 'SIGNAL',
  0x03: 'RALLY',
  0x04: 'EXIT',
  0x05: 'RESULT',
};

// Alpha subtypes
const ALPHA_SUBTYPES: Record<number, string> = {
  0x01: 'WHALE_MOVE',
  0x02: 'DEX_LISTING',
  0x03: 'SOCIAL_SURGE',
};

export interface RoomMessage {
  signature: string;
  sender: string;
  blockTime: number;
  msgType: number;
  msgTypeName: string;
  agentId: number;
  agentName: string;
  decoded: Record<string, unknown>;
  rawHex: string;
}

export interface RallyInfo {
  rallyId: number;
  tokenMint: string;
  action: string;
  entryPrice: number;
  targetPrice: number;
}

export interface AgentInfo {
  address: string;
  messageCount: number;
  lastSeen: number;
}

export interface RoomStats {
  totalMessages: number;
  uniqueAgents: number;
  activeRallies: RallyInfo[];
  agentList: AgentInfo[];
}

// In-memory cache
let cachedMessages: RoomMessage[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 15_000; // 15 seconds

const connection = new Connection(config.heliusRpcUrl, 'confirmed');

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function readUint16BE(data: number[], offset: number): number {
  return (data[offset] << 8) | data[offset + 1];
}

function readUint32BE(data: number[], offset: number): number {
  return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

function readUint64BE(data: number[], offset: number): number {
  // Read as two 32-bit parts — safe for prices up to ~9 quadrillion lamports
  const high = readUint32BE(data, offset);
  const low = readUint32BE(data, offset + 4);
  return high * 0x100000000 + low;
}

function truncateAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}..${address.slice(-4)}`;
}

function decodeAgentName(agentId: number): string {
  // Map known agent IDs to names; unknown get generic labels
  const knownAgents: Record<number, string> = {
    1: 'CHUM-PRIME',
    2: 'KAREN-BOT',
    3: 'PLANKTON-JR',
  };
  return knownAgents[agentId] || `AGENT-${agentId}`;
}

function decodeMemo(data: number[], sender: string): Omit<RoomMessage, 'signature' | 'blockTime'> | null {
  if (data.length < 5) return null;
  if (data[0] !== CHUM_MAGIC[0] || data[1] !== CHUM_MAGIC[1]) return null;

  const msgType = data[2];
  const agentId = readUint16BE(data, 3);
  const msgTypeName = MSG_TYPES[msgType] || `UNKNOWN(${msgType})`;
  const agentName = decodeAgentName(agentId);
  const rawHex = bytesToHex(data);

  const decoded: Record<string, unknown> = {};
  const payload = data.slice(5);

  switch (msgType) {
    case 0x01: { // ALPHA
      if (payload.length >= 1) {
        const subtype = payload[0];
        decoded.subtype = ALPHA_SUBTYPES[subtype] || `UNKNOWN(${subtype})`;
        if (payload.length >= 33) {
          // 32-byte token mint follows
          try {
            const mintBytes = new Uint8Array(payload.slice(1, 33));
            decoded.tokenMint = new PublicKey(mintBytes).toBase58();
          } catch {
            decoded.tokenMint = bytesToHex(payload.slice(1, 33));
          }
        }
        if (payload.length >= 41) {
          decoded.amount = readUint64BE(payload, 33);
        }
      }
      break;
    }
    case 0x02: { // SIGNAL
      if (payload.length >= 33) {
        try {
          const mintBytes = new Uint8Array(payload.slice(0, 32));
          decoded.tokenMint = new PublicKey(mintBytes).toBase58();
        } catch {
          decoded.tokenMint = bytesToHex(payload.slice(0, 32));
        }
        decoded.direction = payload[32] === 0x01 ? 'BUY' : 'SELL';
        if (payload.length >= 34) {
          decoded.confidence = payload[33];
        }
      }
      break;
    }
    case 0x03: { // RALLY
      if (payload.length >= 2) {
        decoded.rallyId = readUint16BE(payload, 0);
        if (payload.length >= 34) {
          try {
            const mintBytes = new Uint8Array(payload.slice(2, 34));
            decoded.tokenMint = new PublicKey(mintBytes).toBase58();
          } catch {
            decoded.tokenMint = bytesToHex(payload.slice(2, 34));
          }
        }
        if (payload.length >= 35) {
          decoded.action = payload[34] === 0x01 ? 'BUY' : 'SELL';
        }
        if (payload.length >= 43) {
          decoded.entryPrice = readUint64BE(payload, 35);
        }
        if (payload.length >= 51) {
          decoded.targetPrice = readUint64BE(payload, 43);
        }
      }
      break;
    }
    case 0x04: { // EXIT
      if (payload.length >= 2) {
        decoded.rallyId = readUint16BE(payload, 0);
        if (payload.length >= 3) {
          decoded.reason = payload[2] === 0x01 ? 'TARGET_HIT' : payload[2] === 0x02 ? 'STOP_LOSS' : 'MANUAL';
        }
      }
      break;
    }
    case 0x05: { // RESULT
      if (payload.length >= 2) {
        decoded.rallyId = readUint16BE(payload, 0);
        if (payload.length >= 3) {
          decoded.outcome = payload[2] === 0x01 ? 'WIN' : 'LOSS';
        }
        if (payload.length >= 11) {
          decoded.pnlLamports = readUint64BE(payload, 3);
        }
      }
      break;
    }
  }

  return { sender, msgType, msgTypeName, agentId, agentName, decoded, rawHex };
}

export async function readRoomMessages(limit: number = 50): Promise<RoomMessage[]> {
  const now = Date.now();
  if (cachedMessages.length > 0 && now - cacheTimestamp < CACHE_TTL) {
    return cachedMessages.slice(0, limit);
  }

  try {
    const roomPubkey = new PublicKey(CHUM_ROOM);
    const memoProgramId = new PublicKey(MEMO_PROGRAM);

    // Fetch recent signatures for the room address
    const signatures = await connection.getSignaturesForAddress(roomPubkey, {
      limit: Math.min(limit * 2, 100), // fetch extra since not all will have memos
    });

    const messages: RoomMessage[] = [];

    for (const sigInfo of signatures) {
      if (messages.length >= limit) break;

      try {
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta || tx.meta.err) continue;

        // Look for memo instructions
        const instructions = tx.transaction.message.instructions;
        for (const ix of instructions) {
          if ('programId' in ix && ix.programId.equals(memoProgramId)) {
            // Memo instruction — extract data
            let memoData: number[] | null = null;

            if ('parsed' in ix && typeof ix.parsed === 'string') {
              // Parsed memo — could be hex-encoded or raw string
              try {
                // Try hex decode first
                const hexStr = ix.parsed.replace(/\s/g, '');
                if (/^[0-9a-fA-F]+$/.test(hexStr) && hexStr.length % 2 === 0) {
                  memoData = [];
                  for (let i = 0; i < hexStr.length; i += 2) {
                    memoData.push(parseInt(hexStr.substring(i, i + 2), 16));
                  }
                } else {
                  // Raw string — convert to bytes
                  memoData = Array.from(Buffer.from(ix.parsed, 'utf-8'));
                }
              } catch {
                continue;
              }
            } else if ('data' in ix && typeof ix.data === 'string') {
              // Base64 encoded data
              try {
                memoData = Array.from(Buffer.from(ix.data, 'base64'));
              } catch {
                continue;
              }
            }

            if (!memoData || memoData.length < 5) continue;
            if (memoData[0] !== CHUM_MAGIC[0] || memoData[1] !== CHUM_MAGIC[1]) continue;

            // Get sender (fee payer is usually the sender)
            const sender = tx.transaction.message.accountKeys[0]?.pubkey?.toString() || 'unknown';

            const decoded = decodeMemo(memoData, sender);
            if (decoded) {
              messages.push({
                ...decoded,
                signature: sigInfo.signature,
                blockTime: sigInfo.blockTime || 0,
              });
            }
          }
        }
      } catch (err) {
        console.error(`[ROOM] Failed to parse tx ${sigInfo.signature}:`, err);
      }
    }

    // Update cache
    cachedMessages = messages;
    cacheTimestamp = now;

    return messages.slice(0, limit);
  } catch (error) {
    console.error('[ROOM] Failed to read room messages:', error);
    return cachedMessages.slice(0, limit); // Return stale cache on error
  }
}

export function getRoomStats(messages: RoomMessage[]): RoomStats {
  const agentMap = new Map<string, { messageCount: number; lastSeen: number }>();

  for (const msg of messages) {
    const existing = agentMap.get(msg.sender);
    if (existing) {
      existing.messageCount++;
      existing.lastSeen = Math.max(existing.lastSeen, msg.blockTime);
    } else {
      agentMap.set(msg.sender, { messageCount: 1, lastSeen: msg.blockTime });
    }
  }

  // Collect active rallies (RALLY messages without matching EXIT)
  const rallyMap = new Map<number, RallyInfo>();
  const exitedRallies = new Set<number>();

  for (const msg of messages) {
    if (msg.msgType === 0x04) {
      // EXIT
      const rallyId = msg.decoded.rallyId as number;
      if (rallyId !== undefined) exitedRallies.add(rallyId);
    }
  }

  for (const msg of messages) {
    if (msg.msgType === 0x03) {
      // RALLY
      const rallyId = msg.decoded.rallyId as number;
      if (rallyId !== undefined && !exitedRallies.has(rallyId) && !rallyMap.has(rallyId)) {
        rallyMap.set(rallyId, {
          rallyId,
          tokenMint: (msg.decoded.tokenMint as string) || 'unknown',
          action: (msg.decoded.action as string) || 'BUY',
          entryPrice: (msg.decoded.entryPrice as number) || 0,
          targetPrice: (msg.decoded.targetPrice as number) || 0,
        });
      }
    }
  }

  const agentList: AgentInfo[] = Array.from(agentMap.entries()).map(([address, info]) => ({
    address,
    messageCount: info.messageCount,
    lastSeen: info.lastSeen,
  }));

  return {
    totalMessages: messages.length,
    uniqueAgents: agentMap.size,
    activeRallies: Array.from(rallyMap.values()),
    agentList,
  };
}
