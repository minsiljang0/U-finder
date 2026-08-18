import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ChevronRight, X, ExternalLink } from "lucide-react";
import { fetchChannelRanking, type RankedChannel } from "../lib/ranking";
import { getApiKey } from "../lib/storage";
import { ApiKeyWarning, EmptyState, ErrorBox, LoadingGrid } from "../components/StateViews";
import { formatCount } from "../lib/ams";

const PERIODS = [
  { id: "24h", label: "24시간" },
  { id: "7d", label: "7일" },
  { id: "30d", label: "30일" },
  { id: "accel", label: "가속도" },
];

const TYPES = [
  { id: "all", label: "전체" },
  { id: "short", label: "쇼츠" },
  { id: "long", label: "롱폼" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ChannelRanking() {
  const [period, setPeriod] = useState("24h");
  const [type, setType] = useState("all");
  const [under1m, setUnder1m] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RankedChannel[]>([]);
  const [detail, setDetail] = useState<RankedChannel | null>(null);

  async function load() {
    if (!getApiKey()) {
      setError("YouTube API 키가 필요합니다. 좌측 메뉴의 'YouTube API 키 설정'에서 먼저 등록해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ranked = await fetchChannelRanking({ maxCategories: 5 });
      setData(ranked);
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

  const filtered = useMemo(() => {
    let list = data.slice();
    if (under1m) list = list.filter((c) => c.subscribers < 1_000_000);
    if (type === "short") list = list.filter((c) => c.isShort);
    if (type === "long") list = list.filter((c) => !c.isShort);

    if (period === "accel") {
      list.sort((a, b) => b.dailyViews / (b.subscribers + 1) - a.dailyViews / (a.subscribers + 1));
    } else if (period === "7d") {
      list.sort((a, b) => b.weeklyViews - a.weeklyViews);
    } else if (period === "30d") {
      list.sort((a, b) => b.monthlyViews - a.monthlyViews);
    } else {
      list.sort((a, b) => b.dailyViews - a.dailyViews);
    }
    return list;
  }, [data, under1m, type, period]);

  const metricFor = (c: RankedChannel) =>
    period === "7d" ? c.weeklyViews : period === "30d" ? c.monthlyViews : c.dailyViews;

  return (
    <div>
      <ApiKeyWarning />

      <div className="bg-white rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-slate-100 rounded-full p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`h-8 px-3 rounded-full text-sm font-semibold ${period === p.id ? "bg-slate-900 text-white" : "text-slate-500"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`h-8 px-3 rounded-full text-sm font-semibold ${type === t.id ? "bg-emerald-100 text-emerald-700" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setUnder1m((v) => !v)}
          className={`h-8 px-3 rounded-full text-sm font-semibold ${under1m ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}
        >
          100만 미만
        </button>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-slate-400">채널 {filtered.length}개</span>
          <button onClick={load} className="flex items-center gap-1 text-slate-500 hover:text-slate-800">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 새로고침
          </button>
        </div>
      </div>

      {loading && <LoadingGrid label="채널 순위를 계산하는 중..." />}
      {!loading && error && <ErrorBox message={error} />}
      {!loading && !error && filtered.length === 0 && <EmptyState icon="📈" title="표시할 채널이 없습니다" />}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[48px_1fr_120px_100px_40px] gap-2 px-4 py-2.5 text-xs font-semibold text-slate-400 border-b border-slate-100">
            <div>순위</div>
            <div>채널</div>
            <div className="text-right">{period === "7d" ? "7일 조회수" : period === "30d" ? "30일 조회수" : "조회수(근사)"}</div>
            <div className="text-right">구독자</div>
            <div />
          </div>
          {filtered.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => setDetail(c)}
              className="w-full grid grid-cols-[48px_1fr_120px_100px_40px] gap-2 px-4 py-3 items-center border-b border-slate-50 last:border-0 hover:bg-slate-50 text-left"
            >
              <div className="text-sm font-semibold text-slate-500">{idx < 3 ? MEDALS[idx] : idx + 1}</div>
              <div className="flex items-center gap-2 min-w-0">
                {c.thumbnail ? (
                  <img src={c.thumbnail} className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{c.title}</div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {c.isShort ? "SHORTS" : "LONG"}
                  </span>
                </div>
              </div>
              <div className="text-right text-sm font-semibold text-slate-900">{formatCount(metricFor(c))}</div>
              <div className="text-right text-sm text-slate-500">{formatCount(c.subscribers)}</div>
              <ChevronRight className="w-4 h-4 text-slate-300 justify-self-end" />
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-sm bg-white h-full p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900">채널 상세</h3>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 mb-5">
              {detail.thumbnail ? (
                <img src={detail.thumbnail} className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-slate-200" />
              )}
              <div>
                <div className="font-bold text-slate-900">{detail.title}</div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {detail.isShort ? "SHORTS" : "LONG"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <StatBox label="구독자" value={`${formatCount(detail.subscribers)}명`} />
              <StatBox label="일 조회수(근사)" value={`${formatCount(detail.dailyViews)}`} />
              <StatBox label="7일 조회수(근사)" value={`${formatCount(detail.weeklyViews)}`} />
              <StatBox label="30일 조회수(근사)" value={`${formatCount(detail.monthlyViews)}`} />
            </div>
            <p className="text-xs text-slate-400 mb-5">
              * 이 클론은 자체 시계열 DB가 없어 최근 영상 조회수를 기반으로 근사 계산합니다. 실제 채널 통계와 다를 수 있습니다.
            </p>
            <a
              href={`https://www.youtube.com/channel/${detail.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100"
            >
              <ExternalLink className="w-4 h-4" /> 유튜브에서 보기
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="text-[11px] text-slate-400 mb-1">{label}</div>
      <div className="font-bold text-slate-900">{value}</div>
    </div>
  );
}
