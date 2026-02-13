import type { PoolPiece } from './types';

export const POOL: PoolPiece[] = [
  { piece_id: "chum-0001", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HnvkncxH-1770919107.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HnvkncxH-1770919107.png" },
  { piece_id: "chum-0002", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-Hr2Yk52h-1770919120.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-Hr2Yk52h-1770919120.png" },
  { piece_id: "chum-0003", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-Hr9XVScv-1770919134.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-Hr9XVScv-1770919134.png" },
  { piece_id: "chum-0004", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HpuMQ7dz-1770919146.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HpuMQ7dz-1770919146.png" },
  { piece_id: "chum-0005", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HqYg245H-1770919159.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HqYg245H-1770919159.png" },
  { piece_id: "chum-0006", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HqErbPZQ-1770919173.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HqErbPZQ-1770919173.png" },
  { piece_id: "chum-0007", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HqgxeEqw-1770919185.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HqgxeEqw-1770919185.png" },
  { piece_id: "chum-0008", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-Hqxuy3qu-1770919196.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-Hqxuy3qu-1770919196.png" },
  { piece_id: "chum-0009", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HoFKT4sM-1770919210.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HoFKT4sM-1770919210.png" },
  { piece_id: "chum-0010", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HnahWYx8-1770919222.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/madlads-HnahWYx8-1770919222.png" },
  { piece_id: "chum-0011", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/critters-FSatzQ6F-1770919237.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/critters-FSatzQ6F-1770919237.png" },
  { piece_id: "chum-0012", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/critters-FSt8Wxe9-1770919248.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/critters-FSt8Wxe9-1770919248.png" },
  { piece_id: "chum-0013", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/critters-FS4qhGgG-1770919260.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/critters-FS4qhGgG-1770919260.png" },
  { piece_id: "chum-0014", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/critters-FWMAu41k-1770919274.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/critters-FWMAu41k-1770919274.png" },
  { piece_id: "chum-0015", mp4_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/critters-FWoZHpcG-1770919285.mp4", png_url: "https://akkhgcmmgzrianbdfijt.supabase.co/storage/v1/object/public/art-pool/critters-FWoZHpcG-1770919285.png" },
];

export function randomPiece(): PoolPiece {
  return POOL[Math.floor(Math.random() * POOL.length)];
}
