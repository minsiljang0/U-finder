// 유튜브 썸네일 이미지를 Supabase Storage에 저장하는 헬퍼.
// 실제 영상 파일이 아니라 공개 썸네일 이미지만 캐싱한다(유튜브 임베드 관행상 허용되는 범위).
const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://pyplpivswdbrjytfqclm.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = "finder-media";

function headers(extra = {}) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...extra };
}

let bucketEnsured = false;
async function ensureBucket() {
  if (bucketEnsured) return;
  const check = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, { headers: headers() });
  // Supabase Storage는 버킷 없음을 HTTP 404가 아니라 400(+body.code === "NoSuchBucket")으로 응답한다.
  if (!check.ok) {
    const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
    if (!create.ok) {
      const body = await create.text().catch(() => "");
      if (!body.includes("already exists") && !body.includes("Duplicate")) {
        throw new Error(`Storage 버킷 생성 실패 (${create.status}): ${body}`);
      }
    }
  }
  bucketEnsured = true;
}

export async function saveThumbnail(videoId, thumbUrl) {
  await ensureBucket();
  const imgRes = await fetch(thumbUrl);
  if (!imgRes.ok) throw new Error(`썸네일 다운로드 실패 (${imgRes.status}): ${thumbUrl}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const path = `youtube/${videoId}.jpg`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": contentType, "x-upsert": "true" }),
    body: buf,
  });
  if (!up.ok) throw new Error(`Storage 업로드 실패 (${up.status}): ${await up.text().catch(() => "")}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
