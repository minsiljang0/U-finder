import { useState } from "react";
import { RefreshCw, Check } from "lucide-react";
import { getTrialRemaining, isPremium } from "../lib/storage";
import { useAuth, updateDisplayName, updatePassword } from "../lib/useAuth";

function AccountCard() {
  const { user } = useAuth();
  const [name, setName] = useState((user?.user_metadata?.display_name as string) ?? "");
  const [password, setPassword] = useState("");
  const [savedName, setSavedName] = useState(false);
  const [savedPw, setSavedPw] = useState(false);

  async function onSaveName() {
    await updateDisplayName(name);
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2000);
  }

  async function onSavePassword() {
    if (password.length < 6) return;
    await updatePassword(password);
    setPassword("");
    setSavedPw(true);
    setTimeout(() => setSavedPw(false), 2000);
  }

  return (
    <div className="bg-white rounded-2xl p-6 mb-5">
      <h2 className="font-bold text-slate-900 mb-4">계정</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">이메일</label>
          <div className="h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm flex items-center text-slate-500">
            {user?.email}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">표시 이름</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              className="flex-1 h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <button
              onClick={onSaveName}
              className="h-11 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold whitespace-nowrap flex items-center gap-1"
            >
              {savedName ? <Check className="w-4 h-4" /> : "저장"}
            </button>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-500 mb-1">비밀번호 변경</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="새 비밀번호 (6자 이상)"
              className="flex-1 h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <button
              onClick={onSavePassword}
              disabled={password.length < 6}
              className="h-11 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold whitespace-nowrap disabled:opacity-40 flex items-center gap-1"
            >
              {savedPw ? <Check className="w-4 h-4" /> : "변경"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Subscription() {
  const { days, hours, expired } = getTrialRemaining();
  const premium = isPremium();

  return (
    <div>
      <AccountCard />

      <div className="bg-white rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">현재 구독</h2>
          <button className="text-sm text-slate-400 hover:text-slate-700 flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> 새로고침
          </button>
        </div>

        {premium ? (
          <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
            <div className="text-xs text-violet-500 font-semibold mb-1">월간 프리미엄</div>
            <div className="text-xl font-bold text-violet-700">이용 중</div>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs text-amber-600 font-semibold mb-1">이용 잔여 기간</div>
              <div className="text-xs text-amber-600 font-semibold">무료 체험</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-amber-700">
                {expired ? "체험 종료" : `약 ${days * 24 + hours}시간 남음`}
              </div>
            </div>
          </div>
        )}

        <p className="text-sm text-slate-400 mt-4">
          {premium ? "언제든 해지할 수 있습니다." : "트라이얼이 만료되면 자동으로 결제 안내가 표시됩니다."}
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-3">결제 이력</h2>
        <p className="text-sm text-slate-400">결제 이력이 없습니다.</p>
      </div>
    </div>
  );
}
