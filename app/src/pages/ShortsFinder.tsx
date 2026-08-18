import { useState } from "react";
import { Rocket, Search } from "lucide-react";
import { getVideosById, isShort, searchVideos, thumbOf } from "../lib/youtube";
import { getApiKey } from "../lib/storage";
import { computeAmsScore, computeDailyViews, daysSince, hoursSince } from "../lib/ams";
import { ApiKeyWarning, EmptyState, ErrorBox, LoadingGrid } from "../components/StateViews";
import { VideoResultCard } from "../components/Cards";
import type { EnrichedVideo } from "../lib/discovery";
import { getChannelsById } from "../lib/youtube";

const UPLOAD_OPTS = [
  { id: "1d", label: "최근 24시간", days: 1 },
  { id: "1w", label: "최근 1주일", days: 7 },
  { id: "1m", label: "최근 1개월", days: 30 },
  { id: "6m", label: "최근 6개월", days: 182 },
  { id: "12m", label: "최근 12개월", days: 365 },
];

const MAX_SUB_OPTS = [
  { id: "none", label: "제한 없음", value: Infinity },
  { id: "1k", label: "1천명 이하", value: 1_000 },
  { id: "10k", label: "1만명 이하", value: 10_000 },
  { id: "50k", label: "5만명 이하", value: 50_000 },
];

const VIEW_RANGE_OPTS = [
  { id: "1-5w", label: "1만 ~ 5만회", min: 10_000, max: 50_000 },
  { id: "5-10w", label: "5만 ~ 10만회", min: 50_000, max: 100_000 },
  { id: "10-30w", label: "10만 ~ 30만회", min: 100_000, max: 300_000 },
  { id: "30-100w", label: "30만 ~ 100만회", min: 300_000, max: 1_000_000 },
  { id: "100w+", label: "100만회 이상", min: 1_000_000, max: Infinity },
];

const SORT_OPTS = [
  { id: "views", label: "조회수 높은순" },
  { id: "date", label: "최신순" },
  { id: "velocity", label: "빠르게 뜬 순" },
];

export default function ShortsFinder() {
  const [q, setQ] = useState("");
  const [upload, setUpload] = useState("1w");
  const [maxSub, setMaxSub] = useState("none");
  const [viewRange, setViewRange] = useState("1-5w");
  const [sort, setSort] = useState("views");

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<(EnrichedVideo & { subscribers: number; channelThumbnail: string })[]>([]);

  async function runSearch() {
    if (!getApiKey()) {
      setSearched(true);
      setError("YouTube API 키가 필요합니다. 좌측 메뉴의 'YouTube API 키 설정'에서 먼저 등록해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const uploadOpt = UPLOAD_OPTS.find((u) => u.id === upload)!;
      const publishedAfter = new Date(Date.now() - uploadOpt.days * 86400000).toISOString();
      const items = await searchVideos({
        q: q.trim() || "쇼츠",
        order: sort === "date" ? "date" : "viewCount",
        publishedAfter,
        videoDuration: "short",
        maxResults: 30,
      });
      const videoIds = [...new Set(items.map((i) => i.id.videoId!).filter(Boolean))];
      const videos = await getVideosById(videoIds);
      const shorts = videos.filter(isShort);
      const channelIds = [...new Set(shorts.map((v) => v.snippet.channelId))];
      const channelList = await getChannelsById(channelIds);
      const channelMap = new Map(channelList.map((c) => [c.id, c]));

      const maxSubVal = MAX_SUB_OPTS.find((m) => m.id === maxSub)!.value;
      const range = VIEW_RANGE_OPTS.find((r) => r.id === viewRange)!;

      let enriched = shorts
        .map((v) => {
          const views = Number(v.statistics.viewCount ?? 0);
          const days = daysSince(v.snippet.publishedAt);
          const dailyViews = computeDailyViews(views, days);
          const ch = channelMap.get(v.snippet.channelId);
          const subs = Number(ch?.statistics.subscriberCount ?? 0);
          return {
            videoId: v.id,
            title: v.snippet.title,
            thumbnail: thumbOf(v.snippet),
            channelId: v.snippet.channelId,
            channelTitle: v.snippet.channelTitle,
            channelThumbnail: ch ? thumbOf(ch.snippet) : "",
            publishedAt: v.snippet.publishedAt,
            viewCount: views,
            dailyViews,
            subscribers: subs,
            ams: computeAmsScore({ dailyViews, subscribers: subs, daysSinceUpload: days }),
            velocity: views / hoursSince(v.snippet.publishedAt),
          };
        })
        .filter((v) => v.subscribers <= maxSubVal)
        .filter((v) => v.viewCount >= range.min && v.viewCount < range.max);

      if (sort === "velocity") {
        enriched = enriched.sort((a, b) => b.velocity - a.velocity);
      } else if (sort === "date") {
        enriched = enriched.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
      } else {
        enriched = enriched.sort((a, b) => b.viewCount - a.viewCount);
      }

      setResults(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <ApiKeyWarning />

      <div className="bg-white rounded-2xl p-5 mb-5">
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="검색어를 입력하세요 (예: 요리, 운동, 재테크...)"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Select label="📅 업로드 일자" value={upload} onChange={setUpload} options={UPLOAD_OPTS.map((o) => ({ id: o.id, label: o.label }))} />
          <Select label="👤 최대 구독자" value={maxSub} onChange={setMaxSub} options={MAX_SUB_OPTS.map((o) => ({ id: o.id, label: o.label }))} />
          <Select label="👁 조회수 범위" value={viewRange} onChange={setViewRange} options={VIEW_RANGE_OPTS.map((o) => ({ id: o.id, label: o.label }))} />
          <Select label="⇅ 정렬" value={sort} onChange={setSort} options={SORT_OPTS.map((o) => ({ id: o.id, label: o.label }))} />
        </div>
        <button
          onClick={runSearch}
          disabled={loading}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Rocket className="w-4 h-4" />
          떡상 쇼츠 발굴 시작
        </button>
      </div>

      {!searched && (
        <EmptyState icon="🚀" title="조건을 설정하고 발굴을 시작하세요" subtitle="검색어와 필터를 입력한 뒤 버튼을 누르면 실시간으로 유튜브를 검색합니다" />
      )}
      {searched && loading && <LoadingGrid label="쇼츠를 발굴하는 중..." />}
      {searched && !loading && error && <ErrorBox message={error} />}
      {searched && !loading && !error && results.length === 0 && (
        <EmptyState icon="🔍" title="조건에 맞는 쇼츠가 없습니다" subtitle="필터를 완화해보세요" />
      )}
      {searched && !loading && !error && results.length > 0 && (
        <>
          <div className="text-sm text-slate-500 mb-3">
            발굴된 쇼츠 <b className="text-slate-900">{results.length}개</b>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {results.map((v) => (
              <VideoResultCard
                key={v.videoId}
                data={{
                  videoId: v.videoId,
                  title: v.title,
                  thumbnail: v.thumbnail,
                  channelId: v.channelId,
                  channelTitle: v.channelTitle,
                  channelThumbnail: v.channelThumbnail,
                  subscribers: v.subscribers,
                  viewCount: v.viewCount,
                  publishedAt: v.publishedAt,
                  dailyViews: v.dailyViews,
                  ams: v.ams,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-500 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
