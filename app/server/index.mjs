// 대본(자막) 프록시 전용 로컬 서버. 브라우저는 CORS 때문에 유튜브 워치 페이지를 직접
// 읽을 수 없으므로, 이 로컬 서버가 대신 워치 페이지에서 공개 자막 트랙(timedtext)을 찾아
// 텍스트로 변환해 돌려준다. 외부 API 키가 필요 없고, 원본이 "대본을 가져올 수 없습니다"라고
// 표시하는 것과 동일하게 자막이 없는 영상은 실패로 응답한다.
import http from "node:http";

const PORT = 8787;

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n/g, " ");
}

async function fetchTranscript(videoId) {
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "Accept-Language": "ko-KR,ko;q=0.9", "User-Agent": "Mozilla/5.0" },
  });
  if (!watchRes.ok) return null;
  const html = await watchRes.text();

  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) return null;

  let tracks;
  try {
    tracks = JSON.parse(match[1]);
  } catch {
    return null;
  }
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  const track = tracks.find((t) => t.languageCode?.startsWith("ko")) ?? tracks[0];
  const baseUrl = track.baseUrl?.replace(/\\u0026/g, "&");
  if (!baseUrl) return null;

  const xmlRes = await fetch(baseUrl);
  if (!xmlRes.ok) return null;
  const xml = await xmlRes.text();

  const lines = [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((m) => decodeEntities(m[1]).trim());
  const text = lines.filter(Boolean).join(" ");
  return text || null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const m = url.pathname.match(/^\/api\/transcript\/([\w-]{11})$/);
  if (!m) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  try {
    const text = await fetchTranscript(m[1]);
    if (!text) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ text: null }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ text }));
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, () => {
  console.log(`[유파인더] 대본 프록시 서버 실행 중 → http://localhost:${PORT}`);
});
