# 슈퍼파인더 (Golden Finder 클론) 기획서

- 작성일: 2026-08-18
- 목적: golden-finder.com 학습/개인 참고용 클론. **개인 사용 전용**, 배포·상업적 이용 없음.
- 원본: https://www.golden-finder.com/ (주식회사 듀오랩스 운영, Toss Payments 결제, Clerk 인증, 자체 백엔드 `tube-backend-production-bdbc.up.railway.app`)

## 0. 조사 방법 및 한계 고지

Chrome으로 원본 사이트에 실제 로그인해 8개 사이드바 메뉴 전부, 모바일 반응형, 프로필 메뉴, 요금제 페이지, 채널 상세 패널, 대본(스크립트) 버튼까지 직접 클릭하며 확인했다. Tailwind 유틸리티 클래스, Pretendard 폰트, 실제 컬러(getComputedStyle)까지 확인함.

**단, 아래는 원본의 비공개 자산이라 100% 동일 재현이 불가능하고, 이 클론에서는 대체 구현으로 처리한다:**

| 항목 | 원본 방식 | 이 클론의 대체 방식 |
|---|---|---|
| 황금 채널 발굴기 / 터진 영상 / 채널 랭킹의 데이터 | 자체 백엔드가 매일 자정 크론으로 유튜브를 대량 스캔해 DB에 축적한 큐레이션 데이터 (`tube-backend-production-bdbc.up.railway.app`, 비공개) | **사용자 본인의 YouTube Data API v3 키**로 그 자리에서 검색(search.list/videos.list/channels.list) 후 클라이언트에서 집계. 원본만큼 방대한 히스토리 데이터는 없음 |
| AMS 지수 (0~99.9 점수) | 비공개 알고리즘 | 조회수/구독자/경과일 기반의 자체 근사 점수(직접 설계, 공식 문서화함, §4 참고) |
| 24시간/7일/30일 조회수 | 자체 DB에 시계열로 누적 | YouTube API는 일별 조회수를 직접 안 줌 → **최근 업로드 영상들의 조회수 합/평균으로 근사**, 근사치임을 UI에 명시 |
| 대본(스크립트) 가져오기 | 자체 백엔드가 자막 원문 수집 | **현재 사실상 동작 안 함.** `server/index.mjs`가 워치 페이지에서 자막 트랙 URL은 정상적으로 찾아내지만, 그 URL(timedtext)에 서버(브라우저 아닌 스크립트)로 요청하면 2025년경 유튜브의 봇 차단 강화(PO 토큰 요구 추정) 때문에 200 응답에 빈 본문만 옴 — 직접 테스트로 확인함. UI는 원본과 동일하게 "대본을 가져올 수 없습니다" 토스트로 우아하게 실패 처리되어 앱이 깨지진 않지만, 실제 대본 표시는 되지 않는다고 보면 됨. 제대로 고치려면 Puppeteer 등 headless 브라우저로 PO 토큰을 생성하는 방식이 필요(무거운 의존성, 다음 단계 후보) |
| 로그인 (Clerk) | Clerk SaaS 인증 | 개인 전용이므로 인증 없이 바로 진입 (로컬 단일 사용자 가정) |
| 결제 (Toss Payments) | 실제 정기결제 | **UI만 재현, 실제 결제 연동 없음.** '프리미엄 시작하기' 클릭 시 로컬 상태만 토글되는 데모 |
| 즐겨찾기/구독정보 DB | Supabase 등 서버 DB | 브라우저 localStorage |

## 1. 기술 스택

- **Vite + React 18 + TypeScript**
- **Tailwind CSS** (원본과 동일하게 유틸리티 클래스 기반, `rounded-xl/2xl`, 그라디언트 아이콘 배지 패턴 재현)
- **React Router** (사이드바 메뉴 = 라우트)
- **Pretendard 폰트** (CDN 또는 로컬 서브셋)
- 상태: React Query 없이 가벼운 커스텀 훅 + localStorage (개인용 규모이므로 과설계 지양)
- 선택적 로컬 Express 서버(`server/`): 대본(자막) 프록시 전용 (브라우저 CORS 우회 목적)

## 2. 정보구조 (사이드바 8메뉴 그대로)

