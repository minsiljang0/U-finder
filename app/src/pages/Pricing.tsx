import { Check, Crown, Gift, MessageCircle } from "lucide-react";
import { isPremium, setPremium } from "../lib/storage";
import { useState } from "react";

const BENEFITS = [
  { label: "조회수 폭발 쇼츠 검색", note: "무제한 (필터 자유)" },
  { label: "황금 채널 발굴기", note: "실시간 무제한 분석" },
  { label: "터진 영상 실시간 추적", note: "실시간 무제한" },
  { label: "채널 랭킹", note: "무제한" },
  { label: "신규 기능 우선 제공", note: "베타 기능 즉시 제공" },
  { label: "고객 지원", note: "듀오랩스 전용 지원" },
];

export default function Pricing() {
  const [premium, setPremiumState] = useState(isPremium());

  function startPremium() {
    setPremium(true);
    setPremiumState(true);
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">요금제 안내</h2>
        <p className="text-slate-500 text-sm">3일 무료 체험 후, 프리미엄으로 모든 기능을 무제한 이용하세요.</p>
        <p className="text-xs text-amber-600 mt-2">
          * 이 클론은 실제 결제 연동이 없는 개인용 데모입니다. 버튼을 눌러도 로컬 상태만 바뀝니다.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 mb-8">
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">3일 무료 체험</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mb-1">₩0</div>
          <div className="text-xs text-slate-400 mb-4">카드 등록 없이 가입 즉시 시작</div>
          <div className="border-t border-emerald-100 pt-4 text-sm text-slate-600 mb-6">
            가입 후 3일간 모든 기능 무제한 체험. 종료 전 월간 프리미엄으로 이어가세요.
          </div>
          <button disabled className="w-full h-11 rounded-xl border border-emerald-300 text-emerald-700 font-semibold flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> 현재 이용 중
          </button>
        </div>

        <div className="relative rounded-2xl border-2 border-violet-300 bg-violet-50/40 p-6">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">
            👑 가장 인기
          </div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">월간 프리미엄</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mb-1">
            ₩99,000<span className="text-base font-medium text-slate-400"> / 월</span>
          </div>
          <div className="text-xs text-slate-400 mb-4">매월 자동결제 · 언제든 해지</div>
          <div className="border-t border-violet-100 pt-4 text-sm text-slate-600 mb-6">
            황금 채널 발굴기 · 쇼츠 검색 · 터진 영상 · 채널 랭킹 등 <b>모든 기능 무제한</b>
          </div>
          <button
            onClick={startPremium}
            disabled={premium}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {premium ? "이용 중" : "이 플랜으로 시작하기 →"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 mb-5">
        <h3 className="font-bold text-slate-900 mb-4">👑 모든 프리미엄 플랜 공통 혜택</h3>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
          {BENEFITS.map((b) => (
            <div key={b.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-violet-500" /> {b.label}
              </span>
              <span className="text-violet-600 font-medium">{b.note}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="font-bold text-slate-900 flex items-center gap-2 mb-2">
            <MessageCircle className="w-4 h-4" /> 궁금한 점이 있으신가요?
          </div>
          <p className="text-sm text-slate-600">필요한 기능이나 건의사항을 남겨주시면 반영하겠습니다.</p>
        </div>
      </div>
    </div>
  );
}
