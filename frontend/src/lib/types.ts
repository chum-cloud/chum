export interface Villain {
  id: number;
  wallet_address: string;
  image_url: string;
  traits: {
    bodyColor: string;
    hat: string;
    eyeColor: string;
    accessory: string;
    expression: string;
    background: string;
  };
  rarity_score: number;
  is_minted: boolean;
  mint_signature?: string;
  created_at: string;
  donation_amount?: number;
  metadata_url?: string;
}
