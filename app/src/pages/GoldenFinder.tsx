import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "../lib/categoryPresets";
import { fetchCategoryVideos, subscriberRangeFilter, type EnrichedChannel, type EnrichedVideo } from "../lib/discovery";
import { getApiKey } from "../lib/storage";
import { ApiKeyWarning, EmptyState, ErrorBox, LoadingGrid } from "../components/StateViews";
import { ChannelStatCard, VideoResultCard } from "../components/Cards";
import { RefreshCw } from "lucide-react";

const SUB_RANGES = [
  { id: "all", label: "전체" },
  { id: "0-1man", label: "0~1만 명 (급성장)" },
  { id: "1-5man", label: "1만~5만 명" },
  { id: "5-10man", label: "5만~10만 명" },
];

const SORTS = [
  { id: "views", label: "조회수 높은 순" },
  { id: "subs", label: "구독자 많은 순" },
];

export default function GoldenFinder() {
  const [selected, setSelected] = useState("all");
  const [searched, setSearched] = useState(false);
  const [videoType, setVideoType] = useState<"short" | "long">("short");
  const [subRange, setSubRange] = useState("all");
  const [sort, setSort] = useState("views");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videos, setVideos] = useState<EnrichedVideo[]>([]);
  const [channels, setChannels] = useState<Map<string, EnrichedChannel>>(new Map());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function runSearch(categoryId: string) {
    if (!getApiKey()) {
      setSearched(true);
      setError("YouTube API 키가 필요합니다. 좌측 메뉴의 'YouTube API 키 설정'에서 먼저 등록해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { videos, channels } = await fetchCategoryVideos({
        categoryId,
        videoType,
        publishedWithinDays: 60,
      });
      setVideos(videos);
      setChannels(channels);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  function onPick(id: string) {
    setSelected(id);
    runSearch(id);
  }

  // 영상 타입 토글이 바뀌면 이미 검색한 상태일 때 재검색
  useEffect(() => {
    if (searched) runSearch(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoType]);

  const filteredSorted = useMemo(() => {
    const filterFn = subscriberRangeFilter(subRange);
    const list = videos.filter((v) => filterFn(channels.get(v.channelId)?.subscribers ?? 0));
    list.sort((a, b) => {
      if (sort === "subs") {
        return (channels.get(b.channelId)?.subscribers ?? 0) - (channels.get(a.channelId)?.subscribers ?? 0);
      }
      return b.viewCount - a.viewCount;
    });
    return list;
  }, [videos, channels, subRange, sort]);

  const topChannels = useMemo(() => {
    const byChannel = new Map<string, EnrichedVideo[]>();
    for (const v of filteredSorted) {
      const arr = byChannel.get(v.channelId) ?? [];
      arr.push(v);
      byChannel.set(v.channelId, arr);
    }
    const cards = [...byChannel.entries()]
      .map(([channelId, vids]) => {
        const ch = channels.get(channelId);
        if (!ch) return null;
        const lastUpload = vids.reduce((latest, v) => (v.publishedAt > latest ? v.publishedAt : latest), vids[0].publishedAt);
        const dailyViews = Math.round(vids.reduce((s, v) => s + v.dailyViews, 0) / vids.length);
        const ams = Math.max(...vids.map((v) => v.ams));
        return {
          id: channelId,
          title: ch.title,
          thumbnail: ch.thumbnail,
          subscribers: ch.subscribers,
          totalViews: ch.totalViews,
          lastUploadDate: lastUpload,
          dailyViews,
          ams,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.dailyViews - a.dailyViews)
      .slice(0, 8);
    return cards;
  }, [filteredSorted, channels]);

  const uniqueChannelCount = new Set(filteredSorted.map((v) => v.channelId)).size;

  return (
    <div>
      <ApiKeyWarning />

      <div className="bg-white rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="text-sm font-semibold text-slate-500">관심 주제</span>
          {updatedAt && (
            <span className="text-xs text-slate-400">
              마지막 데이터 갱신: {updatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => onPick("all")}
            className={`h-9 px-4 rounded-full text-sm font-semibold transition-colors ${
              selected === "all"
                ? "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            전체
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className={`h-9 px-4 rounded-full text-sm font-semibold transition-colors ${
                selected === c.id ? `${c.color} text-white` : `bg-slate-100 ${c.textColor} hover:bg-slate-200`
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mb-4 pb-4 border-b border-slate-100">
          <div className="text-sm font-semibold text-slate-500 mb-2">영상 타입</div>
          <div className="flex gap-2">
            {(["short", "long"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setVideoType(t)}
                className={`h-9 px-4 rounded-full text-sm font-semibold ${
                  videoType === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {t === "short" ? "쇼츠" : "롱폼"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-8">
          <div>
            <div className="text-sm font-semibold text-slate-500 mb-2">구독자 구간</div>
            <div className="flex flex-wrap gap-2">
              {SUB_RANGES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSubRange(r.id)}
                  className={`h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap ${
                    subRange === r.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 mb-2">정렬 기준</div>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={`h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap ${
                    sort === s.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {searched && !loading && !error && (
        <div className="mb-5 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-center gap-2 text-sm text-blue-700">
          <RefreshCw className="w-4 h-4" />
          매일 자정 00시(KST)에 새로운 채널로 자동 업데이트됩니다 — 이 클론은 버튼을 누를 때마다 실시간으로 다시 검색합니다.
        </div>
      )}

      {!searched && <EmptyState icon="👆" title="관심 주제를 선택해 주세요" subtitle={"카테고리를 누르면 유튜브에서 검색한 채널을 즉시 보여드려요"} />}

      {searched && loading && <LoadingGrid label="유튜브에서 채널을 찾는 중..." />}
      {searched && !loading && error && <ErrorBox message={error} />}

      {searched && !loading && !error && filteredSorted.length === 0 && (
        <EmptyState icon="🔍" title="조건에 맞는 결과가 없습니다" subtitle="필터를 조정해보세요" />
      )}

      {searched && !loading && !error && filteredSorted.length > 0 && (
        <>
          <div className="text-sm text-slate-500 mb-3">
            발견된 영상 <b className="text-slate-900">{filteredSorted.length}개</b> (채널 {uniqueChannelCount}개)
          </div>

          {topChannels.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
              {topChannels.map((c) => (
                <ChannelStatCard key={c.id} data={c} />
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredSorted.map((v) => (
              <VideoResultCard
                key={v.videoId}
                data={{
                  videoId: v.videoId,
                  title: v.title,
                  thumbnail: v.thumbnail,
                  channelId: v.channelId,
                  channelTitle: v.channelTitle,
                  channelThumbnail: channels.get(v.channelId)?.thumbnail ?? "",
                  subscribers: channels.get(v.channelId)?.subscribers ?? 0,
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
