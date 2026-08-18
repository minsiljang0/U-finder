// 원격 MCP 엔드포인트 (Vercel 서버리스 함수). 로컬 stdio MCP(mcp/index.mjs)와 동일한 도구를
// HTTP로 제공해서, 이 컴퓨터가 아닌 어디서든(claude.ai 등) 같은 Supabase 프로젝트 데이터를
// 조회/기록할 수 있게 한다. MCP_ACCESS_TOKEN 환경변수로 접근을 제한한다(공개 인터넷에 떠 있으므로).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const TABLES = ["app_config", "dev_notes", "known_issues", "tasks"];

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pyplpivswdbrjytfqclm.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const ACCESS_TOKEN = process.env.MCP_ACCESS_TOKEN;

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

  return server;
}

// claude.ai 커스텀 커넥터 추가 화면은 헤더 토큰 입력칸이 없고 URL만 받는다.
// 게다가 완전 무인증으로 두면 claude.ai가 OAuth 클라이언트 동적등록(DCR)을 강제로
// 시도하다 실패해서 연결 자체가 안 되는 별도 버그가 있다(fresh-season/route.js에서도
// 같은 문제로 ?key= 쿼리파라미터 방식으로 되돌렸음). 그래서 헤더 대신 URL 쿼리파라미터로 인증한다:
// https://<배포도메인>/api/mcp?key=<MCP_ACCESS_TOKEN>
export default async function handler(req, res) {
  if (!ACCESS_TOKEN) {
    res.statusCode = 500;
    res.end("MCP_ACCESS_TOKEN not configured");
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
