const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor',
  'not', 'so', 'yet', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very',
  'just', 'because', 'if', 'when', 'where', 'how', 'all', 'any', 'every',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them',
  'their', 'what', 'which', 'who', 'whom', 'about', 'up', 'down',
]);

export function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface UniquenessResult {
  isUnique: boolean;
  similarity: number;
  bannedPhrases: string[];
}

export function checkUniqueness(
  newThought: string,
  recentThoughts: string[],
  threshold: number = 0.4
): UniquenessResult {
  const newKeywords = extractKeywords(newThought);
  let maxSimilarity = 0;
  const overlappingWords = new Set<string>();

  for (const existing of recentThoughts) {
    const existingKeywords = extractKeywords(existing);
    const sim = jaccardSimilarity(newKeywords, existingKeywords);
    if (sim > maxSimilarity) maxSimilarity = sim;

    // Collect overlapping keywords for banned phrases
    if (sim > threshold) {
      for (const word of newKeywords) {
        if (existingKeywords.has(word)) overlappingWords.add(word);
      }
    }
  }

  return {
    isUnique: maxSimilarity < threshold,
    similarity: maxSimilarity,
    bannedPhrases: Array.from(overlappingWords),
  };
}
