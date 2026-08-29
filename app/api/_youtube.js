// MCP 서버(내가 회원님 대신 유튜브를 검색할 때 쓰는 서버사이드 클라이언트).
// 브라우저용 src/lib/youtube.ts 로직을 MCP 도구용으로 옮긴 버전.
const BASE = "https://www.googleapis.com/youtube/v3";

const CATEGORY_QUERIES = {
  "건강/의학": ["건강 정보 쇼츠", "의학 상식"],
  "영화/드라마 리뷰": ["영화 리뷰 결말포함", "드라마 몰아보기"],
  "연예인/이슈": ["연예인 이슈", "핫이슈 정리"],
  "재테크/부동산": ["재테크 꿀팁", "부동산 정보"],
  "동기부여/명언": ["동기부여 영상", "인생 명언"],
  "AI/IT 꿀팁": ["AI 활용법", "IT 꿀팁"],
  "라이프스타일/Vlog": ["브이로그", "일상 브이로그"],
  "반려동물": ["강아지 영상", "고양이 영상"],
  "블랙박스/사건사고": ["블랙박스 사고", "교통사고 블랙박스"],
  "뷰티": ["뷰티 꿀팁", "메이크업"],
  "요리": ["요리 레시피", "집밥 레시피"],
  "여행": ["여행 브이로그", "국내여행 추천"],
};

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY 환경변수가 설정되어 있지 않습니다.");
  return key;
}

async function apiGet(path, params) {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("key", apiKey());
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`YouTube API 오류 (${res.status}): ${body?.error?.message ?? res.statusText}`);
  }
  return res.json();
}

export async function searchVideos({ q, order = "viewCount", publishedAfter, videoDuration, maxResults = 25, pageToken }) {
  const data = await apiGet("search", {
    part: "snippet",
    type: "video",
    q,
    order,
    publishedAfter,
    videoDuration,
    maxResults,
    regionCode: "KR",
    relevanceLanguage: "ko",
    pageToken,
  });
  return { items: (data.items || []).filter((it) => it.id.videoId), nextPageToken: data.nextPageToken };
}

export async function getVideosById(ids) {
  if (!ids.length) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
  const out = [];
  for (const chunk of chunks) {
    const data = await apiGet("videos", { part: "snippet,statistics,contentDetails", id: chunk.join(",") });
    out.push(...(data.items || []));
  }
  return out;
}

export async function getChannelsById(ids) {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return [];
  const chunks = [];
  for (let i = 0; i < uniq.length; i += 50) chunks.push(uniq.slice(i, i + 50));
  const out = [];
  for (const chunk of chunks) {
    const data = await apiGet("channels", { part: "snippet,statistics", id: chunk.join(",") });
    out.push(...(data.items || []));
  }
  return out;
}

export async function resolveChannelId(input) {
  const raw = input.trim();
  if (/^UC[\w-]{22}$/.test(raw)) return raw;

  let handle = raw;
  const urlMatch = raw.match(/youtube\.com\/(?:channel\/(UC[\w-]{22})|@([\w.-]+)|c\/([\w.-]+)|user\/([\w.-]+))/i);
  if (urlMatch) {
    if (urlMatch[1]) return urlMatch[1];
    handle = urlMatch[2] || urlMatch[3] || urlMatch[4];
  }
  handle = handle.replace(/^@/, "");

  const byHandle = await apiGet("channels", { part: "id", forHandle: `@${handle}` });
  if (byHandle.items?.[0]?.id) return byHandle.items[0].id;

  const byUsername = await apiGet("channels", { part: "id", forUsername: handle });
  if (byUsername.items?.[0]?.id) return byUsername.items[0].id;

  const bySearch = await apiGet("search", { part: "snippet", type: "channel", q: raw, maxResults: 1 });
  const chId = bySearch.items?.[0]?.snippet?.channelId ?? bySearch.items?.[0]?.id?.channelId;
  if (chId) return chId;

  throw new Error(`채널을 찾을 수 없습니다: ${raw}`);
}

export async function getChannelVideos({ channelId, maxResults = 20, order = "date" }) {
  const data = await apiGet("search", { part: "snippet", type: "video", channelId, order, maxResults });
  return (data.items || []).filter((it) => it.id.videoId);
}

export async function getMostPopular({ maxResults = 50 } = {}) {
  const data = await apiGet("videos", { part: "snippet,statistics,contentDetails", chart: "mostPopular", regionCode: "KR", maxResults });
  return data.items || [];
}

export function parseDurationSeconds(iso) {
  const m = (iso || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}
export function isShort(v) {
  return v.contentDetails?.duration ? parseDurationSeconds(v.contentDetails.duration) <= 60 : false;
}
export function thumbOf(item) {
  return item.thumbnails?.high?.url ?? item.thumbnails?.medium?.url ?? item.thumbnails?.default?.url ?? "";
}
export function daysSince(dateStr) {
  return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 86400000);
}
export function hoursSince(dateStr) {
  return Math.max(0.1, (Date.now() - new Date(dateStr).getTime()) / 3600000);
}
export function fmt(n) {
  n = Number(n) || 0;
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}천`;
  return `${n}`;
}

export function categoryQueries(category) {
  if (category === "전체" || !category) {
    return ["요즘 뜨는 쇼츠", "인기 급상승 영상"];
  }
  return CATEGORY_QUERIES[category] ?? [category];
}

export const CATEGORY_LIST = Object.keys(CATEGORY_QUERIES);
