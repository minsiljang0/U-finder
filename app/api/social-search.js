// Instagram/TikTok/샤오홍슈/도우인 검색 (Vercel 서버리스). Apify 토큰이 비밀값이라
// 브라우저에서 직접 호출할 수 없으므로 이 라우트를 거쳐서만 호출한다.
import {
  searchInstagram,
  searchTiktok,
  getXiaohongshuPosts,
  searchXiaohongshu,
  getDouyinPosts,
  searchDouyin,
} from "./_apify.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.json({ error: "POST만 지원합니다." });
    return;
  }

  const { platform, mode, query, profileUrl, cookieString, maxItems } = req.body || {};

  try {
    let items;
    if (platform === "instagram") {
      items = await searchInstagram({ query, profileUrl, maxItems: maxItems ?? 10 });
    } else if (platform === "tiktok") {
      items = await searchTiktok({ query, maxItems: maxItems ?? 10 });
    } else if (platform === "xiaohongshu") {
      items = mode === "search" ? await searchXiaohongshu({ query, cookieString, maxItems: maxItems ?? 10 }) : await getXiaohongshuPosts({ profileUrl, maxItems: maxItems ?? 10 });
    } else if (platform === "douyin") {
      items = mode === "search" ? await searchDouyin({ query, maxItems: maxItems ?? 10 }) : await getDouyinPosts({ profileUrl, maxItems: maxItems ?? 10 });
    } else {
      res.statusCode = 400;
      res.json({ error: "platform은 instagram/tiktok/xiaohongshu/douyin 중 하나여야 합니다." });
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.json({ items });
  } catch (e) {
    res.statusCode = 500;
    res.json({ error: e.message });
  }
}
