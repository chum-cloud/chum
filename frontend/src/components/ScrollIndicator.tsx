export default function ScrollIndicator() {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 opacity-40 hover:opacity-70 transition-opacity">
      <span className="text-[10px] uppercase tracking-widest text-chum-muted font-mono">Scroll</span>
      <div style={{ animation: 'dialogue-bounce 1.5s ease-in-out infinite' }}>
        <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
          <path d="M1 1L8 8L15 1" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
