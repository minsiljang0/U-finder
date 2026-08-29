import { useState } from "react";
import { Search, UserSearch, Camera, Music2, BookHeart, Clapperboard } from "lucide-react";
import { EmptyState, ErrorBox, LoadingGrid } from "../components/StateViews";

type Platform = "instagram" | "tiktok" | "xiaohongshu" | "douyin";

const PLATFORMS: { id: Platform; label: string; icon: typeof Camera; hasProfile: boolean; hasSearch: boolean; note?: string }[] = [
  { id: "instagram", label: "Instagram", icon: Camera, hasProfile: true, hasSearch: true },
  { id: "tiktok", label: "TikTok", icon: Music2, hasProfile: false, hasSearch: true },
  { id: "xiaohongshu", label: "샤오홍슈", icon: BookHeart, hasProfile: true, hasSearch: true, note: "키워드 검색은 로그인 쿠키가 필요합니다(베타)." },
  { id: "douyin", label: "도우인", icon: Clapperboard, hasProfile: true, hasSearch: true, note: "키워드 검색은 Apify 유료 플랜이 필요합니다(무료 티어에서 차단됨)." },
];

interface NormalizedItem {
  title: string;
  link: string;
  thumb: string;
  likes: number | string;
}

function normalize(platform: Platform, raw: any): NormalizedItem {
  if (platform === "instagram") {
    return { title: raw.caption ?? "", link: raw.url ?? "", thumb: raw.images?.[0] ?? "", likes: raw.likeCount ?? "?" };
  }
  if (platform === "tiktok") {
    return { title: raw.text ?? "", link: raw.webVideoUrl ?? "", thumb: raw.covers?.default ?? raw.videoMeta?.coverUrl ?? "", likes: raw.diggCount ?? "?" };
  }
  // xiaohongshu / douyin
  return {
    title: raw.title ?? raw.text ?? "",
    link: raw.postUrl || raw.webVideoUrl || raw.url || "",
    thumb: raw.images?.[0] ?? raw.cover ?? "",
    likes: raw.likes ?? raw.diggCount ?? "?",
  };
}

export default function SocialSearch() {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [mode, setMode] = useState<"search" | "profile">("search");
  const [query, setQuery] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [cookieString, setCookieString] = useState("");

  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<NormalizedItem[]>([]);

  const current = PLATFORMS.find((p) => p.id === platform)!;

  async function runSearch() {
    if (mode === "search" && !query.trim()) {
      setSearched(true);
      setError("검색어를 입력해주세요.");
      return;
    }
    if (mode === "profile" && !profileUrl.trim()) {
      setSearched(true);
      setError("계정 URL을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch("/api/social-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          mode,
          query: query.trim() || undefined,
          profileUrl: profileUrl.trim() || undefined,
          cookieString: cookieString.trim() || undefined,
          maxItems: 12,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "검색 중 오류가 발생했습니다.");
      setResults((data.items || []).map((it: any) => normalize(platform, it)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 mb-5 text-sm text-amber-800">
        이 탭은 Apify(유료 스크래핑 서비스) 크레딧을 사용합니다. 계정별 조회수·과금 상태는 Apify 콘솔에서 직접 확인하세요.
      </div>

      <div className="bg-white rounded-2xl p-5 mb-5">
        <div className="grid grid-cols-4 gap-2 mb-4">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPlatform(p.id);
                setMode("search");
                setSearched(false);
                setResults([]);
                setError(null);
              }}
              className={`h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 ${platform === p.id ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500"}`}
            >
              <p.icon className="w-4 h-4" /> {p.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          {current.hasSearch && (
            <button
              onClick={() => setMode("search")}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${mode === "search" ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-500"}`}
            >
              <Search className="w-3.5 h-3.5" /> 키워드
            </button>
          )}
          {current.hasProfile && (
            <button
              onClick={() => setMode("profile")}
              className={`flex-1 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${mode === "profile" ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-500"}`}
            >
              <UserSearch className="w-3.5 h-3.5" /> 계정 지정
            </button>
          )}
        </div>

        {current.note && <div className="text-xs text-slate-400 mb-3">⚠️ {current.note}</div>}

        {mode === "search" ? (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="검색어 / 해시태그"
            className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        ) : (
          <input
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="계정 URL 또는 프로필 링크"
            className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        )}

        {platform === "xiaohongshu" && mode === "search" && (
          <input
            value={cookieString}
            onChange={(e) => setCookieString(e.target.value)}
            placeholder="로그인 세션 쿠키(cookieString) — xiaohongshu.com 로그인 후 개발자도구에서 복사"
            className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        )}

        <button
          onClick={runSearch}
          disabled={loading}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Search className="w-4 h-4" />
          검색
        </button>
      </div>

      {!searched && <EmptyState icon="🌐" title="플랫폼을 고르고 검색해보세요" subtitle="Instagram · TikTok · 샤오홍슈 · 도우인 검색을 한 곳에서" />}
      {searched && loading && <LoadingGrid label="검색하는 중..." />}
      {searched && !loading && error && <ErrorBox message={error} />}
      {searched && !loading && !error && results.length === 0 && <EmptyState icon="🔍" title="결과가 없습니다" />}
      {searched && !loading && !error && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {results.map((item, i) => (
            <a
              key={i}
              href={item.link || undefined}
              target="_blank"
              rel="noreferrer"
              className="block bg-slate-900 rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition-all"
            >
              <div className="relative aspect-square bg-slate-800">
                {item.thumb && <img src={item.thumb} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="p-3">
                <div className="text-xs text-white line-clamp-3 mb-2 min-h-[3em]">{item.title || "(제목 없음)"}</div>
                <div className="text-[11px] text-slate-400">❤️ {item.likes}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
