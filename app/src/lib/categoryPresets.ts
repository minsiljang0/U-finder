// 원본 사이트의 "관심 주제" 13개 카테고리 → YouTube 검색 키워드 프리셋.
// 원본은 자체 백엔드 큐레이션 DB를 쓰지만, 이 클론은 사용자의 YouTube Data API 키로
// 그 자리에서 검색해 근사한다 (PLAN.md §0 참고).

export interface CategoryPreset {
  id: string;
  label: string;
  color: string; // Tailwind 배경색 (선택 시)
  textColor: string;
  queries: string[];
}

export const CATEGORIES: CategoryPreset[] = [
  {
    id: "health",
    label: "건강/의학",
    color: "bg-emerald-500",
    textColor: "text-emerald-700",
    queries: ["건강 정보 쇼츠", "의학 상식", "질병 예방 꿀팁"],
  },
  {
    id: "movie",
    label: "영화/드라마 리뷰",
    color: "bg-indigo-500",
    textColor: "text-indigo-700",
    queries: ["영화 리뷰 결말포함", "드라마 몰아보기", "영화 추천"],
  },
  {
    id: "celeb-issue",
    label: "연예인/이슈",
    color: "bg-pink-500",
    textColor: "text-pink-700",
    queries: ["연예인 이슈", "사건사고 연예", "핫이슈 정리"],
  },
  {
    id: "celeb-pick",
    label: "연예인 추천템",
    color: "bg-fuchsia-500",
    textColor: "text-fuchsia-700",
    queries: ["연예인 추천 아이템", "연예인 애용템"],
  },
  {
    id: "money",
    label: "재테크/부동산",
    color: "bg-amber-500",
    textColor: "text-amber-700",
    queries: ["재테크 꿀팁", "부동산 정보", "주식 초보"],
  },
  {
    id: "motivation",
    label: "동기부여/명언",
    color: "bg-orange-500",
    textColor: "text-orange-700",
    queries: ["동기부여 영상", "인생 명언", "자기계발"],
  },
  {
    id: "aiit",
    label: "AI/IT 꿀팁",
    color: "bg-cyan-500",
    textColor: "text-cyan-700",
    queries: ["AI 활용법", "IT 꿀팁", "chatgpt 활용"],
  },
  {
    id: "lifestyle",
    label: "라이프스타일/Vlog",
    color: "bg-violet-500",
    textColor: "text-violet-700",
    queries: ["브이로그", "일상 브이로그", "라이프스타일"],
  },
  {
    id: "pet",
    label: "반려동물",
    color: "bg-lime-500",
    textColor: "text-lime-700",
    queries: ["강아지 영상", "고양이 영상", "반려동물 꿀팁"],
  },
  {
    id: "blackbox",
    label: "블랙박스/사건사고",
    color: "bg-rose-500",
    textColor: "text-rose-700",
    queries: ["블랙박스 사고", "교통사고 블랙박스", "실제상황"],
  },
  {
    id: "beauty",
    label: "뷰티",
    color: "bg-red-400",
    textColor: "text-red-600",
    queries: ["뷰티 꿀팁", "메이크업", "스킨케어"],
  },
  {
    id: "cooking",
    label: "요리",
    color: "bg-yellow-500",
    textColor: "text-yellow-700",
    queries: ["요리 레시피", "집밥 레시피", "간단 요리"],
  },
  {
    id: "travel",
    label: "여행",
    color: "bg-teal-500",
    textColor: "text-teal-700",
    queries: ["여행 브이로그", "국내여행 추천", "해외여행 꿀팁"],
  },
];

export function getCategory(id: string): CategoryPreset | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
