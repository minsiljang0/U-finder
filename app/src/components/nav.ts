import {
  BarChart3,
  Search,
  Flame,
  TrendingUp,
  Star,
  KeyRound,
  CreditCard,
  Sparkles,
  Globe2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  gradient: string; // Tailwind from/to
}

export const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "슈퍼 채널 발굴기",
    subtitle: "카테고리별 수익 채널 분석",
    icon: BarChart3,
    gradient: "from-violet-500 to-indigo-600",
  },
  {
    path: "/shorts-finder",
    label: "조회수 폭발 쇼츠 찾기",
    subtitle: "조건 맞춤 쇼츠 발굴",
    icon: Search,
    gradient: "from-rose-500 to-fuchsia-600",
  },
  {
    path: "/trending",
    label: "터진 영상",
    subtitle: "급등하는 영상 실시간 확인",
    icon: Flame,
    gradient: "from-orange-500 to-rose-600",
  },
  {
    path: "/ranking",
    label: "채널 랭킹",
    subtitle: "일간 조회수 기준 채널 순위",
    icon: TrendingUp,
    gradient: "from-teal-500 to-emerald-600",
  },
  {
    path: "/social-search",
    label: "멀티플랫폼 검색",
    subtitle: "Instagram · TikTok · 샤오홍슈 · 도우인",
    icon: Globe2,
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    path: "/favorites",
    label: "즐겨찾기",
    subtitle: "저장한 채널·영상 모아보기",
    icon: Star,
    gradient: "from-sky-500 to-blue-600",
  },
  {
    path: "/api-key",
    label: "YouTube API 키 설정",
    subtitle: "API 키 등록 및 인증",
    icon: KeyRound,
    gradient: "from-slate-500 to-slate-700",
  },
  {
    path: "/subscription",
    label: "구독 관리",
    subtitle: "결제수단 · 자동결제 · 환불",
    icon: CreditCard,
    gradient: "from-indigo-600 to-violet-700",
  },
  {
    path: "/pricing",
    label: "요금제 안내",
    subtitle: "트라이얼 vs 프리미엄 비교",
    icon: Sparkles,
    gradient: "from-fuchsia-600 to-pink-600",
  },
];
