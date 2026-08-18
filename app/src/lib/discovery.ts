// 황금 채널 발굴기 / 채널 랭킹에서 공유하는 "카테고리 검색 → 영상/채널 집계" 로직.

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
}): Promise<{ videos: EnrichedVideo[]; channels: Map<string, EnrichedChannel> }> {
  const queries = queriesForCategory(opts.categoryId).slice(0, opts.maxQueries ?? 3);
  const publishedAfter = new Date(Date.now() - opts.publishedWithinDays * 86400000).toISOString();

  const searchResults = await Promise.all(
    queries.map((q) =>
      searchVideos({
        q,
        order: "viewCount",
        publishedAfter,
        maxResults: opts.perQuery ?? 16,
      }).catch(() => [])
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

  return { videos: enriched, channels };
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
