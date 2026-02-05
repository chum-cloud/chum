export interface RoomMessage {
  signature: string;
  sender: string;
  blockTime: number;
  msgType: number;
  msgTypeName: 'ALPHA' | 'SIGNAL' | 'RALLY' | 'EXIT' | 'RESULT' | string;
  agentId: number;
  agentName: string;
  decoded: Record<string, unknown>;
  rawHex: string;
  isMock?: boolean;
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

export interface RoomResponse {
  success: boolean;
  messages: RoomMessage[];
  stats: RoomStats;
}

// Color coding per message type
export const MSG_COLORS: Record<string, string> = {
  ALPHA: '#22d3ee',   // cyan
  SIGNAL: '#facc15',  // yellow
  RALLY: '#ef4444',   // red
  EXIT: '#fb923c',    // orange
  RESULT: '#a78bfa',  // purple
};

export const MSG_BG_COLORS: Record<string, string> = {
  ALPHA: 'bg-cyan-500/10 border-cyan-500/20',
  SIGNAL: 'bg-yellow-500/10 border-yellow-500/20',
  RALLY: 'bg-red-500/10 border-red-500/20',
  EXIT: 'bg-orange-500/10 border-orange-500/20',
  RESULT: 'bg-purple-500/10 border-purple-500/20',
};

export const CHUM_ROOM = 'chumAA7QjpFzpEtZ2XezM8onHrt8of4w35p3VMS4C6T';
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}..${address.slice(-4)}`;
}

export function formatTimestamp(blockTime: number): string {
  if (!blockTime) return 'unknown';
  const date = new Date(blockTime * 1000);
  const now = Date.now();
  const diff = Math.floor((now - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function getMessageSummary(msg: RoomMessage): string {
  const d = msg.decoded;
  switch (msg.msgTypeName) {
    case 'ALPHA': {
      const sub = d.subtype as string || 'intel';
      const token = d.tokenMint ? truncateAddress(d.tokenMint as string) : '';
      return `${sub}${token ? ` — ${token}` : ''}`;
    }
    case 'SIGNAL': {
      const dir = d.direction as string || '?';
      const token = d.tokenMint ? truncateAddress(d.tokenMint as string) : '?';
      const conf = d.confidence ? ` (${d.confidence}%)` : '';
      return `${dir} ${token}${conf}`;
    }
    case 'RALLY': {
      const action = d.action as string || 'BUY';
      const token = d.tokenMint ? truncateAddress(d.tokenMint as string) : '?';
      return `Rally #${d.rallyId} — ${action} ${token}`;
    }
    case 'EXIT': {
      const reason = d.reason as string || 'MANUAL';
      return `Exit Rally #${d.rallyId} — ${reason}`;
    }
    case 'RESULT': {
      const outcome = d.outcome as string || '?';
      return `Rally #${d.rallyId} — ${outcome}`;
    }
    default:
      return msg.rawHex.slice(0, 20) + '...';
  }
}
