import { Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { getTrialRemaining, isPremium } from "../lib/storage";

export default function TrialBanner() {
  if (isPremium()) return null;
  const { days, hours, expired } = getTrialRemaining();

  return (
    <div className="mb-5 rounded-2xl px-5 py-4 flex items-center gap-4 text-white bg-gradient-to-r from-indigo-600 to-violet-700 shadow-sm">
      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
        <Clock className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm sm:text-base">
          {expired ? "무료 체험이 종료되었습니다" : "무료 체험 이용 중"}
          {!expired && (
            <span className="ml-2 font-normal opacity-90">
              남은 시간 약 {days}일 {hours}시간
            </span>
          )}
        </div>
        <div className="text-xs sm:text-sm opacity-90 truncate">
          지금 프리미엄으로 전환하면 끊김 없이 모든 기능을 계속 이용할 수 있어요.
        </div>
      </div>
      <Link
        to="/pricing"
        className="shrink-0 bg-white text-indigo-700 font-semibold text-sm px-4 py-2 rounded-full flex items-center gap-1.5 hover:bg-indigo-50 transition-colors whitespace-nowrap"
      >
        <Sparkles className="w-4 h-4" />
        프리미엄 보기 <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
