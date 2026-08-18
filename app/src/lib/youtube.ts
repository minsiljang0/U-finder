// YouTube Data API v3 클라이언트. 사용자 본인의 API 키(BYOK)로 브라우저에서 직접 호출한다.
// 원본 golden-finder.com의 "조회수 폭발 쇼츠 찾기" 기능과 동일한 방식(사용자 키 필요).

import { getApiKey } from "./storage";

const BASE = "https://www.googleapis.com/youtube/v3";

export class YoutubeApiError extends Error {
  status?: number;
  reason?: string;
  constructor(message: string, status?: number, reason?: string) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

async function apiGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const key = getApiKey();
  if (!key) {
    throw new YoutubeApiError("YouTube API 키가 등록되지 않았습니다.", 401, "missingKey");
  }
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const reason = body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? "unknown";
    const message =
      reason === "quotaExceeded"
        ? "오늘의 YouTube API 할당량을 모두 사용했습니다. 내일 다시 시도해주세요."
        : reason === "keyInvalid" || res.status === 400
          ? "YouTube API 키가 올바르지 않습니다. 키 설정을 다시 확인해주세요."
          : `YouTube API 오류 (${res.status}): ${body?.error?.message ?? res.statusText}`;
    throw new YoutubeApiError(message, res.status, reason);
  }
  return res.json() as Promise<T>;
}

export interface YtSearchItem {
  id: { videoId?: string; channelId?: string };
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: { medium?: { url: string }; high?: { url: string }; default?: { url: string } };
  };
}

export interface YtVideo {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: { medium?: { url: string }; high?: { url: string }; default?: { url: string } };
    tags?: string[];
  };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration: string };
}

export interface YtChannel {
  id: string;
  snippet: {
    title: string;
    thumbnails: { medium?: { url: string }; high?: { url: string }; default?: { url: string } };
    publishedAt: string;
  };
  statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
}

export async function searchVideos(opts: {
  q: string;
  order?: "viewCount" | "date" | "relevance" | "rating";
  publishedAfter?: string;
  videoDuration?: "short" | "long" | "any";
  maxResults?: number;
  regionCode?: string;
  pageToken?: string;
}): Promise<{ items: YtSearchItem[]; nextPageToken?: string }> {
  const data = await apiGet<{ items: YtSearchItem[]; nextPageToken?: string }>("search", {
    part: "snippet",
    type: "video",
    q: opts.q,
    order: opts.order ?? "viewCount",
    publishedAfter: opts.publishedAfter,
    videoDuration: opts.videoDuration ?? "any",
    maxResults: opts.maxResults ?? 25,
    regionCode: opts.regionCode ?? "KR",
    relevanceLanguage: "ko",
    pageToken: opts.pageToken,
  });
  return { items: data.items.filter((it) => it.id.videoId), nextPageToken: data.nextPageToken };
}

/** 여러 페이지를 순회하며 조회수 범위처럼 "전체 후보 중 일부"를 걸러야 하는 검색에 사용.
 * order=viewCount로 검색하면 상위 조회수 영상만 반환되어 낮은 조회수 구간 필터와 결합 시
 * 결과가 0개가 되는 문제가 있어, 대표성 있는 후보군을 모으기 위해 페이지네이션한다. */
export async function searchVideosMultiPage(
  opts: Omit<Parameters<typeof searchVideos>[0], "pageToken">,
  pages = 3
): Promise<YtSearchItem[]> {
  const all: YtSearchItem[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < pages; i++) {
    const { items, nextPageToken } = await searchVideos({ ...opts, pageToken });
    all.push(...items);
    if (!nextPageToken) break;
    pageToken = nextPageToken;
  }
  return all;
}

export async function getVideosById(ids: string[]): Promise<YtVideo[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const results: YtVideo[] = [];
  for (const chunk of chunks) {
    const data = await apiGet<{ items: YtVideo[] }>("videos", {
      part: "snippet,statistics,contentDetails",
      id: chunk.join(","),
    });
    results.push(...data.items);
  }
  return results;
}

export async function getChannelsById(ids: string[]): Promise<YtChannel[]> {
  const uniq = [...new Set(ids)];
  if (uniq.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < uniq.length; i += 50) chunks.push(uniq.slice(i, i + 50));
  const results: YtChannel[] = [];
  for (const chunk of chunks) {
    const data = await apiGet<{ items: YtChannel[] }>("channels", {
      part: "snippet,statistics",
      id: chunk.join(","),
    });
    results.push(...data.items);
  }
  return results;
}

export async function getMostPopular(opts: {
  regionCode?: string;
  videoCategoryId?: string;
  maxResults?: number;
}): Promise<YtVideo[]> {
  const data = await apiGet<{ items: YtVideo[] }>("videos", {
    part: "snippet,statistics,contentDetails",
    chart: "mostPopular",
    regionCode: opts.regionCode ?? "KR",
    videoCategoryId: opts.videoCategoryId,
    maxResults: opts.maxResults ?? 50,
  });
  return data.items;
}

/** 키 유효성 검증용 가벼운 호출 (quota 1). */
export async function verifyApiKey(key: string): Promise<{ ok: boolean; message?: string }> {
  const url = new URL(`${BASE}/videos`);
  url.searchParams.set("key", key);
  url.searchParams.set("part", "id");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("regionCode", "KR");
  try {
    const res = await fetch(url.toString());
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") return { ok: true, message: "키는 유효하지만 오늘 할당량을 모두 사용했습니다." };
    return { ok: false, message: body?.error?.message ?? "키가 유효하지 않습니다." };
  } catch {
    return { ok: false, message: "네트워크 오류로 키를 확인할 수 없습니다." };
  }
}

/** ISO8601 duration(PT1M3S 등)을 초 단위로 변환. 쇼츠(<=60s) 판별용. */
export function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return h * 3600 + min * 60 + s;
}

export function isShort(video: YtVideo): boolean {
  if (!video.contentDetails?.duration) return false;
  return parseDurationSeconds(video.contentDetails.duration) <= 60;
}

export function thumbOf(item: { thumbnails: { medium?: { url: string }; high?: { url: string }; default?: { url: string } } }): string {
  return item.thumbnails.high?.url ?? item.thumbnails.medium?.url ?? item.thumbnails.default?.url ?? "";
}
