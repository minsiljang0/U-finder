// AMS(Auto Momentum Score) 지수 — 원본의 비공개 알고리즘을 대체하는 자체 근사식.
// PLAN.md §4 참고. 0~99.9 범위로 clamp.

export function computeAmsScore(params: {
  dailyViews: number;
  subscribers: number;
  daysSinceUpload: number;
}): number {
  const { dailyViews, subscribers, daysSinceUpload } = params;

  const viewScore = (40 * Math.log10(dailyViews + 1)) / Math.log10(1_000_000);
  const ratioScore = 30 * Math.min(1, dailyViews / (subscribers + 1) / 2);
  const recencyScore = 30 * Math.max(0, 1 - daysSinceUpload / 60);

  const raw = viewScore + ratioScore + recencyScore;
  return Math.max(0, Math.min(99.9, Math.round(raw * 10) / 10));
}

export function computeDailyViews(totalViews: number, daysSinceUpload: number): number {
  const days = Math.max(1, daysSinceUpload);
  return Math.round(totalViews / days);
}

export function daysSince(dateStr: string): number {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}

export function hoursSince(dateStr: string): number {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return Math.max(0.1, diffMs / (1000 * 60 * 60));
}

export function formatCount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}천`;
  return `${n}`;
}

export function formatRelativeDays(dateStr: string): string {
  const d = Math.floor(daysSince(dateStr));
  if (d <= 0) return "오늘";
  if (d === 1) return "1일 전";
  return `${d}일 전`;
}
