import { useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const CONTENT: Record<string, { title: string; body: string }> = {
  terms: {
    title: "이용약관",
    body: `제1조 (목적)
이 약관은 슈퍼파인더(이하 "서비스")가 제공하는 채널·영상 분석 서비스의 이용 조건 및 절차를 규정함을 목적으로 합니다.

제2조 (서비스 이용)
서비스는 이용자 본인의 YouTube Data API 키를 등록해야 정상적으로 이용할 수 있습니다.
API 사용량, 할당량 초과 등으로 인한 문제는 Google의 정책을 따릅니다.

제3조 (면책)
이 서비스가 제공하는 분석 지표(AMS 지수, 조회수 추정치 등)는 자체 산출 지표이며,
투자·수익 등을 보장하지 않습니다. 참고 자료로만 활용하시기 바랍니다.

제4조 (약관의 변경)
본 약관은 서비스 운영 방침에 따라 사전 고지 후 변경될 수 있습니다.`,
  },
  privacy: {
    title: "개인정보처리방침",
    body: `1. 수집하는 개인정보
- 이메일 주소 (로그인/계정 식별용)
- YouTube Data API 키 (이용자가 직접 입력)

2. 개인정보의 이용 목적
로그인 인증 및 서비스 제공을 위한 목적으로만 사용하며, 제3자에게 제공하지 않습니다.

3. 개인정보의 보관
계정 정보는 인증 시스템(Supabase Auth)에 안전하게 저장되며, 즐겨찾기 등 이용 데이터는
회원별로 분리되어 관리됩니다.

4. 문의
개인정보 관련 문의는 고객센터를 통해 접수해 주세요.`,
  },
  refund: {
    title: "환불정책",
    body: `1. 환불 원칙
프리미엄 구독은 결제 후 7일 이내 서비스를 이용하지 않은 경우 전액 환불이 가능합니다.

2. 환불 절차
구독 관리 페이지에서 해지 요청 후 고객센터로 문의해 주시면 영업일 기준 3~5일 내 처리됩니다.

3. 환불 제한
정기결제 주기가 이미 시작되어 서비스를 이용한 경우, 이용 기간에 대해서는 환불이 제한될 수 있습니다.`,
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
