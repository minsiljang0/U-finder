// 슈퍼 채널 발굴기 / 채널 랭킹에서 공유하는 "카테고리 검색 → 영상/채널 집계" 로직.

import { CATEGORIES, getCategory } from "./categoryPresets";
import {
  getChannelsById,
  getVideosById,
  isShort,
  searchVideos,
  thumbOf,
  type YtChannel,
  type YtVideo,
} from "./youtube";
import { computeAmsScore, computeDailyViews, daysSince } from "./ams";

export interface EnrichedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  dailyViews: number;
  ams: number;
}

export interface EnrichedChannel {
  id: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  totalViews: number;
}

const ALL_QUERIES = ["요즘 뜨는 쇼츠", "인기 급상승 영상", "화제의 채널"];

// 원본 사이트 UI 문구("구독자 20만명 미만 채널 중... 카테고리당 30개 미만일 경우
// 50만→30만→10만→5만 조회수 순으로 기준을 낮춰 보충")를 그대로 재현한 실제 필터링 로직.
export const SUBSCRIBER_CAP = 200_000;
export const MIN_RESULTS = 30;
export const VIEW_THRESHOLD_TIERS = [500_000, 300_000, 100_000, 50_000];

export function queriesForCategory(categoryId: string): string[] {
  if (categoryId === "all") return ALL_QUERIES;
  return getCategory(categoryId)?.queries ?? ALL_QUERIES;
}

export async function fetchCategoryVideos(opts: {
  categoryId: string;
  videoType: "short" | "long";
  publishedWithinDays: number;
  maxQueries?: number;
  perQuery?: number;
}): Promise<{ videos: EnrichedVideo[]; channels: Map<string, EnrichedChannel>; viewThresholdUsed: number }> {
  const queries = queriesForCategory(opts.categoryId).slice(0, opts.maxQueries ?? 3);
  const publishedAfter = new Date(Date.now() - opts.publishedWithinDays * 86400000).toISOString();

  const searchResults = await Promise.all(
    queries.map((q) =>
      searchVideos({
        q,
        order: "viewCount",
        publishedAfter,
        maxResults: opts.perQuery ?? 16,
      })
        .then((r) => r.items)
        .catch(() => [])
    )
  );

  const videoIds = [...new Set(searchResults.flat().map((it) => it.id.videoId!).filter(Boolean))];
  const videos = await getVideosById(videoIds);

  const durationFiltered = videos.filter((v) => (opts.videoType === "short" ? isShort(v) : !isShort(v)));

  const channelIds = [...new Set(durationFiltered.map((v) => v.snippet.channelId))];
  const channelList = await getChannelsById(channelIds);
  const channels = new Map<string, EnrichedChannel>();
  for (const c of channelList) {
    channels.set(c.id, {
      id: c.id,
      title: c.snippet.title,
      thumbnail: thumbOf(c.snippet),
      subscribers: Number(c.statistics.subscriberCount ?? 0),
      totalViews: Number(c.statistics.viewCount ?? 0),
    });
  }

  const enriched: EnrichedVideo[] = durationFiltered.map((v) => {
    const views = Number(v.statistics.viewCount ?? 0);
    const days = daysSince(v.snippet.publishedAt);
    const dailyViews = computeDailyViews(views, days);
    const subs = channels.get(v.snippet.channelId)?.subscribers ?? 0;
    return {
      videoId: v.id,
      title: v.snippet.title,
      thumbnail: thumbOf(v.snippet),
      channelId: v.snippet.channelId,
      channelTitle: v.snippet.channelTitle,
      publishedAt: v.snippet.publishedAt,
      viewCount: views,
      dailyViews,
      ams: computeAmsScore({ dailyViews, subscribers: subs, daysSinceUpload: days }),
    };
  });

  // 구독자 20만명 미만 채널만 우선 수집.
  const underCap = enriched.filter((v) => (channels.get(v.channelId)?.subscribers ?? 0) < SUBSCRIBER_CAP);

  // 카테고리당 30개 미만이면 조회수 기준을 50만 → 30만 → 10만 → 5만 순으로 낮춰가며 보충.
  let selected = underCap.filter((v) => v.viewCount >= VIEW_THRESHOLD_TIERS[0]);
  let viewThresholdUsed = VIEW_THRESHOLD_TIERS[0];
  for (const tier of VIEW_THRESHOLD_TIERS.slice(1)) {
    if (selected.length >= MIN_RESULTS) break;
    selected = underCap.filter((v) => v.viewCount >= tier);
    viewThresholdUsed = tier;
  }
  // 최하위 기준으로도 30개가 안 되면, 그 기준을 만족하는 전체(=selected)를 그대로 사용.

  return { videos: selected, channels, viewThresholdUsed };
}

export function subscriberRangeFilter(range: string) {
  return (subs: number) => {
    switch (range) {
      case "0-1man":
        return subs <= 10_000;
      case "1-5man":
        return subs > 10_000 && subs <= 50_000;
      case "5-10man":
        return subs > 50_000 && subs <= 100_000;
      default:
        return true;
    }
  };
}

export function allCategoryIds(): string[] {
  return CATEGORIES.map((c) => c.id);
}

export type { YtChannel, YtVideo };
