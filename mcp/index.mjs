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

const transport = new StdioServerTransport();
await server.connect(transport);
