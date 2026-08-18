import { useState } from "react";
import { Eye, EyeOff, CheckCircle2, ChevronUp, ChevronDown, KeyRound } from "lucide-react";
import { getApiKey, setApiKey, clearApiKey } from "../lib/storage";
import { verifyApiKey } from "../lib/youtube";

export default function ApiKeySetup() {
  const [value, setValue] = useState(getApiKey());
  const [show, setShow] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message?: string } | null>(getApiKey() ? { ok: true } : null);
  const [guideOpen, setGuideOpen] = useState(true);

  async function onVerify() {
    if (!value.trim()) return;
    setVerifying(true);
    setStatus(null);
    const result = await verifyApiKey(value.trim());
    setStatus(result);
    if (result.ok) setApiKey(value.trim());
    setVerifying(false);
  }

  function onClear() {
    clearApiKey();
    setValue("");
    setStatus(null);
  }

  return (
    <div>
      <div className="bg-white rounded-2xl p-6 mb-5">
        <h2 className="font-bold text-lg text-slate-900 mb-2">YouTube Data API 키</h2>
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
          '조회수 폭발 쇼츠 찾기'를 비롯한 모든 검색 기능은 사용자 본인의 YouTube Data API 키가 필요합니다.{" "}
          <b className="text-slate-700">Google이 무료로 발급</b>하는 키이며(하루 무료 사용량으로 충분), 아래 가이드를
          그대로 따라 하면 <b className="text-slate-700">3분</b>이면 만들 수 있어요.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={show ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full h-11 pl-4 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <button
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={onVerify}
            disabled={!value.trim() || verifying}
            className="h-11 px-6 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-40 disabled:bg-slate-300 whitespace-nowrap"
          >
            {verifying ? "확인 중..." : "인증하기"}
          </button>
        </div>

        {status && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${status.ok ? "text-emerald-600" : "text-red-500"}`}>
            {status.ok && <CheckCircle2 className="w-4 h-4" />}
            {status.ok ? status.message ?? "키가 등록되었습니다." : status.message}
          </div>
        )}
        {getApiKey() && (
          <button onClick={onClear} className="mt-3 text-xs text-slate-400 hover:text-red-500 underline">
            등록된 키 삭제
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6">
        <button className="w-full flex items-center justify-between" onClick={() => setGuideOpen((o) => !o)}>
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> 왕초보도 3분 만에 따라 하는 API 키 발급 가이드
          </h3>
          {guideOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {guideOpen && (
          <div className="mt-5 flex flex-col gap-5">
            <Step n={1} title="구글 클라우드 접속하기">
              먼저{" "}
              <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">
                구글 클라우드 콘솔 (console.cloud.google.com)
              </a>
              에 들어간 뒤, 평소 쓰는 <Kbd>구글 계정</Kbd>으로 로그인해 주세요.
            </Step>
            <Step n={2} title="새로운 방(프로젝트) 만들기">
              화면 맨 위쪽 왼쪽에 있는 <Kbd>프로젝트 선택</Kbd> 글씨를 누르고, 오른쪽 위에 나타나는 <Kbd>새 프로젝트</Kbd>{" "}
              창을 눌러 이름을 아무거나 지어주세요.
            </Step>
            <Step n={3} title="유튜브 전용 스위치 켜기">
              화면 가운데에 있는 검색창에 <Kbd>YouTube Data API v3</Kbd> 라고 타자를 쳐서 검색하세요. 파란색 유튜브
              아이콘이 나오면 클릭한 뒤, <Kbd>사용</Kbd> (또는 <Kbd>Enable</Kbd>) 파란색 버튼을 눌러 스위치를 켜주세요.
            </Step>
            <Step n={4} title="내 전용 열쇠(API 키) 복사하기">
              화면 왼쪽 메뉴에서 <Kbd>사용자 인증 정보</Kbd>(Credentials)를 누르고, 위쪽의{" "}
              <Kbd>+ 사용자 인증 정보 만들기</Kbd>를 눌러 <Kbd>API 키</Kbd>를 선택하세요. 길고 복잡한 영어가 나타나면
              그 옆에 있는 <Kbd>복사하기</Kbd> 버튼을 눌러주시면 끝입니다! 🎉
            </Step>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <div>
        <div className="font-semibold text-slate-900 mb-1">{title}</div>
        <div className="text-sm text-slate-600 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium text-[13px]">{children}</span>;
}
