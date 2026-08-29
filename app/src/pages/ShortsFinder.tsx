import { useState } from "react";
import { Rocket, Search, UserSearch } from "lucide-react";
import { getVideosById, isShort, searchVideosMultiPage, thumbOf, resolveChannelId, getChannelVideos } from "../lib/youtube";
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
  const [mode, setMode] = useState<"keyword" | "channel">("keyword");
  const [q, setQ] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [upload, setUpload] = useState("1w");
  const [maxSub, setMaxSub] = useState("none");
  const [viewRange, setViewRange] = useState("1-5w");
  const [sort, setSort] = useState("views");

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<(EnrichedVideo & { subscribers: number; channelThumbnail: string })[]>([]);
  const [channelInfo, setChannelInfo] = useState<{ title: string; subscribers: number } | null>(null);

  async function runChannelSearch() {
    if (!getApiKey()) {
      setSearched(true);
      setError("YouTube API 키가 필요합니다. 좌측 메뉴의 'YouTube API 키 설정'에서 먼저 등록해주세요.");
      return;
    }
    if (!channelInput.trim()) {
      setSearched(true);
      setError("채널 URL, @핸들, 또는 채널ID를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    setChannelInfo(null);
    try {
      const channelId = await resolveChannelId(channelInput.trim());
      const items = await getChannelVideos({ channelId, maxResults: 20, order: sort === "date" ? "date" : "viewCount" });
      const videoIds = [...new Set(items.map((i) => i.id.videoId!).filter(Boolean))];
      const videos = await getVideosById(videoIds);
      const [channel] = await getChannelsById([channelId]);
      if (channel) setChannelInfo({ title: channel.snippet.title, subscribers: Number(channel.statistics.subscriberCount ?? 0) });

      const enriched = videos.map((v) => {
        const views = Number(v.statistics.viewCount ?? 0);
        const days = daysSince(v.snippet.publishedAt);
        const dailyViews = computeDailyViews(views, days);
        const subs = Number(channel?.statistics.subscriberCount ?? 0);
        return {
          videoId: v.id,
          title: v.snippet.title,
          thumbnail: thumbOf(v.snippet),
          channelId: v.snippet.channelId,
          channelTitle: v.snippet.channelTitle,
          channelThumbnail: channel ? thumbOf(channel.snippet) : "",
          publishedAt: v.snippet.publishedAt,
          viewCount: views,
          dailyViews,
          subscribers: subs,
          ams: computeAmsScore({ dailyViews, subscribers: subs, daysSinceUpload: days }),
          velocity: views / hoursSince(v.snippet.publishedAt),
        };
      });
      setResults(enriched.sort((a, b) => b.viewCount - a.viewCount));
    } catch (e) {
      setError(e instanceof Error ? e.message : "채널 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

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
      // order=viewCount로 가져오면 최상위 조회수 영상만 반환되어, 낮은 조회수 구간 필터와
      // 결합할 때 결과가 0개가 되는 문제가 있었다. order=date + 여러 페이지로 대표성 있는
      // 후보군을 모은 뒤, 최종 정렬은 아래에서 조회수 범위로 거른 다음 따로 적용한다.
      const items = await searchVideosMultiPage(
        {
          q: q.trim() || "쇼츠",
          order: "date",
          publishedAfter,
          videoDuration: "short",
          maxResults: 50,
        },
        3
      );
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
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("keyword")}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 ${mode === "keyword" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500"}`}
          >
            <Search className="w-3.5 h-3.5" /> 키워드
          </button>
          <button
            onClick={() => setMode("channel")}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 ${mode === "channel" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500"}`}
          >
            <UserSearch className="w-3.5 h-3.5" /> 채널
          </button>
        </div>

        {mode === "keyword" ? (
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="검색어를 입력하세요 (예: 요리, 운동, 재테크...)"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        ) : (
          <div className="relative mb-4">
            <UserSearch className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runChannelSearch()}
              placeholder="채널 URL, @핸들, 또는 채널ID (예: youtube.com/@mkbhd)"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        )}

        {mode === "keyword" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Select label="📅 업로드 일자" value={upload} onChange={setUpload} options={UPLOAD_OPTS.map((o) => ({ id: o.id, label: o.label }))} />
            <Select label="👤 최대 구독자" value={maxSub} onChange={setMaxSub} options={MAX_SUB_OPTS.map((o) => ({ id: o.id, label: o.label }))} />
            <Select label="👁 조회수 범위" value={viewRange} onChange={setViewRange} options={VIEW_RANGE_OPTS.map((o) => ({ id: o.id, label: o.label }))} />
            <Select label="⇅ 정렬" value={sort} onChange={setSort} options={SORT_OPTS.map((o) => ({ id: o.id, label: o.label }))} />
          </div>
        )}

        <button
          onClick={mode === "keyword" ? runSearch : runChannelSearch}
          disabled={loading}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Rocket className="w-4 h-4" />
          {mode === "keyword" ? "떡상 쇼츠 발굴 시작" : "채널 영상 가져오기"}
        </button>
      </div>

      {channelInfo && (
        <div className="bg-slate-900 text-white rounded-xl px-4 py-3 mb-4 text-sm">
          <b>{channelInfo.title}</b> · 구독자 {channelInfo.subscribers.toLocaleString()}명
        </div>
      )}

      {!searched && (
        <EmptyState
          icon="🚀"
          title={mode === "keyword" ? "조건을 설정하고 발굴을 시작하세요" : "채널을 지정해서 영상을 모아보세요"}
          subtitle={mode === "keyword" ? "검색어와 필터를 입력한 뒤 버튼을 누르면 실시간으로 유튜브를 검색합니다" : "채널 URL이나 @핸들을 입력하면 그 채널의 영상만 가져옵니다"}
        />
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
        className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
