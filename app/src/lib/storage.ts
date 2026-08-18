// 로컬(브라우저 단위) 설정 저장소. API 키는 민감정보라 서버에 보내지 않고 브라우저에만 둔다.
// 즐겨찾기는 회원별 데이터라 lib/favorites.ts(Supabase)로 옮겼다.

const KEYS = {
  apiKey: "sf.youtubeApiKey",
  trialStart: "sf.trialStart",
  premium: "sf.premium",
  rankingSnapshot: "sf.rankingSnapshot",
} as const;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getApiKey(): string {
  return localStorage.getItem(KEYS.apiKey) ?? "";
}

export function setApiKey(key: string) {
  localStorage.setItem(KEYS.apiKey, key.trim());
}

export function clearApiKey() {
  localStorage.removeItem(KEYS.apiKey);
}

export function getTrialStart(): number {
  let start = readJSON<number | null>(KEYS.trialStart, null);
  if (!start) {
    start = Date.now();
    writeJSON(KEYS.trialStart, start);
  }
  return start;
}

const TRIAL_DAYS = 3;
export function getTrialRemaining(): { days: number; hours: number; expired: boolean } {
  const start = getTrialStart();
  const end = start + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const remainMs = end - Date.now();
  if (remainMs <= 0) return { days: 0, hours: 0, expired: true };
  const days = Math.floor(remainMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remainMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return { days, hours, expired: false };
}

export function isPremium(): boolean {
  return readJSON(KEYS.premium, false);
}
export function setPremium(value: boolean) {
  writeJSON(KEYS.premium, value);
}

// 채널 랭킹 성장률 계산용 이전 스냅샷 저장
export interface RankingSnapshotEntry {
  views: number;
  ts: number;
}
export function getRankingSnapshot(): Record<string, RankingSnapshotEntry> {
  return readJSON(KEYS.rankingSnapshot, {});
}
export function saveRankingSnapshot(map: Record<string, RankingSnapshotEntry>) {
  writeJSON(KEYS.rankingSnapshot, map);
}
