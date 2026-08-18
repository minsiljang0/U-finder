import { CATEGORIES } from "./categoryPresets";
import { getChannelsById, getVideosById, isShort, searchVideos, thumbOf } from "./youtube";
import { computeDailyViews, daysSince } from "./ams";

export interface RankedChannel {
  id: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  isShort: boolean;
  dailyViews: number;
  weeklyViews: number;
  monthlyViews: number;
}

/**
 * 채널 랭킹은 원본처럼 시계열 DB가 없으므로, 카테고리 프리셋 몇 개를 순회 검색해
 * 최근 인기 영상들을 모으고 채널 단위로 집계해 "일간 조회수"를 근사한다.
 * 7일/30일 조회수는 일간 조회수 * 7 / * 30 으로 단순 추정한 근사치다 (PLAN.md §0 명시).
 */
export async function fetchChannelRanking(opts: { maxCategories?: number }): Promise<RankedChannel[]> {
  const cats = CATEGORIES.slice(0, opts.maxCategories ?? 5);
  const publishedAfter = new Date(Date.now() - 14 * 86400000).toISOString();

  // videoDuration을 지정하지 않고 검색하면 "쇼츠/롱폼" 실제 비중과 무관하게 조회수가 높은
  // 쪽으로만 쏠려서 타입 필터가 사실상 무의미해지는 문제가 있었다. 쇼츠/롱폼을 각각 따로
  // 검색해 채널별로 정확히 집계한다.
  const searchResults = await Promise.all(
    cats.flatMap((c) => [
      searchVideos({ q: c.queries[0], order: "viewCount", publishedAfter, videoDuration: "short", maxResults: 8 })
        .then((r) => r.items)
        .catch(() => []),
      searchVideos({ q: c.queries[0], order: "viewCount", publishedAfter, videoDuration: "long", maxResults: 8 })
        .then((r) => r.items)
        .catch(() => []),
    ])
  );
  const videoIds = [...new Set(searchResults.flat().map((it) => it.id.videoId!).filter(Boolean))];
  const videos = await getVideosById(videoIds);
  const channelIds = [...new Set(videos.map((v) => v.snippet.channelId))];
  const channels = await getChannelsById(channelIds);
  const channelMap = new Map(channels.map((c) => [c.id, c]));

  const byChannel = new Map<string, { dailyViewsSum: number; shortCount: number; longCount: number }>();
  for (const v of videos) {
    const views = Number(v.statistics.viewCount ?? 0);
    const days = daysSince(v.snippet.publishedAt);
    const dv = computeDailyViews(views, days);
    const entry = byChannel.get(v.snippet.channelId) ?? { dailyViewsSum: 0, shortCount: 0, longCount: 0 };
    entry.dailyViewsSum += dv;
    if (isShort(v)) entry.shortCount += 1;
    else entry.longCount += 1;
    byChannel.set(v.snippet.channelId, entry);
  }

  const ranked: RankedChannel[] = [...byChannel.entries()]
    .map(([id, agg]) => {
      const ch = channelMap.get(id);
      if (!ch) return null;
      const dailyViews = Math.round(agg.dailyViewsSum);
      return {
        id,
        title: ch.snippet.title,
        thumbnail: thumbOf(ch.snippet),
        subscribers: Number(ch.statistics.subscriberCount ?? 0),
        isShort: agg.shortCount >= agg.longCount,
        dailyViews,
        weeklyViews: dailyViews * 7,
        monthlyViews: dailyViews * 30,
      } satisfies RankedChannel;
    })
    .filter((c): c is RankedChannel => c !== null)
    .sort((a, b) => b.dailyViews - a.dailyViews);

  return ranked;
}
