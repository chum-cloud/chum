// TODO(MAINNET): REMOVE this entire page before mainnet launch!
import { useState, useEffect } from 'react';

interface PoolPiece {
  piece_id?: string;
  id?: string;
  mp4_url?: string;
  mp4?: string;
  png_url?: string;
  png?: string;
  name?: string;
  mp4_size_kb?: number;
  mp4_size?: number;
  png_size_kb?: number;
  png_size?: number;
}

const MANIFEST_URL = 'https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/pool-manifest.json';

export default function PoolPreviewPage() {
  const [pieces, setPieces] = useState<PoolPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'madlads' | 'critters' | 'smb' | 'slimes' | 'boogle'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<PoolPiece | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 48;

  useEffect(() => {
    fetch('/pool-manifest.json')
      .then(r => r.ok ? r.json() : fetch(MANIFEST_URL).then(r2 => r2.json()))
      .then(data => {
        setPieces(data.pieces || []);
        setLoading(false);
      })
      .catch(() => {
        // Try direct Supabase
        fetch(MANIFEST_URL)
          .then(r => r.json())
          .then(data => {
            setPieces(data.pieces || []);
            setLoading(false);
          })
          .catch(e => {
            setError(e.message);
            setLoading(false);
          });
      });
  }, []);

  const getId = (p: PoolPiece) => p.piece_id || p.id || '';
  const getMp4 = (p: PoolPiece) => p.mp4_url || p.mp4 || '';
  const getPng = (p: PoolPiece) => p.png_url || p.png || '';
  const getName = (p: PoolPiece) => p.name || p.id || p.piece_id || 'Unknown';
  const getMp4Size = (p: PoolPiece) => p.mp4_size_kb || (p.mp4_size ? Math.round(p.mp4_size / 1024) : 0);
  const getPngSize = (p: PoolPiece) => p.png_size_kb || (p.png_size ? Math.round(p.png_size / 1024) : 0);

  const getSource = (p: PoolPiece): string => {
    const id = getId(p);
    if (id.startsWith('slimes-') || id.includes('slimes')) return 'slimes';
    if (id.startsWith('boogle-') || id.includes('boogle')) return 'boogle';
    if (id.includes('madlads') || id.includes('Madlads')) return 'madlads';
    if (id.includes('critters') || id.includes('Critters')) return 'critters';
    if (id.includes('SMB') || id.includes('smb')) return 'smb';
    // Fallback: check URL
    const url = getMp4(p);
    if (url.includes('madlads')) return 'madlads';
    if (url.includes('critters')) return 'critters';
    if (url.includes('smb-') || url.includes('SMB')) return 'smb';
    if (url.includes('slimes')) return 'slimes';
    if (url.includes('boogle')) return 'boogle';
    return 'unknown';
  };

  const filtered = filter === 'all' ? pieces : pieces.filter(p => getSource(p) === filter);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const counts = {
    all: pieces.length,
    madlads: pieces.filter(p => getSource(p) === 'madlads').length,
    critters: pieces.filter(p => getSource(p) === 'critters').length,
    smb: pieces.filter(p => getSource(p) === 'smb').length,
    slimes: pieces.filter(p => getSource(p) === 'slimes').length,
    boogle: pieces.filter(p => getSource(p) === 'boogle').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="font-mono text-chum-green animate-pulse">LOADING POOL...</p>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="font-mono text-red-500">ERROR: {error}</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-mono text-2xl text-chum-green mb-1">ART POOL PREVIEW</h1>
        <p className="font-mono text-sm text-chum-text/60">
          {pieces.length} pieces generated — DEV ONLY
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'madlads', 'critters', 'smb', 'slimes', 'boogle'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(0); }}
            className={`font-mono text-xs px-3 py-2 border transition-colors ${
              filter === f
                ? 'border-chum-green text-chum-green bg-chum-green/10'
                : 'border-chum-text/20 text-chum-text/60 hover:border-chum-text/40'
            }`}
          >
            {f.toUpperCase()} [{counts[f]}]
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`font-mono text-xs px-3 py-2 border ${viewMode === 'grid' ? 'border-chum-green text-chum-green' : 'border-chum-text/20 text-chum-text/60'}`}
          >
            GRID
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`font-mono text-xs px-3 py-2 border ${viewMode === 'list' ? 'border-chum-green text-chum-green' : 'border-chum-text/20 text-chum-text/60'}`}
          >
            LIST
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="font-mono text-xs text-chum-text/40 mb-4">
        Showing {paginated.length} of {filtered.length} | Page {page + 1}/{totalPages || 1}
      </div>

      {/* Grid view */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {paginated.map((piece, i) => (
            <div
              key={getId(piece) + i}
              onClick={() => setSelected(piece)}
              className="cursor-pointer border border-chum-text/10 hover:border-chum-green/50 transition-colors group"
            >
              <div className="aspect-square bg-black relative overflow-hidden">
                <img
                  src={getPng(piece)}
                  alt={getName(piece)}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="font-mono text-[9px] text-chum-green truncate">{getId(piece)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div className="space-y-1">
          <div className="grid grid-cols-12 font-mono text-xs text-chum-text/40 px-2 py-1 border-b border-chum-text/10">
            <span className="col-span-1">#</span>
            <span className="col-span-4">ID</span>
            <span className="col-span-2">SOURCE</span>
            <span className="col-span-2">MP4</span>
            <span className="col-span-2">PNG</span>
            <span className="col-span-1">VIEW</span>
          </div>
          {paginated.map((piece, i) => (
            <div
              key={getId(piece) + i}
              onClick={() => setSelected(piece)}
              className="grid grid-cols-12 font-mono text-xs px-2 py-1.5 border-b border-chum-text/5 hover:bg-chum-green/5 cursor-pointer"
            >
              <span className="col-span-1 text-chum-text/40">{page * PAGE_SIZE + i + 1}</span>
              <span className="col-span-4 text-chum-text truncate">{getId(piece)}</span>
              <span className="col-span-2 text-chum-text/60">{getSource(piece)}</span>
              <span className="col-span-2 text-chum-text/60">{getMp4Size(piece)}KB</span>
              <span className="col-span-2 text-chum-text/60">{getPngSize(piece)}KB</span>
              <span className="col-span-1 text-chum-green">--&gt;</span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="font-mono text-xs px-4 py-2 border border-chum-text/20 disabled:opacity-30"
          >
            PREV
          </button>
          <span className="font-mono text-xs px-4 py-2 text-chum-text/60">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="font-mono text-xs px-4 py-2 border border-chum-text/20 disabled:opacity-30"
          >
            NEXT
          </button>
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-w-2xl w-full bg-chum-bg border border-chum-green/30 p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-mono text-sm text-chum-green">{getName(selected)}</h2>
              <button
                onClick={() => setSelected(null)}
                className="font-mono text-xs text-chum-text/60 hover:text-chum-text px-2 py-1 border border-chum-text/20"
              >
                CLOSE
              </button>
            </div>
            <div className="aspect-square bg-black mb-4">
              <video
                src={getMp4(selected)}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="text-chum-text/60">
                ID: <span className="text-chum-text">{getId(selected)}</span>
              </div>
              <div className="text-chum-text/60">
                Source: <span className="text-chum-text">{getSource(selected)}</span>
              </div>
              <div className="text-chum-text/60">
                MP4: <span className="text-chum-text">{getMp4Size(selected)}KB</span>
              </div>
              <div className="text-chum-text/60">
                PNG: <span className="text-chum-text">{getPngSize(selected)}KB</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <a
                href={getMp4(selected)}
                target="_blank"
                className="font-mono text-xs px-3 py-2 border border-chum-green text-chum-green hover:bg-chum-green/10 flex-1 text-center"
              >
                OPEN MP4
              </a>
              <a
                href={getPng(selected)}
                target="_blank"
                className="font-mono text-xs px-3 py-2 border border-chum-text/40 text-chum-text/60 hover:text-chum-text flex-1 text-center"
              >
                OPEN PNG
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
