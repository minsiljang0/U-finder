import { useEffect, useState } from "react";
import { Star, Users, Video, Tag, X, ExternalLink, Loader2 } from "lucide-react";
import {
  getFavChannels,
  getFavKeywords,
  getFavVideos,
  removeFavKeyword,
  toggleFavChannel,
  toggleFavVideo,
  type FavChannel,
  type FavVideo,
  type FavKeyword,
} from "../lib/favorites";
import { formatCount } from "../lib/ams";

type Tab = "channels" | "videos" | "keywords";

export default function Favorites() {
  const [tab, setTab] = useState<Tab>("channels");
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<FavChannel[]>([]);
  const [videos, setVideos] = useState<FavVideo[]>([]);
  const [keywords, setKeywords] = useState<FavKeyword[]>([]);

  async function reload() {
    setLoading(true);
    const [c, v, k] = await Promise.all([getFavChannels(), getFavVideos(), getFavKeywords()]);
    setChannels(c);
    setVideos(v);
    setKeywords(k);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div>
      <div className="bg-white rounded-2xl p-5 mb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
          <Star className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-slate-900">즐겨찾기</div>
          <div className="text-xs text-slate-400">
            저장한 채널 {channels.length}개 · 영상 {videos.length}개 · 키워드 {keywords.length}개
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-1.5 mb-5 grid grid-cols-3 gap-1.5">
        <TabButton active={tab === "channels"} onClick={() => setTab("channels")} icon={<Users className="w-4 h-4" />} label="채널" count={channels.length} />
        <TabButton active={tab === "videos"} onClick={() => setTab("videos")} icon={<Video className="w-4 h-4" />} label="영상" count={videos.length} />
        <TabButton active={tab === "keywords"} onClick={() => setTab("keywords")} icon={<Tag className="w-4 h-4" />} label="키워드" count={keywords.length} />
      </div>

      <div className="bg-white rounded-2xl p-5">
        {loading ? (
          <div className="py-16 flex justify-center text-slate-300">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <>
            {tab === "channels" &&
              (channels.length === 0 ? (
                <Empty
                  title="저장한 채널이 없습니다"
                  subtitle={"슈퍼 채널 발굴기 / 조회수 폭발 쇼츠 찾기 / 터진 영상 페이지에서\n카드 우상단 별 버튼을 눌러 저장하세요."}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {channels.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3">
                      {c.thumbnail ? <img src={c.thumbnail} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-slate-200" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 truncate">{c.title}</div>
                        <div className="text-xs text-slate-400">구독자 {formatCount(c.subscribers)}명</div>
                      </div>
                      <a href={`https://www.youtube.com/channel/${c.id}`} target="_blank" rel="noreferrer" className="text-slate-300 hover:text-slate-600">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={async () => {
                          await toggleFavChannel(c);
                          reload();
                        }}
                        className="text-slate-300 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}

            {tab === "videos" &&
              (videos.length === 0 ? (
                <Empty
                  title="저장한 영상이 없습니다"
                  subtitle={"슈퍼 채널 발굴기 / 조회수 폭발 쇼츠 찾기 / 터진 영상 페이지에서\n카드 좌상단 별 버튼을 눌러 저장하세요."}
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {videos.map((v) => (
                    <a
                      key={v.id}
                      href={`https://www.youtube.com/watch?v=${v.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block bg-slate-900 rounded-xl overflow-hidden group"
                    >
                      <div className="aspect-[9/16] bg-slate-800">
                        {v.thumbnail && <img src={v.thumbnail} className="w-full h-full object-cover" />}
                      </div>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          await toggleFavVideo(v);
                          reload();
                        }}
                        className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                      <div className="p-2">
                        <div className="text-xs text-white line-clamp-2 mb-1">{v.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">{v.channelTitle}</div>
                      </div>
                    </a>
                  ))}
                </div>
              ))}

            {tab === "keywords" &&
              (keywords.length === 0 ? (
                <Empty title="저장한 키워드가 없습니다" subtitle={"조회수 폭발 쇼츠 찾기에서 검색어를 즐겨찾기해보세요."} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((k) => (
                    <span key={k.keyword} className="flex items-center gap-2 bg-slate-100 rounded-full pl-3 pr-1 py-1 text-sm text-slate-700">
                      {k.keyword}
                      <button
                        onClick={async () => {
                          await removeFavKeyword(k.keyword);
                          reload();
                        }}
                        className="text-slate-400 hover:text-red-500 bg-white rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-colors ${
        active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
      }`}
    >
      {icon} {label}
      <span className={`text-xs px-1.5 rounded-full ${active ? "bg-white/20" : "bg-slate-100"}`}>{count}</span>
    </button>
  );
}

function Empty({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="py-16 flex flex-col items-center text-center gap-2">
      <Star className="w-10 h-10 text-amber-400 fill-amber-400 mb-2" />
      <div className="font-bold text-slate-900">{title}</div>
      <div className="text-sm text-slate-400 whitespace-pre-line">{subtitle}</div>
    </div>
  );
}
