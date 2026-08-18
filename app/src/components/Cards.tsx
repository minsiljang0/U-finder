import { Star } from "lucide-react";
import ScriptButton from "./ScriptButton";
import { formatCount, formatRelativeDays } from "../lib/ams";
import { toggleFavChannel, toggleFavVideo, isFavChannel, isFavVideo } from "../lib/favorites";
import { useEffect, useState } from "react";

export interface ChannelStatCardData {
  id: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  totalViews: number;
  lastUploadDate: string;
  dailyViews: number;
  ams: number;
}

export function ChannelStatCard({ data }: { data: ChannelStatCardData }) {
  return (
    <div className="bg-slate-900 rounded-2xl p-4 text-white">
      <div className="flex items-center gap-2 mb-3">
        {data.thumbnail ? (
          <img src={data.thumbnail} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0" />
        )}
        <span className="font-semibold text-sm truncate">{data.title}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <div>
          <div className="text-[11px] text-slate-400">구독자</div>
          <div className="text-sm font-semibold">{formatCount(data.subscribers)}명</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">조회수</div>
          <div className="text-sm font-semibold">{formatCount(data.totalViews)}회</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-400">업로드</div>
          <div className="text-sm font-semibold">{formatRelativeDays(data.lastUploadDate)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-400">일일 조회수</span>
        <span className="text-cyan-400 font-semibold">{formatCount(data.dailyViews)} 회/일</span>
      </div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-slate-400">AMS 지수</span>
        <span className="text-cyan-400 font-semibold">{data.ams}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-400 rounded-full"
          style={{ width: `${Math.min(100, data.ams)}%` }}
        />
      </div>
    </div>
  );
}

export interface VideoResultCardData {
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
  channelThumbnail: string;
  subscribers: number;
  viewCount: number;
  publishedAt: string;
  dailyViews?: number;
  ams?: number;
  rank?: number;
  growthPerHour?: number;
  hot?: boolean;
}

export function VideoResultCard({ data }: { data: VideoResultCardData }) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    let alive = true;
    isFavVideo(data.videoId).then((v) => alive && setFav(v));
    return () => {
      alive = false;
    };
  }, [data.videoId]);

  async function onStar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = await toggleFavVideo({
      id: data.videoId,
      title: data.title,
      thumbnail: data.thumbnail,
      channelTitle: data.channelTitle,
      savedAt: Date.now(),
    });
    setFav(next);
  }

  return (
    <a
      href={`https://www.youtube.com/watch?v=${data.videoId}`}
      target="_blank"
      rel="noreferrer"
      className="block bg-slate-900 rounded-2xl overflow-hidden hover:ring-2 hover:ring-indigo-500/50 transition-all"
    >
      <div className="relative aspect-[9/16] bg-slate-800">
        {data.thumbnail && <img src={data.thumbnail} alt="" className="w-full h-full object-cover" />}
        {data.rank !== undefined && (
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full">
            #{data.rank}
          </div>
        )}
        {data.hot && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full" style={data.rank !== undefined ? { top: 32 } : undefined}>
            🔥 HOT
          </div>
        )}
        <button
          onClick={onStar}
          className="absolute bottom-2 left-2 bg-black/60 hover:bg-black/75 rounded-full p-1.5 z-10"
        >
          <Star className={`w-3.5 h-3.5 ${fav ? "fill-amber-400 text-amber-400" : "text-white"}`} />
        </button>
        <ScriptButton videoId={data.videoId} title={data.title} />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
      </div>
      <div className="p-3">
        <div className="text-sm font-medium text-white line-clamp-2 mb-2 min-h-[2.5em]">{data.title}</div>
        <div className="flex items-center gap-1.5 mb-2 min-w-0">
          {data.channelThumbnail ? (
            <img src={data.channelThumbnail} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-slate-700 shrink-0" />
          )}
          <span className="text-xs text-slate-400 truncate">{data.channelTitle}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 text-center border-t border-slate-800 pt-2">
          <div>
            <div className="text-[10px] text-slate-500">구독자</div>
            <div className="text-xs font-semibold text-white">{formatCount(data.subscribers)}명</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">조회수</div>
            <div className="text-xs font-semibold text-white">{formatCount(data.viewCount)}회</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">업로드</div>
            <div className="text-xs font-semibold text-white">{formatRelativeDays(data.publishedAt)}</div>
          </div>
        </div>
        {data.dailyViews !== undefined && (
          <div className="flex items-center justify-between text-xs mt-2">
            <span className="text-slate-500">일일 조회수</span>
            <span className="text-cyan-400 font-semibold">{formatCount(data.dailyViews)} 회/일</span>
          </div>
        )}
        {data.growthPerHour !== undefined && (
          <div className="flex items-center gap-1 text-xs mt-2 text-emerald-400 font-semibold">
            📈 +{formatCount(data.growthPerHour)}/h
          </div>
        )}
      </div>
    </a>
  );
}

export function ChannelFavButton({
  id,
  title,
  thumbnail,
  subscribers,
  className,
}: {
  id: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  className?: string;
}) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    let alive = true;
    isFavChannel(id).then((v) => alive && setFav(v));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setFav(await toggleFavChannel({ id, title, thumbnail, subscribers, savedAt: Date.now() }));
      }}
      className={className}
    >
      <Star className={`w-4 h-4 ${fav ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
    </button>
  );
}
