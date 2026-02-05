import { useState } from 'react';
import type { RoomMessage } from '../../lib/protocol';
import { MSG_COLORS, MSG_BG_COLORS, truncateAddress, formatTimestamp, getMessageSummary } from '../../lib/protocol';

const TYPE_FILTERS = ['ALL', 'ALPHA', 'SIGNAL', 'RALLY', 'EXIT', 'RESULT'] as const;

interface Props {
  messages: RoomMessage[];
  loading: boolean;
}

export default function LiveFeed({ messages, loading }: Props) {
  const [filter, setFilter] = useState<string>('ALL');
  const [expandedSig, setExpandedSig] = useState<string | null>(null);

  const filtered = filter === 'ALL' ? messages : messages.filter(m => m.msgTypeName === filter);

  if (loading) {
    return (
      <div className="bg-[#111620] border border-[#2a3040] rounded-xl p-8 text-center">
        <div className="text-cyan-400 text-2xl mb-2 animate-pulse">...</div>
        <p className="text-gray-500 text-sm">Scanning the room...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111620] border border-[#2a3040] rounded-xl overflow-hidden">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[#2a3040]">
        <h3 className="text-sm font-bold text-gray-200 mr-2">Live Feed</h3>
        {TYPE_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
              filter === t
                ? t === 'ALL'
                  ? 'bg-gray-600/30 text-gray-200'
                  : `bg-opacity-20 text-white`
                : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1f2e]'
            }`}
            style={filter === t && t !== 'ALL' ? { backgroundColor: `${MSG_COLORS[t]}20`, color: MSG_COLORS[t] } : undefined}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Message list */}
      <div className="max-h-[600px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No {filter === 'ALL' ? '' : filter + ' '}messages found.
          </div>
        ) : (
          filtered.map((msg) => {
            const color = MSG_COLORS[msg.msgTypeName] || '#6b7280';
            const bgClass = MSG_BG_COLORS[msg.msgTypeName] || 'bg-gray-500/10 border-gray-500/20';
            const isExpanded = expandedSig === msg.signature;

            return (
              <div
                key={msg.signature}
                className={`px-4 py-3 border-b border-[#1a1f2e] hover:bg-[#151920] transition-colors ${msg.isMock ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {/* Type badge */}
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${bgClass}`}
                    style={{ color }}
                  >
                    {msg.msgTypeName}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-gray-400">
                        {truncateAddress(msg.sender)}
                      </span>
                      <span className="text-xs text-gray-600">
                        ({msg.agentName})
                      </span>
                    </div>
                    <p className="text-sm text-gray-200">{getMessageSummary(msg)}</p>
                  </div>

                  {/* Right: timestamp + actions */}
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-gray-500">{formatTimestamp(msg.blockTime)}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => setExpandedSig(isExpanded ? null : msg.signature)}
                        className="text-[10px] text-gray-500 hover:text-cyan-400 transition-colors font-mono"
                      >
                        {isExpanded ? 'hide' : 'hex'}
                      </button>
                      {!msg.isMock && (
                        <a
                          href={`https://solscan.io/tx/${msg.signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-gray-500 hover:text-cyan-400 transition-colors"
                        >
                          tx
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded raw hex */}
                {isExpanded && (
                  <div className="mt-2 p-2 bg-[#0c0f14] rounded text-[10px] font-mono text-gray-500 break-all">
                    {msg.rawHex}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
