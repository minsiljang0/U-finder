// 로컬 전용(개인 사용) 데이터 저장소. 원본의 Supabase/Clerk 대신 localStorage 사용.

const KEYS = {
  apiKey: "sf.youtubeApiKey",
  favChannels: "sf.favChannels",
  favVideos: "sf.favVideos",
  favKeywords: "sf.favKeywords",
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

export interface FavChannel {
  id: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  savedAt: number;
}

export interface FavVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  savedAt: number;
}

export interface FavKeyword {
  keyword: string;
  savedAt: number;
}

export function getFavChannels(): FavChannel[] {
  return readJSON(KEYS.favChannels, []);
}
export function toggleFavChannel(channel: FavChannel): boolean {
  const list = getFavChannels();
  const idx = list.findIndex((c) => c.id === channel.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeJSON(KEYS.favChannels, list);
    return false;
  }
  list.unshift(channel);
  writeJSON(KEYS.favChannels, list);
  return true;
}
export function isFavChannel(id: string): boolean {
  return getFavChannels().some((c) => c.id === id);
}

export function getFavVideos(): FavVideo[] {
  return readJSON(KEYS.favVideos, []);
}
export function toggleFavVideo(video: FavVideo): boolean {
  const list = getFavVideos();
  const idx = list.findIndex((v) => v.id === video.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeJSON(KEYS.favVideos, list);
    return false;
  }
  list.unshift(video);
  writeJSON(KEYS.favVideos, list);
  return true;
}
export function isFavVideo(id: string): boolean {
  return getFavVideos().some((v) => v.id === id);
}

export function getFavKeywords(): FavKeyword[] {
  return readJSON(KEYS.favKeywords, []);
}
export function toggleFavKeyword(keyword: string): boolean {
  const list = getFavKeywords();
  const idx = list.findIndex((k) => k.keyword === keyword);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeJSON(KEYS.favKeywords, list);
    return false;
  }
  list.unshift({ keyword, savedAt: Date.now() });
  writeJSON(KEYS.favKeywords, list);
  return true;
}

export function removeFavKeyword(keyword: string) {
  const list = getFavKeywords().filter((k) => k.keyword !== keyword);
  writeJSON(KEYS.favKeywords, list);
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
