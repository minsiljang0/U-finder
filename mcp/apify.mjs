// Apify 기반 멀티플랫폼(Instagram/TikTok/샤오홍슈/도우인) 검색 클라이언트.
// YouTube(youtube.mjs)와 달리 공식 무료 API가 없는 플랫폼이라 Apify 유료 액터를 통해 조회한다.
// 토큰은 Vercel 환경변수 등록(원격은 사용자가 직접 해야 함) 없이 쓸 수 있도록, 이미 접근권한이 있는
// Supabase app_config 테이블(key=apify_api_token)에서 읽는다 — env var는 로컬 임시 override용으로만 유지.
const APIFY_BASE = "https://api.apify.com/v2";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://pyplpivswdbrjytfqclm.supabase.co";
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
  if (!rows[0]?.value) throw new Error("Supabase app_config에 apify_api_token 값이 없습니다. upsert_row(app_config, {key:'apify_api_token', value:'...'})로 등록하세요.");
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

// ── Instagram (apidojo/instagram-scraper) ──
export async function searchInstagram({ query, profileUrl, maxItems = 10 }) {
  const startUrls = profileUrl ? [profileUrl] : query ? [`https://www.instagram.com/explore/tags/${encodeURIComponent(query.replace(/^#/, ""))}`] : null;
  if (!startUrls) throw new Error("query 또는 profileUrl 중 하나는 필요합니다.");
  return runActor("apidojo~instagram-scraper", { startUrls, maxItems });
}

// ── TikTok (clockworks/tiktok-scraper) ──
export async function searchTiktok({ query, maxItems = 10 }) {
  if (!query) throw new Error("query(해시태그 또는 검색어)가 필요합니다.");
  return runActor("clockworks~tiktok-scraper", {
    hashtags: [query.replace(/^#/, "")],
    resultsPerPage: maxItems,
    searchSection: "",
    proxyCountryCode: "None",
  });
}

// ── 샤오홍슈 (zhorex/rednote-xiaohongshu-scraper) ──
// 계정 지정 조회는 로그인 없이 동작 확인됨(2026-08-29). 키워드 검색(mode=search)은
// RedNote가 익명 요청엔 추천피드만 줘서 로그인 세션(cookieString)이 사실상 필수 — 미제공시 에러로 안내.
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

// ── 도우인 (natanielsantos/douyin-scraper) ──
// 계정 지정 조회는 무료 티어에서 동작 확인됨(2026-08-29). 키워드 검색은 액터 개발자가
// 무료(비결제) 사용자에게 아예 막아놔서(ERROR: "Search scraping was disabled to non-paying users") 유료 플랜 필요.
export async function getDouyinPosts({ profileUrl, maxItems = 10 }) {
  if (!profileUrl) throw new Error("profileUrl이 필요합니다.");
  return runActor("natanielsantos~douyin-scraper", { profileUrls: [profileUrl], maxItemsPerUrl: maxItems });
}
export async function searchDouyin({ query, maxItems = 10 }) {
  // 무료 티어에서는 액터가 곧바로 "Search scraping was disabled to non-paying users" 에러를 낸다.
  // Apify 유료 플랜으로 업그레이드하면 별도 코드 수정 없이 바로 동작한다.
  return runActor("natanielsantos~douyin-scraper", { searchTermsOrHashtags: [query], maxItemsPerUrl: maxItems });
}