1. **황금 채널 발굴기** — 카테고리별 수익 채널 분석 (기본 진입 페이지)
2. **조회수 폭발 쇼츠 찾기** — 조건 맞춤 쇼츠 발굴 (검색형)
3. **터진 영상** — 급등하는 영상 실시간 확인
4. **채널 랭킹** — 일간 조회수 기준 채널 순위
5. **즐겨찾기** — 저장한 채널·영상·키워드
6. **YouTube API 키 설정** — API 키 등록 및 인증
7. **구독 관리** — 결제수단·자동결제·환불 (데모)
8. **요금제 안내** — 트라이얼 vs 프리미엄 비교 (데모)

공통 요소: 상단 "무료 체험 이용 중" 배너(주황 그라디언트), 우측 상단 프로필 아바타, 모바일에서는 햄버거 → 드로어 사이드바.

## 3. 페이지별 상세 명세

### 3.1 황금 채널 발굴기
- 필터: 관심 주제(13개 카테고리 + 전체, 각각 고유 파스텔 색상 pill), 영상 타입(쇼츠/롱폼 토글), 구독자 구간(전체/0~1만/1만~5만/5만~10만), 정렬(조회수 높은순/구독자 많은순)
- 카테고리 미선택 시: "관심 주제를 선택해 주세요" 빈 상태
- 카테고리 선택 시: "마지막 데이터 갱신: 오늘 오전 12:08" 타임스탬프, "발견된 영상 N개 (채널 M개)" 카운트, 매일 자정 자동 업데이트 안내 배너
- 채널 카드(상단 그리드): 아바타, 채널명, 구독자/조회수/업로드일, 일일 조회수, AMS 지수(진행바)
- 영상 카드(하단 그리드): 썸네일, "대본" 배지(클릭 시 자막 가져오기), 즐겨찾기 별, 제목, 채널명+아바타, 구독자/조회수/업로드일, 일일 조회수

**구현**: 카테고리 → 검색 키워드 프리셋 매핑(`categoryPresets.ts`) → `search.list(q, order=viewCount, publishedAfter=60일전)` → `videos.list(statistics,snippet)` + `channels.list(statistics)` 병합 → 구독자 구간/정렬 필터링 → AMS 지수 계산.

### 3.2 조회수 폭발 쇼츠 찾기
- 검색어 입력 + 필터 4종: 업로드 일자(24시간/1주일/1개월/6개월/12개월/직접선택), 최대 구독자(제한없음/1천/1만/5만), 조회수 범위(1만~5만/5만~10만/10만~30만/30만~100만/100만이상), 정렬(조회수높은순/최신순/빠르게뜬순)
- API 키 미등록 시 경고 배너 + "키 등록하기" 버튼
- "떡상 쇼츠 발굴 시작" 버튼으로 검색 실행

**구현**: `search.list(q, type=video, videoDuration=short, publishedAfter=계산값, order=...)` → `videos.list`로 통계 채우기 → 클라이언트에서 구독자 상한/조회수 범위로 2차 필터.

