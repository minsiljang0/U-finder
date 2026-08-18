import { useEffect, useState } from "react";
import { ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/useAuth";

const OWNER_EMAIL = "minsiljang0@gmail.com";

interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  provider: string;
  displayName: string | null;
}

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    try {
      const res = await fetch("/api/admin-users", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "조회 실패");
      setUsers(json.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.email === OWNER_EMAIL) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  if (user?.email !== OWNER_EMAIL) {
    return (
      <div className="bg-white rounded-2xl p-10 flex flex-col items-center text-center gap-2">
        <ShieldAlert className="w-8 h-8 text-slate-300" />
        <div className="font-bold text-slate-900">관리자만 접근할 수 있습니다</div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-2xl p-4 mb-5 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          가입 회원 <b className="text-slate-900">{users?.length ?? 0}명</b>
        </div>
        <button onClick={load} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 새로고침
        </button>
      </div>

      {loading && !users && (
        <div className="bg-white rounded-2xl py-16 flex justify-center text-slate-300">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-600">{error}</div>}

      {users && (
        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_160px_160px] gap-2 px-4 py-2.5 text-xs font-semibold text-slate-400 border-b border-slate-100">
            <div>이메일</div>
            <div>가입 경로</div>
            <div>가입일</div>
            <div>최근 로그인</div>
          </div>
          {users.map((u) => (
            <div key={u.id} className="grid grid-cols-[1fr_120px_160px_160px] gap-2 px-4 py-3 items-center border-b border-slate-50 last:border-0 text-sm">
              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate">{u.displayName || u.email}</div>
                {u.displayName && <div className="text-xs text-slate-400 truncate">{u.email}</div>}
              </div>
              <div className="text-slate-500">{u.provider}</div>
              <div className="text-slate-500">{new Date(u.createdAt).toLocaleDateString("ko-KR")}</div>
              <div className="text-slate-500">{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString("ko-KR") : "-"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
