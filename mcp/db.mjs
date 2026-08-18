import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "superfinder.db");

export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dev_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS known_issues (
    feature TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    note TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    note TEXT,
    updated_at TEXT NOT NULL
  );
`);

function seedIfEmpty() {
  const issueCount = db.prepare("SELECT COUNT(*) AS c FROM known_issues").get().c;
  if (issueCount === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare(
      "INSERT INTO known_issues (feature, status, note, updated_at) VALUES (?, ?, ?, ?)"
    );
    const seed = [
      [
        "대본(스크립트) 가져오기",
        "broken",
        "server/index.mjs가 timedtext URL은 찾지만 서버에서 요청하면 빈 응답(200, len 0). 유튜브의 PO 토큰 요구 추정(2025년경 강화). Puppeteer 등 headless 브라우저 없이는 해결 어려움. UI는 실패시 원본과 동일하게 토스트로 우아하게 처리됨.",
        now,
      ],
      [
        "AMS 지수 / 일·7일·30일 조회수",
        "approximated",
        "원본은 비공개 백엔드의 시계열 DB를 사용. 이 클론은 자체 설계한 근사식(lib/ams.ts)으로 대체. 원본 숫자와 다름.",
        now,
      ],
      [
        "로그인(Clerk) / 결제(Toss Payments)",
        "not_implemented",
        "사용자 확인: 추후 붙일 예정이라 이번 구현에서 의도적으로 제외. 현재는 인증 없이 진입, 결제는 로컬 상태만 토글되는 데모.",
        now,
      ],
      [
        "쇼츠 찾기 업로드일자 '직접 선택'",
        "not_implemented",
        "프리셋(24시간/1주일/1개월/6개월/12개월)만 구현, 커스텀 날짜range picker는 미구현.",
        now,
      ],
      [
        "실 API 키로 데이터 렌더 확인",
        "unverified",
        "Claude에게 실제 YouTube API 키가 없어 검색 결과 카드가 실데이터로 정상 렌더되는지 육안 확인 못함. API 키 유효성 검증(verifyApiKey)은 실제 구글 서버 응답으로 확인됨(정상 동작).",
        now,
      ],
    ];
    for (const row of seed) insert.run(...row);
  }
}
seedIfEmpty();

export function nowIso() {
  return new Date().toISOString();
}
