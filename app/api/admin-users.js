// 관리자 전용: 가입 회원 목록 조회 (Vercel 서버리스 함수).
// 요청 헤더의 Supabase 세션 토큰을 검증해 "소유자 이메일"인 경우에만 회원 목록을 반환한다.
// 목록 조회 자체는 secret key(서비스 롤)로만 가능하므로 반드시 서버에서만 수행한다.

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pyplpivswdbrjytfqclm.supabase.co";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL || "minsiljang0@gmail.com";

export default async function handler(req, res) {
  if (!SUPABASE_SECRET_KEY) {
    res.statusCode = 500;
    res.json({ error: "SUPABASE_SECRET_KEY not configured" });
    return;
  }

  const auth = req.headers["authorization"] || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.statusCode = 401;
    res.json({ error: "로그인이 필요합니다." });
    return;
  }

  // 1) 요청자 신원 확인 (본인 세션 토큰으로 /auth/v1/user 조회)
  const whoRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${token}` },
  });
  if (!whoRes.ok) {
    res.statusCode = 401;
    res.json({ error: "세션이 유효하지 않습니다." });
    return;
  }
  const who = await whoRes.json();
  if (who.email !== OWNER_EMAIL) {
    res.statusCode = 403;
    res.json({ error: "관리자만 접근할 수 있습니다." });
    return;
  }

  // 2) 소유자 확인됐으면 전체 회원 목록 조회 (Admin API, secret key 필요)
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` },
  });
  if (!listRes.ok) {
    res.statusCode = 500;
    res.json({ error: "회원 목록 조회 실패" });
    return;
  }
  const list = await listRes.json();
  const users = (list.users || []).map((u) => ({
    id: u.id,
    email: u.email,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at,
    provider: u.app_metadata?.provider ?? "email",
    displayName: u.user_metadata?.display_name ?? null,
  }));

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.json({ users });
}
