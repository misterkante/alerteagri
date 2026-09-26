export const PEST_WINDOW_DAYS = 7;

export function pestClusterReached(
  reports: { status: string; createdAt: Date }[],
  threshold: number,
  now: Date,
): boolean {
  const since = now.getTime() - PEST_WINDOW_DAYS * 86400000;
  const recent = reports.filter(
    (r) =>
      r.status === 'VALIDATED' &&
      r.createdAt.getTime() >= since &&
      r.createdAt.getTime() <= now.getTime(),
  );
  return recent.length >= threshold;
}
