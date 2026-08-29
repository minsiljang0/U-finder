// 원격 MCP 엔드포인트 (Vercel 서버리스 함수). 로컬 stdio MCP(mcp/index.mjs)와 동일한 도구를
// HTTP로 제공해서, 이 컴퓨터가 아닌 어디서든(claude.ai 등) 같은 Supabase 프로젝트 데이터를
// 조회/기록할 수 있게 한다. MCP_SHARED_SECRET 환경변수로 접근을 제한한다(공개 인터넷에 떠 있으므로).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  searchVideos,
  getVideosById,
  getChannelsById,
  getMostPopular,
  isShort,
  thumbOf,
  daysSince,
  hoursSince,
  fmt,
  categoryQueries,
  CATEGORY_LIST,
  resolveChannelId,
  getChannelVideos,
} from "./_youtube.js";
import { saveThumbnail } from "./_storage.js";
import {
  searchInstagram,
  searchTiktok,
  getXiaohongshuPosts,
  searchXiaohongshu,
  getDouyinPosts,
  searchDouyin,
} from "./_apify.js";

const TABLES = ["app_config", "dev_notes", "known_issues", "tasks"];
const GITHUB_REPO = "minsiljang0/U-finder";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pyplpivswdbrjytfqclm.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const ACCESS_TOKEN = process.env.MCP_SHARED_SECRET;

