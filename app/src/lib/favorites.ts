// 즐겨찾기(채널/영상/키워드)를 로그인한 회원별로 Supabase에 저장한다.
// RLS 정책이 auth.uid()=user_id인 행만 허용하므로, publishable key로 접근해도 안전하다.
import { supabase } from "./supabaseClient";

export interface FavChannel {
  id: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  savedAt: number;
}
export interface FavVideo {
  id: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  savedAt: number;
}
export interface FavKeyword {
  keyword: string;
  savedAt: number;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getFavChannels(): Promise<FavChannel[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase.from("fav_channels").select("*").order("saved_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, title: r.title, thumbnail: r.thumbnail ?? "", subscribers: r.subscribers, savedAt: new Date(r.saved_at).getTime() }));
}

export async function isFavChannel(id: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { data } = await supabase.from("fav_channels").select("id").eq("id", id).maybeSingle();
  return !!data;
}

export async function toggleFavChannel(channel: FavChannel): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const existing = await isFavChannel(channel.id);
  if (existing) {
    await supabase.from("fav_channels").delete().eq("id", channel.id);
    return false;
  }
  await supabase.from("fav_channels").insert({
    id: channel.id,
    user_id: uid,
    title: channel.title,
    thumbnail: channel.thumbnail,
    subscribers: channel.subscribers,
  });
  return true;
}

export async function getFavVideos(): Promise<FavVideo[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase.from("fav_videos").select("*").order("saved_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, title: r.title, thumbnail: r.thumbnail ?? "", channelTitle: r.channel_title ?? "", savedAt: new Date(r.saved_at).getTime() }));
}

export async function isFavVideo(id: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { data } = await supabase.from("fav_videos").select("id").eq("id", id).maybeSingle();
  return !!data;
}

export async function toggleFavVideo(video: FavVideo): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const existing = await isFavVideo(video.id);
  if (existing) {
    await supabase.from("fav_videos").delete().eq("id", video.id);
    return false;
  }
  await supabase.from("fav_videos").insert({
    id: video.id,
    user_id: uid,
    title: video.title,
    thumbnail: video.thumbnail,
    channel_title: video.channelTitle,
  });
  return true;
}

export async function getFavKeywords(): Promise<FavKeyword[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase.from("fav_keywords").select("*").order("saved_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({ keyword: r.keyword, savedAt: new Date(r.saved_at).getTime() }));
}

export async function toggleFavKeyword(keyword: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { data } = await supabase.from("fav_keywords").select("keyword").eq("keyword", keyword).maybeSingle();
  if (data) {
    await supabase.from("fav_keywords").delete().eq("keyword", keyword);
    return false;
  }
  await supabase.from("fav_keywords").insert({ keyword, user_id: uid });
  return true;
}

export async function removeFavKeyword(keyword: string): Promise<void> {
  await supabase.from("fav_keywords").delete().eq("keyword", keyword);
}
