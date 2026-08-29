#!/usr/bin/env node
// 슈퍼파인더 프로젝트 관리용 로컬 MCP 서버.
// 어느 Claude Code 세션에서든(이 프로젝트를 열면) 아래 도구로 프로젝트 현황을 조회/기록할 수 있다.
// 데이터는 Supabase(pyplpivswdbrjytfqclm)에 저장되어, 로컬 SQLite와 달리 이 프로젝트를 아는
// 다른 도구/세션에서도 같은 데이터를 공유해서 볼 수 있다.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectAllSimple, upsertRow as supaUpsert, insertRow, updateRow, deleteRow as supaDelete, runSelectSql } from "./supabase.mjs";
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
} from "./youtube.mjs";
import { saveThumbnail } from "./storage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAN_PATH = path.join(__dirname, "..", "PLAN.md");

const TABLES = ["app_config", "dev_notes", "known_issues", "tasks"];
const nowIso = () => new Date().toISOString();

const GITHUB_REPO = "minsiljang0/U-finder";
function ghHeaders() {
  const h = { "User-Agent": "superfinder-mcp" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

const server = new McpServer({ name: "superfinder-mcp", version: "0.2.0" });

server.registerTool(
  "list_tables",
  {
    title: "테이블 목록",
    description: "슈퍼파인더 관리 DB(Supabase)의 테이블 목록을 반환한다: app_config, dev_notes, known_issues, tasks",
  },
  async () => ({ content: [{ type: "text", text: JSON.stringify(TABLES) }] })
);

server.registerTool(
  "get_rows",
  {
    title: "테이블 행 조회",
    description: "지정한 테이블의 전체 행을 Supabase에서 조회한다.",
    inputSchema: { table: z.enum(TABLES) },
  },
  async ({ table }) => {
    const rows = await selectAllSimple(table);
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

server.registerTool(
  "run_sql",
  {
    title: "읽기 전용 조회",
    description: "'select * from <table>' 형태의 조회만 지원(Supabase REST 제약). 그 외엔 get_rows를 쓰세요.",
    inputSchema: { query: z.string() },
  },
  async ({ query }) => {
    try {
      const rows = await runSelectSql(query);
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: e.message }], isError: true };
    }
  }
);

server.registerTool(
  "upsert_row",
  {
    title: "행 삽입/수정",
    description:
      "known_issues(feature를 키로 upsert), app_config(key를 키로 upsert), dev_notes(항상 새 행 삽입), tasks(id 있으면 수정, 없으면 삽입)에 사용.",
    inputSchema: {
      table: z.enum(TABLES),
      data: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
    },
  },
  async ({ table, data }) => {
    const now = nowIso();
    try {
      if (table === "known_issues") {
        await supaUpsert(
          "known_issues",
          { feature: data.feature, status: data.status ?? "unknown", note: data.note ?? "", updated_at: now },
          "feature"
        );
      } else if (table === "app_config") {
        await supaUpsert("app_config", { key: data.key, value: data.value ?? "", updated_at: now }, "key");
      } else if (table === "dev_notes") {
        await insertRow("dev_notes", { note: data.note ?? "" });
      } else if (table === "tasks") {
        if (data.id) {
          await updateRow("tasks", "id", data.id, { subject: data.subject, status: data.status ?? "pending", note: data.note ?? null, updated_at: now });
        } else {
          await insertRow("tasks", { subject: data.subject ?? "", status: data.status ?? "pending", note: data.note ?? null, updated_at: now });
        }
      }
      return { content: [{ type: "text", text: "OK" }] };
    } catch (e) {
      return { content: [{ type: "text", text: e.message }], isError: true };
    }
  }
);

server.registerTool(
  "delete_row",
  {
    title: "행 삭제",
    description: "known_issues는 feature로, app_config는 key로, dev_notes/tasks는 id로 삭제.",
    inputSchema: { table: z.enum(TABLES), id: z.union([z.string(), z.number()]) },
  },
  async ({ table, id }) => {
    try {
      const col = table === "known_issues" ? "feature" : table === "app_config" ? "key" : "id";
      await supaDelete(table, col, id);
      return { content: [{ type: "text", text: "OK" }] };
    } catch (e) {
      return { content: [{ type: "text", text: e.message }], isError: true };
    }
  }
);

server.registerTool(
  "get_plan",
  { title: "PLAN.md 조회", description: "슈퍼파인더 기획서(PLAN.md) 전체 내용을 반환한다." },
  async () => {
    const text = fs.existsSync(PLAN_PATH) ? fs.readFileSync(PLAN_PATH, "utf8") : "(PLAN.md 없음)";
    return { content: [{ type: "text", text }] };
  }
);

server.registerTool(
  "append_dev_note",
  {
    title: "진행 노트 기록",
    description: "dev_notes 테이블(Supabase)에 새 노트를 남기고, PLAN.md 하단 '진행 로그' 섹션에도 함께 append한다.",
    inputSchema: { note: z.string() },
  },
  async ({ note }) => {
    const now = nowIso();
    await insertRow("dev_notes", { note });

    let plan = fs.existsSync(PLAN_PATH) ? fs.readFileSync(PLAN_PATH, "utf8") : "";
    if (!plan.includes("## 8. 진행 로그")) {
      plan += "\n\n## 8. 진행 로그\n\n(append_dev_note로 자동 기록됨)\n";
    }
    plan += `\n- [${now}] ${note}`;
    fs.writeFileSync(PLAN_PATH, plan, "utf8");

    return { content: [{ type: "text", text: "기록됨" }] };
  }
);

server.registerTool(
  "get_known_issues",
  { title: "알려진 이슈 조회", description: "현재 구현 상태/한계로 기록된 known_issues 전체를 반환한다." },
  async () => {
    const rows = await selectAllSimple("known_issues", "updated_at.desc");
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
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
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${p ?? ""}${ref ? `?ref=${ref}` : ""}`;
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) return { content: [{ type: "text", text: `GitHub API 오류 (${res.status})` }], isError: true };
    const data = await res.json();
    const list = Array.isArray(data) ? data : [data];
    const text = list.map((f) => `${f.type === "dir" ? "📁" : "📄"} ${f.path}${f.type === "file" ? ` (${f.size} bytes)` : ""}`).join("\n");
    return { content: [{ type: "text", text }] };
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
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${p}${ref ? `?ref=${ref}` : ""}`;
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) return { content: [{ type: "text", text: `GitHub API 오류 (${res.status})` }], isError: true };
    const data = await res.json();
    if (data.type !== "file") return { content: [{ type: "text", text: "파일이 아닙니다." }], isError: true };
    const text = Buffer.from(data.content, "base64").toString("utf8");
    return { content: [{ type: "text", text }] };
  }
);

// ── 회원님 대신 실제로 유튜브를 검색하는 도구들. app/api/mcp.js(원격)와 동일 로직. ──

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

const transport = new StdioServerTransport();
await server.connect(transport);
