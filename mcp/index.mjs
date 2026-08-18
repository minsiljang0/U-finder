#!/usr/bin/env node
// 슈퍼파인더 프로젝트 관리용 로컬 MCP 서버.
// 어느 Claude Code 세션에서든(이 프로젝트를 열면) 아래 도구로 프로젝트 현황을 조회/기록할 수 있다.
// fresh-season류 프로젝트의 관리 MCP 패턴(list_tables/get_rows/upsert_row/run_sql/append_note)을 참고해
// 이 프로젝트(로컬 SQLite, GitHub/Supabase 없음) 규모에 맞게 로컬 stdio 서버로 구현했다.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { db, nowIso } from "./db.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAN_PATH = path.join(__dirname, "..", "PLAN.md");

const TABLES = ["app_config", "dev_notes", "known_issues", "tasks"];

const server = new McpServer({ name: "superfinder-mcp", version: "0.1.0" });

server.registerTool(
  "list_tables",
  {
    title: "테이블 목록",
    description: "슈퍼파인더 관리 DB(SQLite)의 테이블 목록을 반환한다: app_config, dev_notes, known_issues, tasks",
  },
  async () => ({ content: [{ type: "text", text: JSON.stringify(TABLES) }] })
);

server.registerTool(
  "get_rows",
  {
    title: "테이블 행 조회",
    description: "지정한 테이블의 전체 행을 조회한다.",
    inputSchema: { table: z.enum(TABLES) },
  },
  async ({ table }) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC`).all();
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

server.registerTool(
  "run_sql",
  {
    title: "읽기 전용 SQL 실행",
    description: "SELECT 쿼리만 실행 가능한 읽기 전용 SQL 도구. INSERT/UPDATE/DELETE는 거부된다 (upsert_row/delete_row 사용).",
    inputSchema: { query: z.string() },
  },
  async ({ query }) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed.startsWith("select")) {
      return {
        content: [{ type: "text", text: "거부됨: run_sql은 SELECT만 허용합니다. 쓰기는 upsert_row/delete_row를 사용하세요." }],
        isError: true,
      };
    }
    try {
      const rows = db.prepare(query).all();
      return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `SQL 오류: ${e.message}` }], isError: true };
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
    if (table === "known_issues") {
      db.prepare(
        `INSERT INTO known_issues (feature, status, note, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(feature) DO UPDATE SET status=excluded.status, note=excluded.note, updated_at=excluded.updated_at`
      ).run(String(data.feature), String(data.status ?? "unknown"), String(data.note ?? ""), now);
    } else if (table === "app_config") {
      db.prepare(
        `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
      ).run(String(data.key), String(data.value ?? ""), now);
    } else if (table === "dev_notes") {
      db.prepare("INSERT INTO dev_notes (note, created_at) VALUES (?, ?)").run(String(data.note ?? ""), now);
    } else if (table === "tasks") {
      if (data.id) {
        db.prepare("UPDATE tasks SET subject=?, status=?, note=?, updated_at=? WHERE id=?").run(
          String(data.subject ?? ""),
          String(data.status ?? "pending"),
          data.note ? String(data.note) : null,
          now,
          Number(data.id)
        );
      } else {
        db.prepare("INSERT INTO tasks (subject, status, note, updated_at) VALUES (?, ?, ?, ?)").run(
          String(data.subject ?? ""),
          String(data.status ?? "pending"),
          data.note ? String(data.note) : null,
          now
        );
      }
    }
    return { content: [{ type: "text", text: "OK" }] };
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
    if (table === "known_issues") db.prepare("DELETE FROM known_issues WHERE feature=?").run(String(id));
    else if (table === "app_config") db.prepare("DELETE FROM app_config WHERE key=?").run(String(id));
    else db.prepare(`DELETE FROM ${table} WHERE id=?`).run(Number(id));
    return { content: [{ type: "text", text: "OK" }] };
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
    description: "dev_notes 테이블에 새 노트를 남기고, PLAN.md 하단 '진행 로그' 섹션에도 함께 append한다.",
    inputSchema: { note: z.string() },
  },
  async ({ note }) => {
    const now = nowIso();
    db.prepare("INSERT INTO dev_notes (note, created_at) VALUES (?, ?)").run(note, now);

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
    const rows = db.prepare("SELECT * FROM known_issues ORDER BY updated_at DESC").all();
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
