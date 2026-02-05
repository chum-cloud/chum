// Villain NFT types
export type BodyColor = 'green' | 'blue' | 'purple' | 'red' | 'gold' | 'teal';
export type Hat = 'none' | 'chef hat' | 'crown' | 'pirate hat' | 'top hat' | 'helmet';
export type EyeColor = 'red' | 'yellow' | 'blue' | 'pink' | 'gold';
export type Accessory = 'none' | 'monocle' | 'eyepatch' | 'scar' | 'sunglasses';
export type Expression = 'evil grin' | 'worried' | 'scheming' | 'angry' | 'happy';
export type Background = 'chum bucket' | 'underwater' | 'purple' | 'orange' | 'teal';

export interface VillainTraits {
  bodyColor: BodyColor;
  hat: Hat;
  eyeColor: EyeColor;
  accessory: Accessory;
  expression: Expression;
  background: Background;
}

export interface Villain {
  id: number;
  wallet_address: string;
  image_url: string;
  metadata_url: string;
  traits: VillainTraits;
  donation_amount: number;
  mint_signature: string | null;
  created_at: string;
}
