import { RefreshCw } from "lucide-react";
import { getTrialRemaining, isPremium } from "../lib/storage";

export default function Subscription() {
  const { days, hours, expired } = getTrialRemaining();
  const premium = isPremium();

  return (
    <div>
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
        <p className="text-xs text-slate-300 mt-3">
          * 이 클론은 개인 학습용이라 실제 결제(Toss Payments 등) 연동 없이 로컬 데모로만 동작합니다.
        </p>
      </div>
    </div>
  );
}
