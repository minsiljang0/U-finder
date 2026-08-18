import { getChannelsById, getMostPopular, isShort, thumbOf, type YtVideo } from "./youtube";
import { hoursSince } from "./ams";
import { getRankingSnapshot, saveRankingSnapshot, type RankingSnapshotEntry } from "./storage";

export type TrendStatus = "신규" | "상승" | "하락" | "유지";

export interface TrendingItem {
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  channelThumbnail: string;
  subscribers: number;
  viewCount: number;
  publishedAt: string;
  growthPerHour: number;
  rank: number;
  hot: boolean;
  status: TrendStatus;
  isShort: boolean;
}

export async function fetchTrending(): Promise<{ items: TrendingItem[]; counts: Record<TrendStatus, number> }> {
  const videos = await getMostPopular({ maxResults: 50 });
  const channelIds = [...new Set(videos.map((v) => v.snippet.channelId))];
  const channels = await getChannelsById(channelIds);
  const channelMap = new Map(channels.map((c) => [c.id, c]));

  const prevSnapshot = getRankingSnapshot();
  const nextSnapshot: Record<string, RankingSnapshotEntry> = {};

  const withVelocity = videos.map((v: YtVideo) => {
    const views = Number(v.statistics.viewCount ?? 0);
    const hours = hoursSince(v.snippet.publishedAt);
    const growthPerHour = views / hours;
    nextSnapshot[v.id] = { views, ts: Date.now() };

    let status: TrendStatus = "신규";
    const prev = prevSnapshot[v.id];
    if (prev) {
      const delta = views - prev.views;
      const elapsedH = Math.max(0.25, (Date.now() - prev.ts) / 3_600_000);
      const deltaPerHour = delta / elapsedH;
      if (deltaPerHour > growthPerHour * 0.15) status = "상승";
      else if (deltaPerHour < growthPerHour * 0.02) status = "하락";
      else status = "유지";
    }

    const ch = channelMap.get(v.snippet.channelId);
    return {
      video: v,
      views,
      growthPerHour,
      status,
      subscribers: Number(ch?.statistics.subscriberCount ?? 0),
      channelThumbnail: ch ? thumbOf(ch.snippet) : "",
    };
  });

  saveRankingSnapshot(nextSnapshot);

  withVelocity.sort((a, b) => b.growthPerHour - a.growthPerHour);
  const avgGrowth = withVelocity.reduce((s, v) => s + v.growthPerHour, 0) / (withVelocity.length || 1);

  const items: TrendingItem[] = withVelocity.map((v, idx) => ({
    videoId: v.video.id,
    title: v.video.snippet.title,
    thumbnail: thumbOf(v.video.snippet),
    channelId: v.video.snippet.channelId,
    channelTitle: v.video.snippet.channelTitle,
    channelThumbnail: v.channelThumbnail,
    subscribers: v.subscribers,
    viewCount: v.views,
    publishedAt: v.video.snippet.publishedAt,
    growthPerHour: Math.round(v.growthPerHour),
    rank: idx + 1,
    hot: v.growthPerHour > avgGrowth * 1.8,
    status: v.status,
    isShort: isShort(v.video),
  }));

  const counts: Record<TrendStatus, number> = { 신규: 0, 상승: 0, 하락: 0, 유지: 0 };
  for (const it of items) counts[it.status]++;

  return { items, counts };
}
