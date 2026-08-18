import { useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const CONTENT: Record<string, { title: string; body: string }> = {
  terms: {
    title: "이용약관",
    body: `제1조 (목적)
이 약관은 슈퍼파인더(이하 "서비스")의 이용 조건 및 절차를 규정함을 목적으로 합니다.
이 프로젝트는 개인 학습·참고용으로 제작된 클론이며, 실제 상업 서비스가 아닙니다.

제2조 (서비스 이용)
서비스는 이용자 본인의 YouTube Data API 키를 등록해야 정상적으로 이용할 수 있습니다.
API 사용량, 할당량 초과 등으로 인한 문제는 Google의 정책을 따릅니다.

제3조 (면책)
이 서비스가 제공하는 분석 지표(AMS 지수, 조회수 추정치 등)는 자체 근사 계산이며,
정확성을 보장하지 않습니다. 참고용으로만 사용하시기 바랍니다.

제4조 (약관의 변경)
본 약관은 서비스 운영 방침에 따라 사전 고지 없이 변경될 수 있습니다.`,
  },
  privacy: {
    title: "개인정보처리방침",
    body: `1. 수집하는 개인정보
- 이메일 주소 (로그인/계정 식별용)
- YouTube Data API 키 (이용자가 직접 입력, 브라우저에만 저장됨)

2. 개인정보의 이용 목적
로그인 인증 및 서비스 제공을 위한 목적으로만 사용하며, 제3자에게 제공하지 않습니다.

3. 개인정보의 보관
계정 정보는 Supabase(Auth)에 저장되며, 즐겨찾기·API 키 등은 이용자의 브라우저(localStorage)에만 저장됩니다.

4. 문의
이 프로젝트는 개인 학습용 데모이며, 별도의 개인정보보호책임자를 두지 않습니다.`,
  },
  refund: {
    title: "환불정책",
    body: `이 서비스는 실제 결제 기능이 연동되어 있지 않은 개인용 데모입니다.
"프리미엄 시작하기" 버튼을 눌러도 실제 결제는 발생하지 않으며, 로컬 상태만 변경됩니다.

따라서 별도의 환불 절차가 필요하지 않습니다.
실제 서비스로 운영할 경우, 관련 법령(전자상거래법 등)에 따른 환불 규정을 별도로 마련해야 합니다.`,
  },
};

export default function Policy() {
  const { slug } = useParams<{ slug: string }>();
  const data = CONTENT[slug ?? ""] ?? CONTENT.terms;

  return (
    <div className="max-w-2xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4">
        <ChevronLeft className="w-4 h-4" /> 돌아가기
      </Link>
      <div className="bg-white rounded-2xl p-8">
        <h1 className="text-xl font-bold text-slate-900 mb-6">{data.title}</h1>
        <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{data.body}</div>
      </div>
    </div>
  );
}
