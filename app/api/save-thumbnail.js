// 유튜브 영상 썸네일을 Supabase Storage(finder-media 버킷)에 저장 (Vercel 서버리스).
import { getVideosById, thumbOf } from "./_youtube.js";
import { saveThumbnail } from "./_storage.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.json({ error: "POST만 지원합니다." });
    return;
  }

  const { videoId } = req.body || {};
  if (!videoId) {
    res.statusCode = 400;
    res.json({ error: "videoId가 필요합니다." });
    return;
  }

  try {
    const [video] = await getVideosById([videoId]);
    if (!video) {
      res.statusCode = 404;
      res.json({ error: "영상을 찾을 수 없습니다." });
      return;
    }
    const thumbUrl = thumbOf(video.snippet);
    if (!thumbUrl) {
      res.statusCode = 404;
      res.json({ error: "썸네일이 없습니다." });
      return;
    }
    const savedUrl = await saveThumbnail(videoId, thumbUrl);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.json({ url: savedUrl });
  } catch (e) {
    res.statusCode = 500;
    res.json({ error: e.message });
  }
}
