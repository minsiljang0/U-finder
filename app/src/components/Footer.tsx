import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-10 pt-6 border-t border-slate-100 text-center text-xs text-slate-400 pb-6">
      <div className="flex items-center justify-center gap-3 mb-2">
        <Link to="/policy/terms" className="hover:text-slate-600">
          이용약관
        </Link>
        <span>·</span>
        <Link to="/policy/privacy" className="hover:text-slate-600">
          개인정보처리방침
        </Link>
        <span>·</span>
        <Link to="/policy/refund" className="hover:text-slate-600">
          환불정책
        </Link>
      </div>
      <div>슈퍼파인더 · 개인 학습용 프로젝트 (비상업적 클론)</div>
    </footer>
  );
}
