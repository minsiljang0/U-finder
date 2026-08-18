import { useState } from "react";
import { FileText, Loader2, X } from "lucide-react";

/**
 * 원본의 "대본" 배지 재현. 클릭 시 로컬 프록시(/api/transcript/:id)로 YouTube 공개 자막을
 * best-effort로 가져온다. 자막이 없으면 원본과 동일하게 에러 토스트를 띄운다.
 * 로컬 프록시 서버(server/)가 꺼져 있으면 자동으로 "가져올 수 없음" 처리된다.
 */
export default function ScriptButton({ videoId, title }: { videoId: string; title: string }) {
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (transcript) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transcript/${videoId}`);
      if (!res.ok) throw new Error("no transcript");
      const data = await res.json();
      if (!data.text) throw new Error("no transcript");
      setTranscript(data.text);
      setOpen(true);
    } catch {
      setError("이 영상은 대본을 가져올 수 없습니다.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="absolute top-2 right-2 bg-black/60 hover:bg-black/75 text-white text-[11px] font-medium px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm z-10"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
        대본
      </button>
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 flex items-center gap-2">
          {error}
        </div>
      )}
      {open && transcript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 truncate pr-4">{title}</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {transcript}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
