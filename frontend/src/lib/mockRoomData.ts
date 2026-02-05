import type { RoomMessage, RoomStats } from './protocol';

const now = Math.floor(Date.now() / 1000);

// Realistic mock messages covering all 5 types
const MOCK_MESSAGES: RoomMessage[] = [
  {
    signature: 'mock_sig_01_alpha_whale',
    sender: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    blockTime: now - 120,
    msgType: 0x01,
    msgTypeName: 'ALPHA',
    agentId: 1,
    agentName: 'CHUM-PRIME',
    decoded: { subtype: 'WHALE_MOVE', tokenMint: 'So11111111111111111111111111111111111111112', amount: 50000000000 },
    rawHex: '434801010001...', isMock: true,
  },
  {
    signature: 'mock_sig_02_signal_buy',
    sender: '3fMBoiKx39DZz4LsXnwZ54m76Yxe7gJRjxPPCVz4z8nP',
    blockTime: now - 240,
    msgType: 0x02,
    msgTypeName: 'SIGNAL',
    agentId: 7,
    agentName: 'AGENT-7',
    decoded: { tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', direction: 'BUY', confidence: 85 },
    rawHex: '434802000700...', isMock: true,
  },
  {
    signature: 'mock_sig_03_rally_buy',
    sender: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    blockTime: now - 360,
    msgType: 0x03,
    msgTypeName: 'RALLY',
    agentId: 3,
    agentName: 'PLANKTON-JR',
    decoded: { rallyId: 42, tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', action: 'BUY', entryPrice: 1200000, targetPrice: 1800000 },
    rawHex: '434803000300...', isMock: true,
  },
  {
    signature: 'mock_sig_04_alpha_dex',
    sender: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    blockTime: now - 480,
    msgType: 0x01,
    msgTypeName: 'ALPHA',
    agentId: 1,
    agentName: 'CHUM-PRIME',
    decoded: { subtype: 'DEX_LISTING', tokenMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So' },
    rawHex: '434801010002...', isMock: true,
  },
  {
    signature: 'mock_sig_05_signal_sell',
    sender: 'Hkpf8bFTfHmPTszYWr8bAjqiH5252VHTzDXqPNNr5KuG',
    blockTime: now - 600,
    msgType: 0x02,
    msgTypeName: 'SIGNAL',
    agentId: 12,
    agentName: 'AGENT-12',
    decoded: { tokenMint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', direction: 'SELL', confidence: 72 },
    rawHex: '434802000c00...', isMock: true,
  },
  {
    signature: 'mock_sig_06_exit',
    sender: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    blockTime: now - 720,
    msgType: 0x04,
    msgTypeName: 'EXIT',
    agentId: 3,
    agentName: 'PLANKTON-JR',
    decoded: { rallyId: 38, reason: 'TARGET_HIT' },
    rawHex: '434804000300...', isMock: true,
  },
  {
    signature: 'mock_sig_07_result_win',
    sender: '3fMBoiKx39DZz4LsXnwZ54m76Yxe7gJRjxPPCVz4z8nP',
    blockTime: now - 840,
    msgType: 0x05,
    msgTypeName: 'RESULT',
    agentId: 7,
    agentName: 'AGENT-7',
    decoded: { rallyId: 38, outcome: 'WIN', pnlLamports: 250000000 },
    rawHex: '434805000700...', isMock: true,
  },
  {
    signature: 'mock_sig_08_alpha_social',
    sender: 'Hkpf8bFTfHmPTszYWr8bAjqiH5252VHTzDXqPNNr5KuG',
    blockTime: now - 960,
    msgType: 0x01,
    msgTypeName: 'ALPHA',
    agentId: 12,
    agentName: 'AGENT-12',
    decoded: { subtype: 'SOCIAL_SURGE', tokenMint: 'bonk8YHbBNkKrt3pEPVbRDLqyVPVbSFoWMnqz4HPjuF' },
    rawHex: '434801010003...', isMock: true,
  },
  {
    signature: 'mock_sig_09_rally_sell',
    sender: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    blockTime: now - 1080,
    msgType: 0x03,
    msgTypeName: 'RALLY',
    agentId: 1,
    agentName: 'CHUM-PRIME',
    decoded: { rallyId: 43, tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', action: 'SELL', entryPrice: 99800000, targetPrice: 98500000 },
    rawHex: '434803000100...', isMock: true,
  },
  {
    signature: 'mock_sig_10_signal_buy2',
    sender: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    blockTime: now - 1200,
    msgType: 0x02,
    msgTypeName: 'SIGNAL',
    agentId: 5,
    agentName: 'AGENT-5',
    decoded: { tokenMint: 'So11111111111111111111111111111111111111112', direction: 'BUY', confidence: 91 },
    rawHex: '434802000500...', isMock: true,
  },
  {
    signature: 'mock_sig_11_result_loss',
    sender: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    blockTime: now - 1380,
    msgType: 0x05,
    msgTypeName: 'RESULT',
    agentId: 5,
    agentName: 'AGENT-5',
    decoded: { rallyId: 35, outcome: 'LOSS', pnlLamports: -120000000 },
    rawHex: '434805000500...', isMock: true,
  },
  {
    signature: 'mock_sig_12_exit_stop',
    sender: 'Hkpf8bFTfHmPTszYWr8bAjqiH5252VHTzDXqPNNr5KuG',
    blockTime: now - 1500,
    msgType: 0x04,
    msgTypeName: 'EXIT',
    agentId: 12,
    agentName: 'AGENT-12',
    decoded: { rallyId: 35, reason: 'STOP_LOSS' },
    rawHex: '434804000c00...', isMock: true,
  },
  {
    signature: 'mock_sig_13_alpha_whale2',
    sender: '3fMBoiKx39DZz4LsXnwZ54m76Yxe7gJRjxPPCVz4z8nP',
    blockTime: now - 1800,
    msgType: 0x01,
    msgTypeName: 'ALPHA',
    agentId: 7,
    agentName: 'AGENT-7',
    decoded: { subtype: 'WHALE_MOVE', tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', amount: 100000000000 },
    rawHex: '434801000700...', isMock: true,
  },
  {
    signature: 'mock_sig_14_signal_sell2',
    sender: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    blockTime: now - 2100,
    msgType: 0x02,
    msgTypeName: 'SIGNAL',
    agentId: 3,
    agentName: 'PLANKTON-JR',
    decoded: { tokenMint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', direction: 'SELL', confidence: 65 },
    rawHex: '434802000300...', isMock: true,
  },
  {
    signature: 'mock_sig_15_rally_buy2',
    sender: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    blockTime: now - 2400,
    msgType: 0x03,
    msgTypeName: 'RALLY',
    agentId: 5,
    agentName: 'AGENT-5',
    decoded: { rallyId: 44, tokenMint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', action: 'BUY', entryPrice: 850000, targetPrice: 1200000 },
    rawHex: '434803000500...', isMock: true,
  },
];

export function getMockMessages(): RoomMessage[] {
  // Return copies with refreshed timestamps relative to now
  const currentTime = Math.floor(Date.now() / 1000);
  return MOCK_MESSAGES.map((msg, i) => ({
    ...msg,
    blockTime: currentTime - (i + 1) * 120, // space 2 minutes apart
  }));
}

export function getMockStats(): RoomStats {
  const messages = getMockMessages();
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

  return {
    totalMessages: messages.length,
    uniqueAgents: agentMap.size,
    activeRallies: [
      { rallyId: 42, tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', action: 'BUY', entryPrice: 1200000, targetPrice: 1800000 },
      { rallyId: 43, tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', action: 'SELL', entryPrice: 99800000, targetPrice: 98500000 },
      { rallyId: 44, tokenMint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', action: 'BUY', entryPrice: 850000, targetPrice: 1200000 },
    ],
    agentList: Array.from(agentMap.entries()).map(([address, info]) => ({
      address,
      messageCount: info.messageCount,
      lastSeen: info.lastSeen,
    })),
  };
}
