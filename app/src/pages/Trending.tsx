import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchTrending, type TrendingItem, type TrendStatus } from "../lib/trending";
import { getApiKey } from "../lib/storage";
import { ApiKeyWarning, EmptyState, ErrorBox, LoadingGrid } from "../components/StateViews";
import { VideoResultCard } from "../components/Cards";

const TYPE_TABS = [
  { id: "short", label: "쇼츠" },
  { id: "long", label: "롱폼" },
  { id: "all", label: "전체" },
];

const SORT_TABS = [
  { id: "growth", label: "🔥 급등순" },
  { id: "views", label: "👁 조회수순" },
  { id: "date", label: "🕐 최신순" },
];

const STATUS_COLORS: Record<TrendStatus, string> = {
  신규: "text-indigo-600",
  상승: "text-emerald-600",
  하락: "text-red-500",
  유지: "text-slate-400",
};

export default function Trending() {
  const [type, setType] = useState("short");
  const [sort, setSort] = useState("growth");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [counts, setCounts] = useState<Record<TrendStatus, number> | null>(null);

  async function load() {
    if (!getApiKey()) {
      setError("YouTube API 키가 필요합니다. 좌측 메뉴의 'YouTube API 키 설정'에서 먼저 등록해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { items, counts } = await fetchTrending();
      setItems(items);
      setCounts(counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = items
    .filter((it) => (type === "all" ? true : type === "short" ? it.isShort : !it.isShort))
    .slice()
    .sort((a, b) => {
      if (sort === "views") return b.viewCount - a.viewCount;
      if (sort === "date") return a.publishedAt < b.publishedAt ? 1 : -1;
      return a.rank - b.rank;
    });

  return (
    <div>
      <ApiKeyWarning />

      <div className="bg-white rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-slate-100 rounded-full p-1">
          {TYPE_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`h-8 px-4 rounded-full text-sm font-semibold ${type === t.id ? "bg-slate-900 text-white" : "text-slate-500"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {SORT_TABS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={`h-8 px-3 rounded-full text-sm font-semibold whitespace-nowrap ${
                sort === s.id ? "bg-orange-100 text-orange-600" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {counts && (
          <div className="flex items-center gap-3 text-xs text-slate-500 ml-1">
            {(Object.keys(counts) as TrendStatus[]).map((k) => (
              <span key={k} className={`font-semibold ${STATUS_COLORS[k]}`}>
                {k} {counts[k]}
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-slate-400">총 {filtered.length}개</span>
          <button onClick={load} className="flex items-center gap-1 text-slate-500 hover:text-slate-800">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 새로고침
          </button>
        </div>
      </div>

      {loading && <LoadingGrid label="급등하는 영상을 찾는 중..." />}
      {!loading && error && <ErrorBox message={error} />}
      {!loading && !error && filtered.length === 0 && <EmptyState icon="🔥" title="표시할 영상이 없습니다" />}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((v) => (
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
                rank: v.rank,
                growthPerHour: v.growthPerHour,
                hot: v.hot,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
