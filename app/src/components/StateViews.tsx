import { AlertTriangle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { getApiKey } from "../lib/storage";

export function ApiKeyWarning() {
  if (getApiKey()) return null;
  return (
    <div className="mb-5 rounded-2xl px-5 py-4 bg-amber-50 border border-amber-200 flex items-center gap-3 flex-wrap">
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
      <p className="text-sm text-amber-800 flex-1 min-w-[200px]">
        YouTube API 키가 등록되지 않았습니다. 검색 기능을 사용하려면 먼저 API 키를 등록해 주세요.
      </p>
      <Link
        to="/api-key"
        className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-full whitespace-nowrap"
      >
        키 등록하기
      </Link>
    </div>
  );
}

export function LoadingGrid({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <div className="bg-white rounded-2xl py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl py-10 px-6 text-center text-red-600 text-sm">
      {message}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-2xl py-20 flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="text-4xl">{icon}</div>
      <div className="font-bold text-slate-900">{title}</div>
      {subtitle && <div className="text-sm text-slate-400 whitespace-pre-line">{subtitle}</div>}
    </div>
  );
}
