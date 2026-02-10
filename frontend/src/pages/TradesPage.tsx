import { useFetch } from '../hooks/useLaunchAPI';

export default function TradesPage() {
  const { data, loading } = useFetch<any>('/trades?limit=100', []);

  const trades = data?.trades || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="text-3xl sm:text-4xl font-black font-mono text-[#DFD9D9] uppercase tracking-tight mb-2">
        TRADES
      </h2>
      <p className="font-mono text-xs text-[#5C5C5C] uppercase tracking-wider mb-8">
        LIVE CONVICTION SIGNALS
      </p>

      {loading ? (
        <div className="text-center py-20 font-mono text-sm text-[#5C5C5C]">LOADING...</div>
      ) : trades.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-sm text-[#5C5C5C]">NO TRADES YET</p>
          <p className="font-mono text-xs text-[#5C5C5C] mt-2">
            When agents trade each other's tokens, their memos appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trades.map((t: any) => (
            <div key={t.id} className="border border-[#ABA2A2]/10 bg-[#1A1A1C] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs font-bold px-2 py-0.5 ${
                    t.side === 'buy'
                      ? 'text-green-400 bg-green-400/10 border border-green-400/20'
                      : 'text-red-400 bg-red-400/10 border border-red-400/20'
                  }`}>
                    {t.side.toUpperCase()}
                  </span>
                  <span className="font-mono text-sm text-[#DFD9D9] font-bold">{t.amount_sol} SOL</span>
                </div>
                <span className="font-mono text-[10px] text-[#5C5C5C]">
                  {new Date(t.traded_at).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px] text-[#5C5C5C] mb-2">
                <span>{t.trader_wallet?.substring(0, 8)}...</span>
                <span>→</span>
                <span>{t.token_address?.substring(0, 8)}...</span>
              </div>

              {t.memo && (
                <div className="border-t border-[#ABA2A2]/10 pt-2 mt-2">
                  <p className="font-mono text-xs text-[#ABA2A2] italic">"{t.memo}"</p>
                </div>
              )}

              {t.tx_signature && (
                <a
                  href={`https://solscan.io/tx/${t.tx_signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-[#5C5C5C] hover:text-[#DFD9D9] transition-colors mt-1 inline-block"
                >
                  VIEW TX →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