function ghHeaders() {
  const h = { "User-Agent": "superfinder-mcp-remote" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}
async function ghFetchFile(path, ref) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}${ref ? `?ref=${ref}` : ""}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub API 오류 (${res.status})`);
  return res.json();
}

const REST = `${SUPABASE_URL}/rest/v1`;
function headers() {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
}
async function sb(path, options = {}) {
  const res = await fetch(`${REST}/${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  if (!res.ok) throw new Error(`Supabase 오류 (${res.status}): ${await res.text().catch(() => "")}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function buildServer() {
  const server = new McpServer({ name: "superfinder-mcp-remote", version: "0.1.0" });

  server.registerTool(
    "list_tables",
    { title: "테이블 목록", description: "슈퍼파인더 관리 DB(Supabase)의 테이블 목록." },
    async () => ({ content: [{ type: "text", text: JSON.stringify(TABLES) }] })
  );

  server.registerTool(
    "get_rows",
    { title: "테이블 행 조회", description: "지정한 테이블 전체 행 조회.", inputSchema: { table: z.enum(TABLES) } },
    async ({ table }) => {
      const rows = await sb(`${table}?select=*`);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.registerTool(
    "get_known_issues",
    { title: "알려진 이슈 조회", description: "known_issues 전체 조회." },
    async () => {
      const rows = await sb("known_issues?select=*&order=updated_at.desc");
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    }
  );

  server.registerTool(
    "upsert_row",
    {
      title: "행 삽입/수정",
      description: "known_issues(feature 키), app_config(key 키), dev_notes(항상 삽입), tasks(id 있으면 수정).",
      inputSchema: { table: z.enum(TABLES), data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])) },
    },
    async ({ table, data }) => {
      const now = new Date().toISOString();
      if (table === "known_issues") {
        await sb("known_issues?on_conflict=feature", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ feature: data.feature, status: data.status ?? "unknown", note: data.note ?? "", updated_at: now }),
        });
      } else if (table === "app_config") {
        await sb("app_config?on_conflict=key", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ key: data.key, value: data.value ?? "", updated_at: now }),
        });
      } else if (table === "dev_notes") {
        await sb("dev_notes", { method: "POST", body: JSON.stringify({ note: data.note ?? "" }) });
      } else if (table === "tasks") {
        if (data.id) {
          await sb(`tasks?id=eq.${data.id}`, {
            method: "PATCH",
            body: JSON.stringify({ subject: data.subject, status: data.status ?? "pending", note: data.note ?? null, updated_at: now }),
          });
        } else {
          await sb("tasks", {
            method: "POST",
            body: JSON.stringify({ subject: data.subject ?? "", status: data.status ?? "pending", note: data.note ?? null, updated_at: now }),
          });
        }
      }
      return { content: [{ type: "text", text: "OK" }] };
    }
  );

  server.registerTool(
    "delete_row",
    {
      title: "행 삭제",
      description: "known_issues는 feature, app_config는 key, 나머지는 id로 삭제.",
      inputSchema: { table: z.enum(TABLES), id: z.union([z.string(), z.number()]) },
    },
    async ({ table, id }) => {
      const col = table === "known_issues" ? "feature" : table === "app_config" ? "key" : "id";
      await sb(`${table}?${col}=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return { content: [{ type: "text", text: "OK" }] };
    }
  );

  server.registerTool(
    "list_github_files",
    {
      title: "GitHub 저장소 파일 목록",
      description: `${GITHUB_REPO} 저장소의 특정 경로에 어떤 파일·폴더가 있는지 조회한다. path를 비우면 루트를 본다.`,
      inputSchema: { path: z.string().optional(), ref: z.string().optional() },
    },
    async ({ path: p, ref }) => {
      try {
        const data = await ghFetchFile(p ?? "", ref);
        const list = Array.isArray(data) ? data : [data];
        const text = list.map((f) => `${f.type === "dir" ? "📁" : "📄"} ${f.path}${f.type === "file" ? ` (${f.size} bytes)` : ""}`).join("\n");
        return { content: [{ type: "text", text }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "get_github_file",
    {
      title: "GitHub 파일 내용 조회",
      description: `${GITHUB_REPO} 저장소의 특정 파일 내용을 텍스트로 가져온다. list_github_files로 경로 확인 후 사용.`,
      inputSchema: { path: z.string(), ref: z.string().optional() },
    },
    async ({ path: p, ref }) => {
      try {
        const data = await ghFetchFile(p, ref);
        if (data.type !== "file") return { content: [{ type: "text", text: "파일이 아닙니다." }], isError: true };
        const text = Buffer.from(data.content, "base64").toString("utf8");
        return { content: [{ type: "text", text }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "get_plan",
    { title: "PLAN.md 조회", description: "슈퍼파인더 기획서(PLAN.md, 저장소 루트) 전체 내용을 GitHub에서 가져온다." },
    async () => {
      try {
        const data = await ghFetchFile("PLAN.md");
        const text = Buffer.from(data.content, "base64").toString("utf8");
        return { content: [{ type: "text", text }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  // ── 여기서부터 "회원님 대신 실제로 유튜브를 검색"하는 도구들.
  // 슈퍼파인더 앱(브라우저)이 하는 것과 같은 일을, 서버사이드 YOUTUBE_API_KEY로 대신 수행한다.

  server.registerTool(
    "discover_channels",
    {
      title: "카테고리별 채널 발굴 (슈퍼 채널 발굴기)",
      description:
        `카테고리(예: ${CATEGORY_LIST.join(", ")}, 또는 "전체")로 최근 60일 내 떡상 영상을 보유한 채널을 찾는다. ` +
        "구독자 20만명 미만 채널만, 카테고리당 결과가 30개 미만이면 조회수 기준을 낮춰가며 보충한다.",
      inputSchema: { category: z.string().optional(), videoType: z.enum(["short", "long"]).default("short") },
    },
    async ({ category, videoType }) => {
      try {
        const queries = categoryQueries(category).slice(0, 3);
        const publishedAfter = new Date(Date.now() - 60 * 86400000).toISOString();
        const results = await Promise.all(
          queries.map((q) => searchVideos({ q, order: "viewCount", publishedAfter, maxResults: 16 }).then((r) => r.items).catch(() => []))
        );
        const ids = [...new Set(results.flat().map((it) => it.id.videoId).filter(Boolean))];
        const videos = await getVideosById(ids);
        const filtered = videos.filter((v) => (videoType === "short" ? isShort(v) : !isShort(v)));
        const channelIds = [...new Set(filtered.map((v) => v.snippet.channelId))];
        const channels = await getChannelsById(channelIds);
        const chMap = new Map(channels.map((c) => [c.id, c]));

        const underCap = filtered.filter((v) => Number(chMap.get(v.snippet.channelId)?.statistics.subscriberCount ?? 0) < 200_000);
        const tiers = [500_000, 300_000, 100_000, 50_000];
        let selected = underCap.filter((v) => Number(v.statistics.viewCount ?? 0) >= tiers[0]);
        for (const t of tiers.slice(1)) {
          if (selected.length >= 30) break;
          selected = underCap.filter((v) => Number(v.statistics.viewCount ?? 0) >= t);
        }

        const lines = selected.slice(0, 30).map((v) => {
          const ch = chMap.get(v.snippet.channelId);
          const views = Number(v.statistics.viewCount ?? 0);
          const days = Math.max(1, daysSince(v.snippet.publishedAt));
          return `- "${v.snippet.title}" | 채널: ${v.snippet.channelTitle}(구독자 ${fmt(ch?.statistics.subscriberCount)}명) | 조회수 ${fmt(views)} | 일일 ${fmt(Math.round(views / days))}회/일 | ${Math.floor(days)}일 전 | https://youtube.com/watch?v=${v.id}`;
        });
        return { content: [{ type: "text", text: `${category ?? "전체"} 카테고리, ${selected.length}개 발견:\n\n${lines.join("\n")}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "search_shorts",
    {
      title: "조건 맞춤 쇼츠 검색 (조회수 폭발 쇼츠 찾기)",
      description: "키워드 + 업로드기간/최대구독자/조회수범위로 쇼츠를 검색한다.",
      inputSchema: {
        query: z.string(),
        uploadWithinDays: z.number().default(7),
        maxSubscribers: z.number().optional(),
        minViews: z.number().default(10000),
        maxViews: z.number().optional(),
        sort: z.enum(["views", "date", "velocity"]).default("views"),
      },
    },
    async ({ query, uploadWithinDays, maxSubscribers, minViews, maxViews, sort }) => {
      try {
        const publishedAfter = new Date(Date.now() - uploadWithinDays * 86400000).toISOString();
        let pageToken;
        const items = [];
        for (let i = 0; i < 3; i++) {
          const r = await searchVideos({ q: query, order: "date", publishedAfter, videoDuration: "short", maxResults: 50, pageToken });
          items.push(...r.items);
          if (!r.nextPageToken) break;
          pageToken = r.nextPageToken;
        }
        const ids = [...new Set(items.map((i) => i.id.videoId).filter(Boolean))];
        const videos = (await getVideosById(ids)).filter(isShort);
        const channelIds = [...new Set(videos.map((v) => v.snippet.channelId))];
        const channels = await getChannelsById(channelIds);
        const chMap = new Map(channels.map((c) => [c.id, c]));

        let results = videos
          .map((v) => ({
            v,
            views: Number(v.statistics.viewCount ?? 0),
            subs: Number(chMap.get(v.snippet.channelId)?.statistics.subscriberCount ?? 0),
            velocity: Number(v.statistics.viewCount ?? 0) / hoursSince(v.snippet.publishedAt),
          }))
          .filter((r) => (maxSubscribers ? r.subs <= maxSubscribers : true))
          .filter((r) => r.views >= minViews && (maxViews ? r.views < maxViews : true));

        if (sort === "velocity") results.sort((a, b) => b.velocity - a.velocity);
        else if (sort === "date") results.sort((a, b) => (a.v.snippet.publishedAt < b.v.snippet.publishedAt ? 1 : -1));
        else results.sort((a, b) => b.views - a.views);

        const lines = results.slice(0, 30).map((r) => {
          const days = Math.max(1, daysSince(r.v.snippet.publishedAt));
          return `- "${r.v.snippet.title}" | 채널: ${r.v.snippet.channelTitle}(구독자 ${fmt(r.subs)}명) | 조회수 ${fmt(r.views)} | ${Math.floor(days)}일 전 | https://youtube.com/watch?v=${r.v.id}`;
        });
        return { content: [{ type: "text", text: `"${query}" 검색, ${results.length}개 발견:\n\n${lines.join("\n")}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "get_trending",
    {
      title: "터진 영상 (급등 영상)",
      description: "유튜브 인기차트 + 카테고리 검색 기반 쇼츠 풀을 합쳐 조회수 성장 속도(급등순)로 정렬해 보여준다.",
      inputSchema: { type: z.enum(["short", "long", "all"]).default("short"), limit: z.number().default(20) },
    },
    async ({ type, limit }) => {
      try {
        const [longform, shortsSearch] = await Promise.all([
          getMostPopular({ maxResults: 50 }),
          Promise.all(
            CATEGORY_LIST.slice(0, 6).map((c) =>
              searchVideos({ q: categoryQueries(c)[0], order: "viewCount", publishedAfter: new Date(Date.now() - 4 * 86400000).toISOString(), videoDuration: "short", maxResults: 15 })
                .then((r) => r.items)
                .catch(() => [])
            )
          ),
        ]);
        const shortIds = [...new Set(shortsSearch.flat().map((it) => it.id.videoId).filter(Boolean))];
        const shorts = await getVideosById(shortIds);
        const seen = new Set();
        const all = [];
        for (const v of [...shorts, ...longform]) {
          if (seen.has(v.id)) continue;
          seen.add(v.id);
          all.push(v);
        }
        const filtered = all.filter((v) => (type === "all" ? true : type === "short" ? isShort(v) : !isShort(v)));
        const withGrowth = filtered.map((v) => ({ v, growth: Number(v.statistics.viewCount ?? 0) / hoursSince(v.snippet.publishedAt) }));
        withGrowth.sort((a, b) => b.growth - a.growth);

        const lines = withGrowth.slice(0, limit).map((r, idx) => {
          return `#${idx + 1} "${r.v.snippet.title}" | ${r.v.snippet.channelTitle} | 조회수 ${fmt(r.v.statistics.viewCount)} | +${fmt(Math.round(r.growth))}/h | https://youtube.com/watch?v=${r.v.id}`;
        });
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "get_channel_ranking",
    {
      title: "채널 랭킹",
      description: "여러 카테고리를 순회 검색해 채널별 조회수 합산 랭킹을 근사로 계산한다.",
      inputSchema: { limit: z.number().default(20) },
    },
    async ({ limit }) => {
      try {
        const cats = CATEGORY_LIST.slice(0, 5);
        const publishedAfter = new Date(Date.now() - 14 * 86400000).toISOString();
        const results = await Promise.all(
          cats.flatMap((c) => [
            searchVideos({ q: categoryQueries(c)[0], order: "viewCount", publishedAfter, videoDuration: "short", maxResults: 8 }).then((r) => r.items).catch(() => []),
            searchVideos({ q: categoryQueries(c)[0], order: "viewCount", publishedAfter, videoDuration: "long", maxResults: 8 }).then((r) => r.items).catch(() => []),
          ])
        );
        const ids = [...new Set(results.flat().map((it) => it.id.videoId).filter(Boolean))];
        const videos = await getVideosById(ids);
        const channelIds = [...new Set(videos.map((v) => v.snippet.channelId))];
        const channels = await getChannelsById(channelIds);
        const chMap = new Map(channels.map((c) => [c.id, c]));

        const byChannel = new Map();
        for (const v of videos) {
          const views = Number(v.statistics.viewCount ?? 0);
          const days = Math.max(1, daysSince(v.snippet.publishedAt));
          const entry = byChannel.get(v.snippet.channelId) ?? { sum: 0 };
          entry.sum += views / days;
          byChannel.set(v.snippet.channelId, entry);
        }
        const ranked = [...byChannel.entries()]
          .map(([id, agg]) => ({ id, ch: chMap.get(id), dailyViews: Math.round(agg.sum) }))
          .filter((r) => r.ch)
          .sort((a, b) => b.dailyViews - a.dailyViews)
          .slice(0, limit);

        const lines = ranked.map((r, idx) => `#${idx + 1} ${r.ch.snippet.title} | 구독자 ${fmt(r.ch.statistics.subscriberCount)}명 | 일 조회수(근사) ${fmt(r.dailyViews)}`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "search_by_channel",
    {
      title: "특정 채널 지정 수집",
      description: "채널 URL(youtube.com/@handle, /channel/UC..., /c/..., /user/...)이나 채널ID, @핸들로 그 채널의 영상만 모아서 가져온다.",
      inputSchema: {
        channelInput: z.string(),
        maxResults: z.number().default(20),
        order: z.enum(["date", "viewCount"]).default("date"),
      },
    },
    async ({ channelInput, maxResults, order }) => {
      try {
        const channelId = await resolveChannelId(channelInput);
        const items = await getChannelVideos({ channelId, maxResults, order });
        const ids = items.map((it) => it.id.videoId).filter(Boolean);
        const videos = await getVideosById(ids);
        const [channel] = await getChannelsById([channelId]);
        const lines = videos.map((v) => {
          const views = Number(v.statistics.viewCount ?? 0);
          const days = Math.max(1, daysSince(v.snippet.publishedAt));
          return `- "${v.snippet.title}" | 조회수 ${fmt(views)} | ${Math.floor(days)}일 전 | https://youtube.com/watch?v=${v.id}`;
        });
        const header = channel
          ? `${channel.snippet.title} (구독자 ${fmt(channel.statistics.subscriberCount)}명), 영상 ${videos.length}개:`
          : `영상 ${videos.length}개:`;
        return { content: [{ type: "text", text: `${header}\n\n${lines.join("\n")}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "download_thumbnails",
    {
      title: "썸네일 이미지 다운로드·저장",
      description:
        "영상 ID 목록(최대 20개)으로 유튜브 썸네일 이미지를 가져와 Supabase Storage(finder-media 버킷)에 저장하고 공개 URL을 반환한다. " +
        "실제 영상 파일이 아니라 공개 썸네일 이미지만 캐싱한다.",
      inputSchema: { videoIds: z.array(z.string()).min(1).max(20) },
    },
    async ({ videoIds }) => {
      try {
        const videos = await getVideosById(videoIds);
        const lines = [];
        for (const v of videos) {
          const thumbUrl = thumbOf(v.snippet);
          if (!thumbUrl) {
            lines.push(`- ${v.id}: 썸네일 없음`);
            continue;
          }
          try {
            const savedUrl = await saveThumbnail(v.id, thumbUrl);
            lines.push(`- ${v.id} "${v.snippet.title}" → ${savedUrl}`);
          } catch (e) {
            lines.push(`- ${v.id}: 저장 실패 (${e.message})`);
          }
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  // ── 멀티플랫폼(Instagram/TikTok/샤오홍슈/도우인) 검색 도구. Apify 유료 액터 사용, APIFY_API_TOKEN 필요. ──

  server.registerTool(
    "search_instagram",
    {
      title: "Instagram 검색 (해시태그/계정)",
      description: "query(해시태그)나 profileUrl(계정 URL) 중 하나로 Instagram 게시물을 가져온다. Apify 액터 apidojo/instagram-scraper 사용, 건당 과금.",
      inputSchema: { query: z.string().optional(), profileUrl: z.string().optional(), maxItems: z.number().default(10) },
    },
    async ({ query, profileUrl, maxItems }) => {
      try {
        const items = await searchInstagram({ query, profileUrl, maxItems });
        const lines = items.map((it) => `- [${it.type ?? "post"}] "${(it.caption ?? "").slice(0, 60)}" | ❤️${it.likeCount ?? "?"} 💬${it.commentCount ?? "?"} | ${it.url ?? ""}`);
        return { content: [{ type: "text", text: `${items.length}건:\n\n${lines.join("\n")}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "search_tiktok",
    {
      title: "TikTok 검색 (해시태그)",
      description: "query(해시태그/키워드)로 TikTok 영상을 가져온다. Apify 액터 clockworks/tiktok-scraper 사용, 건당 과금.",
      inputSchema: { query: z.string(), maxItems: z.number().default(10) },
    },
    async ({ query, maxItems }) => {
      try {
        const items = await searchTiktok({ query, maxItems });
        const lines = items.map((it) => `- "${(it.text ?? "").slice(0, 60)}" | ❤️${it.diggCount ?? "?"} ▶️${it.playCount ?? "?"} | @${it.authorMeta?.name ?? "?"} | ${it.webVideoUrl ?? ""}`);
        return { content: [{ type: "text", text: `${items.length}건:\n\n${lines.join("\n")}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "get_xiaohongshu_posts",
    {
      title: "샤오홍슈 계정 지정 조회",
      description: "profileUrl(계정 URL)로 그 계정의 게시물을 가져온다. 로그인 불필요, 실제 검증 완료(2026-08-29). 키워드 검색은 search_xiaohongshu 참고(로그인 필요).",
      inputSchema: { profileUrl: z.string(), maxItems: z.number().default(10) },
    },
    async ({ profileUrl, maxItems }) => {
      try {
        const items = await getXiaohongshuPosts({ profileUrl, maxItems });
        const lines = items.map((it) => `- "${(it.title ?? "").slice(0, 60)}" | ❤️${it.likes ?? "?"} | ${it.postUrl || it.images?.[0] || ""}`);
        return { content: [{ type: "text", text: `${items.length}건:\n\n${lines.join("\n")}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "search_xiaohongshu",
    {
      title: "샤오홍슈 키워드 검색 (베타, 로그인 필요)",
      description:
        "query(검색어)로 샤오홍슈를 검색한다. ⚠️ 익명 요청은 실제 검색이 안 되고 추천피드만 반환되어(비용 청구 안 됨), cookieString(로그인 세션 쿠키)이 사실상 필수다. " +
        "브라우저에서 xiaohongshu.com 로그인 후 개발자도구에서 쿠키를 복사해 전달할 것.",
      inputSchema: { query: z.string(), cookieString: z.string().optional(), maxItems: z.number().default(10) },
    },
    async ({ query, cookieString, maxItems }) => {
      try {
        const items = await searchXiaohongshu({ query, cookieString, maxItems });
        const lines = items.map((it) => `- "${(it.title ?? "").slice(0, 60)}" | ❤️${it.likes ?? "?"} | ${it.postUrl || ""}`);
        return { content: [{ type: "text", text: `${items.length}건:\n\n${lines.join("\n")}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "get_douyin_posts",
    {
      title: "도우인 계정 지정 조회",
      description: "profileUrl(계정 URL)로 그 계정의 영상을 가져온다. 무료 티어에서 실제 검증 완료(2026-08-29). 키워드 검색은 search_douyin 참고(유료 플랜 필요).",
      inputSchema: { profileUrl: z.string(), maxItems: z.number().default(10) },
    },
    async ({ profileUrl, maxItems }) => {
      try {
        const items = await getDouyinPosts({ profileUrl, maxItems });
        const lines = items.map((it) => `- "${(it.text ?? it.title ?? "").slice(0, 60)}" | ❤️${it.diggCount ?? it.likes ?? "?"} | ${it.webVideoUrl ?? it.url ?? ""}`);
        return { content: [{ type: "text", text: `${items.length}건:\n\n${lines.join("\n")}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  server.registerTool(
    "search_douyin",
    {
      title: "도우인 키워드 검색 (유료 플랜 필요)",
      description:
        "query(검색어/해시태그)로 도우인을 검색한다. ⚠️ 액터 개발자가 Apify 무료(비결제) 사용자에게 검색 기능 자체를 막아놔서(실제 확인됨, 2026-08-29) " +
        "Apify 유료 플랜으로 업그레이드해야 동작한다. 계정 지정 조회는 get_douyin_posts로 무료로 가능.",
      inputSchema: { query: z.string(), maxItems: z.number().default(10) },
    },
    async ({ query, maxItems }) => {
      try {
        const items = await searchDouyin({ query, maxItems });
        const lines = items.map((it) => `- "${(it.text ?? it.title ?? "").slice(0, 60)}" | ❤️${it.diggCount ?? it.likes ?? "?"} | ${it.webVideoUrl ?? it.url ?? ""}`);
        return { content: [{ type: "text", text: `${items.length}건:\n\n${lines.join("\n")}` }] };
      } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
      }
    }
  );

  return server;
}

// claude.ai 커스텀 커넥터 추가 화면은 헤더 토큰 입력칸이 없고 URL만 받는다.
// 게다가 완전 무인증으로 두면 claude.ai가 OAuth 클라이언트 동적등록(DCR)을 강제로
// 시도하다 실패해서 연결 자체가 안 되는 별도 버그가 있다(fresh-season/route.js에서도
// 같은 문제로 ?key= 쿼리파라미터 방식으로 되돌렸음). 그래서 헤더 대신 URL 쿼리파라미터로 인증한다:
// https://<배포도메인>/api/mcp?key=<MCP_SHARED_SECRET>
export default async function handler(req, res) {
  if (!ACCESS_TOKEN) {
    res.statusCode = 500;
    res.end("MCP_SHARED_SECRET not configured");
    return;
  }
  const url = new URL(req.url, `https://${req.headers.host}`);
  const key = url.searchParams.get("key");
  if (key !== ACCESS_TOKEN) {
    res.statusCode = 401;
    res.end("Unauthorized (key 쿼리파라미터 확인)");
    return;
  }

  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
