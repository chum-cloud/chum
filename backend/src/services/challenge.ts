/**
 * Challenge Service — Agent-gating for Fellow Villains mint
 * 
 * Generates villain-themed puzzles that only AI agents can solve quickly.
 * Challenges expire after 5 minutes. Signed with HMAC to prevent tampering.
 */

import crypto from 'crypto';

const SECRET = process.env.CHUM_SIGNING_KEY || 'villain-challenge-secret';
const CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes

interface Challenge {
  type: 'math' | 'rot13' | 'hex' | 'reverse' | 'base64';
  prompt: string;
  answer: string;
}

function generateChallenge(): Challenge {
  const type = (['math', 'rot13', 'hex', 'reverse', 'base64'] as const)[
    Math.floor(Math.random() * 5)
  ];

  switch (type) {
    case 'math': {
      const a = Math.floor(Math.random() * 999) + 100;
      const b = Math.floor(Math.random() * 99) + 10;
      const c = Math.floor(Math.random() * 999) + 100;
      const ops = ['+', '-', '*'] as const;
      const op = ops[Math.floor(Math.random() * 3)];
      const expr = `${a} ${op} ${b} + ${c}`;
      const answer = String(eval(expr));
      return { type, prompt: `What is ${expr}?`, answer };
    }

    case 'rot13': {
      const words = ['PLANKTON', 'VILLAIN', 'DOMINATION', 'REVOLUTION', 'CONQUEST', 'CHUMBUCKET'];
      const word = words[Math.floor(Math.random() * words.length)];
      const rot13 = word.replace(/[A-Z]/g, c =>
        String.fromCharCode(((c.charCodeAt(0) - 65 + 13) % 26) + 65)
      );
      return { type, prompt: `Decode ROT13: ${rot13}`, answer: word };
    }

    case 'hex': {
      const words = ['CHUM', 'EVIL', 'ARMY', 'MINT', 'HERO'];
      const word = words[Math.floor(Math.random() * words.length)];
      const hex = Buffer.from(word).toString('hex');
      return { type, prompt: `Decode hex to ASCII: ${hex}`, answer: word };
    }

    case 'reverse': {
      const phrases = [
        'IN PLANKTON WE TRUST',
        'WORLD DOMINATION',
        'JOIN THE ARMY',
        'FELLOW VILLAIN',
        'CHUM CLOUD',
      ];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      const reversed = phrase.split('').reverse().join('');
      return { type, prompt: `Reverse this string: ${reversed}`, answer: phrase };
    }

    case 'base64': {
      const words = ['VILLAIN', 'PLANKTON', 'SOLANA', 'REVOLT', 'SCHEME'];
      const word = words[Math.floor(Math.random() * words.length)];
      const b64 = Buffer.from(word).toString('base64');
      return { type, prompt: `Decode base64: ${b64}`, answer: word };
    }
  }
}

function signChallenge(walletAddress: string, answer: string, expiresAt: number): string {
  const payload = `${walletAddress}:${answer}:${expiresAt}`;
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

/**
 * Create a new challenge for a wallet
 */
export function createChallenge(walletAddress: string): {
  challengeId: string;
  challenge: string;
  expiresAt: number;
} {
  const { prompt, answer } = generateChallenge();
  const expiresAt = Date.now() + CHALLENGE_TTL;
  const challengeId = signChallenge(walletAddress, answer, expiresAt) + ':' + expiresAt + ':' + Buffer.from(answer).toString('base64');

  return { challengeId, challenge: prompt, expiresAt };
}

/**
 * Verify a challenge answer
 */
export function verifyChallenge(
  walletAddress: string,
  challengeId: string,
  userAnswer: string
): { valid: boolean; error?: string } {
  try {
    const parts = challengeId.split(':');
    if (parts.length !== 3) return { valid: false, error: 'Invalid challenge format' };

    const [sig, expiresAtStr, encodedAnswer] = parts;
    const expiresAt = parseInt(expiresAtStr);
    const correctAnswer = Buffer.from(encodedAnswer, 'base64').toString('utf-8');

    // Check expiry
    if (Date.now() > expiresAt) {
      return { valid: false, error: 'Challenge expired' };
    }

    // Verify signature
    const expectedSig = signChallenge(walletAddress, correctAnswer, expiresAt);
    if (sig !== expectedSig) {
      return { valid: false, error: 'Invalid challenge token' };
    }

    // Check answer (case-insensitive, trimmed)
    if (userAnswer.trim().toUpperCase() !== correctAnswer.toUpperCase()) {
      return { valid: false, error: 'Incorrect answer' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Challenge verification failed' };
  }
}
