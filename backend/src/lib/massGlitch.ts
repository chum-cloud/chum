/**
 * Post-processor that injects "mass" into text based on CHUM's health.
 * The lower the health, the more frequent the glitch.
 */
export function applyMassGlitch(text: string, healthPercent: number): string {
  if (healthPercent > 30) return text;

  let interval: [number, number];
  if (healthPercent > 20) {
    interval = [8, 12];
  } else if (healthPercent > 10) {
    interval = [4, 6];
  } else {
    interval = [2, 3];
  }

  const tokens = text.split(/(\s+)/);
  const result: string[] = [];
  let wordCount = 0;
  let nextInsert = randomBetween(interval[0], interval[1]);

  for (const token of tokens) {
    result.push(token);
    // Only count non-whitespace tokens as words
    if (token.trim().length > 0) {
      wordCount++;
      if (wordCount >= nextInsert) {
        result.push(' mass');
        wordCount = 0;
        nextInsert = randomBetween(interval[0], interval[1]);
      }
    }
  }

  return result.join('');
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
