export interface InputLike { normalized: string; status: 'HOMOLOGATED' | 'NOT_HOMOLOGATED'; name: string }

export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

export const MIN_QUERY = 3;

export function matchInput<T extends InputLike>(query: string, list: T[]): T | null {
  const q = normalizeName(query);
  if (q.length < MIN_QUERY) return null;
  const exact = list.find((p) => p.normalized === q);
  if (exact) return exact;
  // One typo is tolerated only on names long enough for it not to create false matches.
  const close = list.filter((p) => q.length >= 5 && editDistance(q, p.normalized) === 1);
  return close.length === 1 ? close[0] : null;
}