### 3.3 터진 영상
- 필터: 쇼츠/롱폼/전체, 급등순/조회수순/최신순
- 상태 뱃지: 신규/상승/하락/유지 개수, "HOT" 뱃지, 순위(#N), 성장률(+N만/h)
- 카드: 썸네일, 즐겨찾기 별, 대본 배지, 제목, 채널명, 조회수·업로드시간, 성장률

**구현**: `videos.list(chart=mostPopular, regionCode=KR)` + 카테고리별 인기 검색 보강 → 이전 스냅샷(localStorage, 마지막 조회 시각의 조회수)과 비교해 성장률(views/h) 계산 → 신규/상승/하락/유지 분류.

### 3.4 채널 랭킹
- 필터: 기간(24시간/7일/30일/가속도), 타입(전체/쇼츠/롱폼/혼합), 구독자 상한(100만 미만 토글)
- 테이블: 순위(1~3위 메달 아이콘)/채널(아바타+이름+타입뱃지)/조회수/구독자/상세(>)
- 상세 클릭 → 우측 슬라이드 패널: 아바타, 이름, 구독자/일조회수/7일조회수/30일조회수, "유튜브에서 보기" 링크

**구현**: 카테고리 프리셋 전체를 순회 검색해 채널 후보 수집 → 각 채널 최근 영상들의 조회수 합으로 근사 랭킹 → 상세 패널은 근사치임을 라벨로 표시.

### 3.5 즐겨찾기
- 3탭: 채널/영상/키워드 (각 카운트 뱃지)
- 빈 상태: "저장한 채널이 없습니다 / 황금 채널 발굴기·조회수 폭발 쇼츠 찾기·터진 영상 페이지에서 카드 우상단 별 버튼을 눌러 저장하세요"

**구현**: localStorage 3개 배열(favChannels/favVideos/favKeywords), 각 카드의 별 아이콘 토글과 연동.

### 3.6 YouTube API 키 설정
- 안내 문구 그대로 재현 + "3분 만에 따라 하는 API 키 발급 가이드" 4단계(구글 클라우드 접속→프로젝트 생성→YouTube Data API v3 사용 설정→API 키 복사) 그대로 포함
- 입력창(AIzaSy... placeholder) + 인증하기 버튼 → `videos.list` 더미 호출로 유효성 검증 후 localStorage 저장

### 3.7 구독 관리 / 3.8 요금제 안내
- 원본 문구·가격(₩99,000/월, 3일 무료체험, 카카오톡 문의 CTA 등) 그대로 재현하되 **결제 로직 없이 데모**로만 구현. 이 클론에서 실제 결제를 받지 않는다는 점을 코드 주석에도 남긴다.

## 4. AMS 지수 (자체 설계 근사식)

```
ams = clamp(
  40 * log10(dailyViews + 1) / log10(1_000_000)
  + 30 * (dailyViews / (subscribers + 1))   // 구독자 대비 조회수 비율
  + 30 * recencyWeight(daysSinceUpload)     // 최근 업로드일수록 가점
, 0, 99.9)
```
원본과 숫자가 다를 수 있음을 UI 툴팁에 명시.

## 5. 폴더 구조

```
슈퍼파인더/
  PLAN.md
  app/                       ← Vite 프로젝트 루트
    server/                  ← 대본 프록시용 로컬 Node 서버 (현재 미동작, §0 참고)
    src/
      lib/ (youtube.ts, storage.ts, ams.ts, categoryPresets.ts, discovery.ts, trending.ts, ranking.ts)
      components/ (Layout, TrialBanner, Cards, ScriptButton, StateViews, nav)
      pages/ (GoldenFinder, ShortsFinder, Trending, ChannelRanking, Favorites, ApiKeySetup, Subscription, Pricing)
      App.tsx, main.tsx, index.css
    package.json, vite.config.ts
  mcp/                       ← 프로젝트 관리용 로컬 MCP 서버 (§9 참고)
    index.mjs, supabase.mjs, selftest.mjs, supabase_schema.sql
```

## 9. 관리용 MCP 서버 (언제든 이어서 관리하기 위한 장치)

`mcp/index.mjs`는 이 프로젝트 전용 로컬 MCP 서버다. `C:\Users\user\Downloads\.mcp.json`에 `superfinder`로 등록해뒀기 때문에,
**이 Downloads 폴더에서 시작하는 모든 Claude Code 세션**은 별도 설정 없이 아래 도구를 바로 쓸 수 있다.
데이터는 로컬 파일이 아니라 **Supabase 프로젝트 `u-finder`(https://pyplpivswdbrjytfqclm.supabase.co)** 에 저장된다
(`mcp/supabase.mjs`가 REST API로 접근, secret key 사용 — RLS 우회하는 백엔드 전용 키라 절대 브라우저 코드에 넣지 않음).

- `get_plan` — 이 PLAN.md 전체를 반환 (메모리 없는 새 세션의 첫 진입점으로 적합)
- `get_known_issues` / `upsert_row(known_issues, ...)` — 위 §0 한계 표와 동일한 내용을 구조화된 데이터로 조회·갱신
- `append_dev_note` — 새 노트를 Supabase에 남기고 동시에 이 파일의 §8 진행 로그에도 append (기록이 두 곳에 흩어지지 않게)
- `list_tables` / `get_rows` / `run_sql`(`select * from <table>` 형태만) / `upsert_row` / `delete_row` — DB 범용 CRUD

**한계**: 이 MCP 서버 프로세스 자체는 여전히 로컬 stdio라 fresh-season 계열의 `mcp__<uuid>__*` 서버들처럼 claude.ai 웹/모바일에서 바로 붙을 순 없다
(그러려면 이 서버를 어딘가에 24/7 호스팅해야 함). 다만 데이터 자체는 이제 Supabase에 있으므로, 다른 스크립트·MCP·앱이 같은 프로젝트를 바로 읽고 쓸 수 있다.

## 10. Supabase / 배포 / 로그인 (2026-08-18 추가)

- **Supabase 프로젝트**: `u-finder` (ref `pyplpivswdbrjytfqclm`, Org: minsiljang0's Org). URL/키는 `app/.env`(gitignore됨)와 `mcp/supabase.mjs`에 있음.
- **로그인**: Supabase Auth 이메일/비밀번호 방식으로 실제 구현됨 (`app/src/lib/useAuth.ts`, `app/src/pages/Login.tsx`). 세션 없으면 `App.tsx`가 로그인 화면을 먼저 보여줌. 아직 계정이 없다면 로그인 화면에서 "가입하기"로 본인 계정 하나만 만들면 됨 (개인 전용이라 다른 사람이 가입할 이유는 없지만, Supabase 기본 설정상 가입 자체는 누구나 가능 — 필요하면 Supabase 대시보드 Auth 설정에서 가입 막을 수 있음).
- **결제**: 여전히 미구현(UI 데모만). Toss Payments는 실제 상점/사업자 연동이 필요해서 개인용 클론 범위 밖으로 남겨둠.
- **GitHub 저장소**: `helpfulfood` 계정이 flagged 상태라 git push가 서버측에서 막혀 `https://github.com/minsiljang0/U-finder` 로 이전해서 사용 중.
- **배포**: Vercel에 `minsiljang0/U-finder` 연결, Root Directory `app`, 프레임워크 Vite로 배포. Vercel 프로젝트 Settings → Environment Variables에 아래 4개를 등록해야 배포본이 정상 동작함:
  - `VITE_SUPABASE_URL` = `https://pyplpivswdbrjytfqclm.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_IdRM7ZxF_ciZ9Pg-kNHjoA_4vCGR4D1`
  - `SUPABASE_SECRET_KEY` = (Supabase 대시보드 API Keys에서 secret key 값, `app/api/mcp.js`가 서버사이드에서만 사용)
  - `MCP_SHARED_SECRET` = `ufinder_admin_2026` (원격 MCP 엔드포인트 접근용 공유 비밀키. 이름/방식 모두 fresh-season과 동일하게 맞춤)
- **원격 MCP 엔드포인트**: `app/api/mcp.js`가 Vercel 서버리스 함수로 배포되어 `https://u-finder-app.vercel.app/api/mcp`에서 Streamable HTTP MCP를 제공한다.
  인증은 **헤더가 아니라 URL 쿼리파라미터** `?key=<MCP_SHARED_SECRET>` 방식이다 — claude.ai의 "커스텀 커넥터 추가" 화면은 헤더 토큰 입력칸이 없고,
  완전 무인증으로 두면 claude.ai가 OAuth 클라이언트 동적등록(DCR)을 강제로 시도하다 실패해서 연결 자체가 안 되는 버그가 있기 때문
  (fresh-season의 `app/api/mcp/route.js` 소스에서 동일한 문제와 해결책을 실제로 확인함).
  claude.ai Settings → Connectors → 추가 시 URL: `https://u-finder-app.vercel.app/api/mcp?key=ufinder_admin_2026`, OAuth 필드는 비워둠.
  로컬 stdio MCP(`superfinder`)와 달리 이건 배포만 되면 **어느 기기·클라이언트에서든** 같은 Supabase 데이터에 접속 가능 — `.mcp.json`에도 `superfinder-remote`로 등록해둠.
- **브랜딩**: "황금" → "슈퍼"로 전체 변경, 컬러 테마를 원본의 amber/blue 계열에서 violet/indigo 계열로 전면 교체(느낌 다르게 해달라는 요청), "듀오랩스" 등 원본 회사명은 "비즈니스 지원센터"로 대체.

## 6. 진행 순서

1. 프로젝트 스캐폴딩 (Vite+React+TS+Tailwind+Router)
2. 공통 레이아웃(사이드바/배너/프로필/모바일 드로어)
3. YouTube API 연동 레이어 + API 키 설정 페이지
4. 황금 채널 발굴기 → 쇼츠 찾기 → 터진 영상 → 채널 랭킹 순 구현
5. 즐겨찾기/구독관리/요금제 페이지
6. 브라우저로 전 페이지 실동작 검증 (API 키 입력 후 실제 데이터 로드 확인)

## 7. 다음 단계 (이번 세션 이후)

- 사용자가 본인 YouTube Data API 키를 발급해 "YouTube API 키 설정"에 입력해야 실제 데이터가 표시됨 (원본과 동일한 무료 발급 절차)
- 디자인/컬러/카피는 1차로 원본을 최대한 그대로 재현 → 이후 사용자가 직접 다듬을 예정


## 8. 진행 로그

(mcp/index.mjs의 append_dev_note 도구로 자동 기록됨 — 새 Claude 세션은 get_plan/get_known_issues로 최신 상태를 확인할 것)

- [2026-08-18] 8개 페이지 전체 구현 완료, 브라우저로 UI 실동작 검증 완료(빈상태/에러상태/실제 API 오류 응답까지 확인). 대본(자막) 기능은 유튜브 서버측 차단으로 미동작 확인. 관리용 MCP 서버(mcp/) 구축 완료.
- [2026-08-18] helpfulfood 계정이 GitHub에서 flagged 상태라 OAuth 로그인은 물론 git push(smart-http)까지 서버측에서 차단됨(REST API는 정상). minsiljang0/U-finder로 옮겨서 push 성공, Vercel 배포 진행.
- [2026-08-18] Supabase 프로젝트(u-finder, pyplpivswdbrjytfqclm) 연결. app_config/dev_notes/known_issues/tasks 테이블 생성(RLS 활성화), 로컬 SQLite 데이터 이전 완료. mcp/index.mjs가 이제 로컬 SQLite 대신 이 Supabase를 사용.
- [2026-08-18] Supabase Auth로 실제 로그인/회원가입 구현(이메일+비밀번호). App.tsx가 세션 없으면 Login 화면을 띄우도록 게이트 추가.
- [2026-08-18T22:07:44.634Z] Supabase Auth 로그인 구현(이메일/비밀번호), 전체 컬러 테마를 amber/blue에서 violet/indigo 기반으로 변경, '황금'→'슈퍼' 브랜드명 통일, 듀오랩스 사명 제거(비즈니스 지원센터로 대체). app/api/mcp.js로 원격 MCP 엔드포인트(Vercel 서버리스, Streamable HTTP) 추가 - MCP_ACCESS_TOKEN으로 접근 제한, 배포되면 어디서든 접속 가능. GitHub push protection이 mcp/supabase.mjs에 하드코딩된 secret key를 잡아냄 - env var 방식으로 수정 후 재커밋, minsiljang0/U-finder에 정상 push 완료.
- [2026-08-18T22:29:07.016Z] 실제 API 키로 테스트하다 발견된 버그 3건 수정: (1) 황금/슈퍼 채널 발굴기에 원본과 동일한 '구독자 20만명 미만 + 조회수 50만→30만→10만→5만 단계적 완화' 로직 추가(이전엔 이 필터링 자체가 없었음). (2) 조회수 폭발 쇼츠 찾기: order=viewCount로 검색 후 낮은 조회수 구간(1만~5만 등)으로 필터링하면 항상 0개가 나오는 구조적 버그 발견 - order=date+페이지네이션(3페이지)으로 대표성 있는 후보군을 모으도록 수정. (3) 터진 영상: mostPopular 차트가 롱폼 위주라 기본 탭인 '쇼츠'가 거의 항상 0개였음 - 카테고리 검색 기반 쇼츠 풀을 별도로 추가해 합침. 채널 랭킹의 쇼츠/롱폼 타입 필터도 죽은 코드(항상 true)였던 걸 발견해 shortCount/longCount 기반으로 수정. 즐겨찾기를 localStorage에서 Supabase(fav_channels/fav_videos/fav_keywords, user_id+RLS)로 이전해 회원별 저장되도록 함.
- [2026-08-18T22:40:04.113Z] Vercel 배포 확인 완료: 프론트엔드(Supabase URL 정상 baked-in), 원격 MCP 엔드포인트(/api/mcp, 실제 tools/call로 Supabase known_issues 조회까지 curl로 검증 완료), 관리자 페이지(minsiljang0@gmail.com 전용, 가입 회원 목록 조회) 전부 정상 동작 확인. .mcp.json에 superfinder-remote(http) 항목 추가해서 로컬 stdio 버전과 원격 버전 둘 다 쓸 수 있게 함.
- [2026-08-18T23:36:40.940Z] fresh-season의 실제 GitHub 소스(app/api/mcp/route.js)를 직접 확인해서 claude.ai 커스텀 커넥터 연결 방식을 정확히 맞춤: 헤더 인증 대신 ?key= URL 쿼리파라미터, 환경변수명도 MCP_SHARED_SECRET으로 통일(값: ufinder_admin_2026). claude.ai 커넥터는 헤더 입력칸이 없고, 완전 무인증이면 OAuth DCR 강제시도로 연결 자체가 실패하는 게 fresh-season 소스 주석에 명시되어 있었음. app/api/mcp.js 수정 완료, .mcp.json의 superfinder-remote도 새 URL로 갱신.