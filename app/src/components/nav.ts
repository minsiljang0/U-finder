import {
  BarChart3,
  Search,
  Flame,
  TrendingUp,
  Star,
  KeyRound,
  CreditCard,
  Sparkles,
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
    label: "황금 채널 발굴기",
    subtitle: "카테고리별 수익 채널 분석",
    icon: BarChart3,
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    path: "/shorts-finder",
    label: "조회수 폭발 쇼츠 찾기",
    subtitle: "조건 맞춤 쇼츠 발굴",
    icon: Search,
    gradient: "from-fuchsia-500 to-pink-500",
  },
  {
    path: "/trending",
    label: "터진 영상",
    subtitle: "급등하는 영상 실시간 확인",
    icon: Flame,
    gradient: "from-orange-500 to-red-500",
  },
  {
    path: "/ranking",
    label: "채널 랭킹",
    subtitle: "일간 조회수 기준 채널 순위",
    icon: TrendingUp,
    gradient: "from-emerald-500 to-green-500",
  },
  {
    path: "/favorites",
    label: "즐겨찾기",
    subtitle: "저장한 채널·영상 모아보기",
    icon: Star,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    path: "/api-key",
    label: "YouTube API 키 설정",
    subtitle: "API 키 등록 및 인증",
    icon: KeyRound,
    gradient: "from-orange-500 to-amber-600",
  },
  {
    path: "/subscription",
    label: "구독 관리",
    subtitle: "결제수단 · 자동결제 · 환불",
    icon: CreditCard,
    gradient: "from-slate-600 to-slate-800",
  },
  {
    path: "/pricing",
    label: "요금제 안내",
    subtitle: "트라이얼 vs 프리미엄 비교",
    icon: Sparkles,
    gradient: "from-violet-500 to-purple-600",
  },
];
