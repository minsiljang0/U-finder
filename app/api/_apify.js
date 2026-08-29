// Apify 기반 멀티플랫폼(Instagram/TikTok/샤오홍슈/도우인) 검색 클라이언트 (Vercel 서버리스용, mcp/apify.mjs와 동일 로직).
// 토큰은 Vercel 환경변수 신규 등록 없이 쓸 수 있도록, 이미 접근권한이 있는 SUPABASE_SECRET_KEY로
// Supabase app_config 테이블(key=apify_api_token)에서 읽는다.
const APIFY_BASE = "https://api.apify.com/v2";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://pyplpivswdbrjytfqclm.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

let cachedApifyToken;
async function apifyToken() {
  if (process.env.APIFY_API_TOKEN) return process.env.APIFY_API_TOKEN;
  if (cachedApifyToken) return cachedApifyToken;
  if (!SUPABASE_KEY) throw new Error("APIFY_API_TOKEN 환경변수도 없고 SUPABASE_SECRET_KEY도 없어 토큰을 가져올 수 없습니다.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config?key=eq.apify_api_token&select=value`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase app_config 조회 실패 (${res.status})`);
  const rows = await res.json();
  if (!rows[0]?.value) throw new Error("Supabase app_config에 apify_api_token 값이 없습니다.");
  cachedApifyToken = rows[0].value;
  return cachedApifyToken;
}

async function runActor(actorId, input, { timeoutSecs = 120 } = {}) {
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${await apifyToken()}&timeout=${timeoutSecs}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Apify 응답 파싱 실패 (${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`Apify 액터 오류 (${res.status}): ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

export async function searchInstagram({ query, profileUrl, maxItems = 10 }) {
  const startUrls = profileUrl ? [profileUrl] : query ? [`https://www.instagram.com/explore/tags/${encodeURIComponent(query.replace(/^#/, ""))}`] : null;
  if (!startUrls) throw new Error("query 또는 profileUrl 중 하나는 필요합니다.");
  return runActor("apidojo~instagram-scraper", { startUrls, maxItems });
}

export async function searchTiktok({ query, maxItems = 10 }) {
  if (!query) throw new Error("query(해시태그 또는 검색어)가 필요합니다.");
  return runActor("clockworks~tiktok-scraper", {
    hashtags: [query.replace(/^#/, "")],
    resultsPerPage: maxItems,
    searchSection: "",
    proxyCountryCode: "None",
  });
}

export async function getXiaohongshuPosts({ profileUrl, maxItems = 10 }) {
  if (!profileUrl) throw new Error("profileUrl이 필요합니다.");
  return runActor("zhorex~rednote-xiaohongshu-scraper", { mode: "user_posts", userUrl: profileUrl, maxResults: maxItems });
}
export async function searchXiaohongshu({ query, cookieString, maxItems = 10 }) {
  if (!cookieString) {
    throw new Error(
      "샤오홍슈 키워드 검색은 로그인 세션(cookieString)이 필요합니다(익명 요청은 추천피드만 반환되어 실제 검색이 안 됨). " +
        "브라우저에서 xiaohongshu.com 로그인 후 쿠키를 복사해 cookieString 파라미터로 전달하세요."
    );
  }
  return runActor("zhorex~rednote-xiaohongshu-scraper", { mode: "search", searchQuery: query, cookieString, maxResults: maxItems });
}

export async function getDouyinPosts({ profileUrl, maxItems = 10 }) {
  if (!profileUrl) throw new Error("profileUrl이 필요합니다.");
  return runActor("natanielsantos~douyin-scraper", { profileUrls: [profileUrl], maxItemsPerUrl: maxItems });
}
export async function searchDouyin({ query, maxItems = 10 }) {
  return runActor("natanielsantos~douyin-scraper", { searchTermsOrHashtags: [query], maxItemsPerUrl: maxItems });
}
