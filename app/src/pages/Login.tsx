import { useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { signInWithPassword, signUpWithPassword, signInWithGoogle } from "../lib/useAuth";

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const fn = mode === "signin" ? signInWithPassword : signUpWithPassword;
    const { error } = await fn(email, password);
    if (error) {
      setError(error.message);
    } else if (mode === "signup") {
      setNotice("가입 완료. 이메일 인증이 필요하면 받은편지함을 확인해주세요. 인증 후 로그인해주세요.");
      setMode("signin");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center mb-3">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-bold text-lg text-slate-900">슈퍼파인더</h1>
          <p className="text-xs text-slate-400 mt-1">{mode === "signin" ? "로그인" : "계정 만들기"}</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
            className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />

          {error && <p className="text-sm text-red-500">{error}</p>}
          {notice && <p className="text-sm text-emerald-600">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 mt-1"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "signin" ? "로그인" : "가입하기"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-600 mt-4"
        >
          {mode === "signin" ? "계정이 없으신가요? 가입하기" : "이미 계정이 있으신가요? 로그인"}
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-slate-100 flex-1" />
          <span className="text-[11px] text-slate-300">또는</span>
          <div className="h-px bg-slate-100 flex-1" />
        </div>

        <button
          onClick={() => signInWithGoogle()}
          className="w-full h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 flex items-center justify-center gap-2 hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google로 계속하기
        </button>
      </div>
    </div>
  );
}
