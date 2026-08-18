// Supabase REST(PostgREST) 클라이언트. service_role 성격의 secret key를 쓰므로 RLS 우회(백엔드 전용).
const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://pyplpivswdbrjytfqclm.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_KEY) {
  throw new Error("SUPABASE_SECRET_KEY 환경변수가 필요합니다 (.mcp.json의 env 설정 참고).");
}

const BASE = `${SUPABASE_URL}/rest/v1`;
const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/${path}`, { ...options, headers: { ...HEADERS, ...(options.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase 오류 (${res.status}): ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function selectAll(table) {
  return request(`${table}?select=*&order=updated_at.desc,created_at.desc,id.desc`.replace(/&order=[^&]*$/, (m) => m));
}

export async function selectAllSimple(table, order) {
  return request(`${table}?select=*${order ? `&order=${order}` : ""}`);
}

export async function upsertRow(table, data, conflictKey) {
  return request(`${table}?on_conflict=${conflictKey}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(data),
  });
}

export async function insertRow(table, data) {
  return request(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
}

export async function updateRow(table, matchColumn, matchValue, data) {
  return request(`${table}?${matchColumn}=eq.${encodeURIComponent(matchValue)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
}

export async function deleteRow(table, matchColumn, matchValue) {
  return request(`${table}?${matchColumn}=eq.${encodeURIComponent(matchValue)}`, { method: "DELETE" });
}

export async function runSelectSql(rawQuery) {
  // PostgREST는 임의 SQL을 직접 못 돌리므로, SELECT * FROM table 형태만 최소 지원.
  const m = rawQuery.trim().match(/^select\s+\*\s+from\s+(\w+)\s*;?$/i);
  if (!m) throw new Error("이 run_sql은 'select * from <table>' 형태만 지원합니다. 다른 조회는 get_rows를 쓰세요.");
  return selectAllSimple(m[1]);
}
