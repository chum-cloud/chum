// Minimal challenge service for villain minting verification
import crypto from 'crypto';

interface Challenge {
  challengeId: string;
  question: string;
  expiresAt: number;
}

const challenges = new Map<string, { answer: string; wallet: string; expiresAt: number }>();

export function createChallenge(walletAddress: string): Challenge {
  const num1 = Math.floor(Math.random() * 50) + 1;
  const num2 = Math.floor(Math.random() * 50) + 1;
  const challengeId = crypto.randomUUID();
  const answer = String(num1 + num2);

  challenges.set(challengeId, {
    answer,
    wallet: walletAddress,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  return {
    challengeId,
    question: `What is ${num1} + ${num2}?`,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
}

export function verifyChallenge(walletAddress: string, challengeId: string, answer: string): { valid: boolean; error?: string } {
  const challenge = challenges.get(challengeId);
  if (!challenge) return { valid: false, error: 'Challenge not found or expired' };
  if (challenge.wallet !== walletAddress) return { valid: false, error: 'Wallet mismatch' };
  if (Date.now() > challenge.expiresAt) {
    challenges.delete(challengeId);
    return { valid: false, error: 'Challenge expired' };
  }
  if (challenge.answer !== answer) return { valid: false, error: 'Wrong answer' };

  challenges.delete(challengeId);
  return { valid: true };
}
