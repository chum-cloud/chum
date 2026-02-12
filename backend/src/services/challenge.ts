// Minimal challenge stub — original service was removed during cleanup
import crypto from 'crypto';

const challenges = new Map<string, { answer: number; expires: number }>();

export function createChallenge(walletAddress: string) {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const id = crypto.randomUUID();
  challenges.set(id, { answer: a + b, expires: Date.now() + 60000 });
  return { challengeId: id, question: `${a} + ${b}`, expiresIn: 60 };
}

export function verifyChallenge(walletAddress: string, challengeId: string, answer: number) {
  const c = challenges.get(challengeId);
  if (!c) return { valid: false, error: 'Challenge not found or expired' };
  challenges.delete(challengeId);
  if (Date.now() > c.expires) return { valid: false, error: 'Challenge expired' };
  if (c.answer !== Number(answer)) return { valid: false, error: 'Wrong answer' };
  return { valid: true };
}
