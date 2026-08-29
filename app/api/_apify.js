// Apify 기반 멀티플랫폼(Instagram/TikTok/샤오홍슈/도우인) 검색 클라이언트 (Vercel 서버리스용, mcp/apify.mjs와 동일 로직).
const APIFY_BASE = "https://api.apify.com/v2";

function apifyToken() {
  const key = process.env.APIFY_API_TOKEN;
  if (!key) throw new Error("APIFY_API_TOKEN 환경변수가 설정되어 있지 않습니다.");
  return key;
}

async function runActor(actorId, input, { timeoutSecs = 120 } = {}) {
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${apifyToken()}&timeout=${timeoutSecs}`;
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
