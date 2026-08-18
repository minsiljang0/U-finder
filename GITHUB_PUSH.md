# GitHub 커밋/푸시 방법 (이 프로젝트에서 실제로 성공한 방식)

## 왜 필요했나
`helpfulfood` 계정이 GitHub에서 **"flagged" 상태**라서 일반적인 브라우저 로그인(OAuth 제3자 앱 인증)이 막혀 있었다.
그래서 Git Credential Manager의 "브라우저에서 로그인하세요" 방식이 계속 멈추거나 실패했다.
**해결책: Personal Access Token(PAT)** — OAuth가 아니라 직접 발급하는 토큰이라 이 제한과 무관하게 작동한다.

## 1. PAT(개인 액세스 토큰) 발급받기

1. GitHub 로그인한 상태에서 오른쪽 위 프로필 클릭 → **Settings**
2. 왼쪽 맨 아래 **Developer settings**
3. **Personal access tokens → Tokens (classic)** → **Generate new token (classic)**
4. Note(이름)는 아무거나, **repo** 권한 체크박스만 체크
5. **Generate token** 클릭 → `ghp_...`로 시작하는 문자열이 나옴 (이때 한 번만 보여주므로 복사해두기)

## 2. 그 토큰으로 push하기

터미널(Git Bash 또는 PowerShell)에서, 프로젝트 폴더로 이동한 뒤:

```bash
cd "C:\Users\user\Downloads\프로젝트폴더"

# 아직 git 저장소가 아니라면
git init
git add -A
git commit -m "첫 커밋"
git branch -M main
git remote add origin https://github.com/계정명/저장소명.git

# 원격에 이미 파일이 있다면(웹에서 업로드한 적 있는 경우) 먼저 합치기
git fetch "https://x-access-token:<발급받은토큰>@github.com/계정명/저장소명.git" main
git merge FETCH_HEAD --allow-unrelated-histories -m "merge"

# 실제 push — URL에 토큰을 직접 끼워넣으면 로그인 창 없이 바로 됨
git push "https://x-access-token:<발급받은토큰>@github.com/계정명/저장소명.git" main
```

`<발급받은토큰>` 자리에 `ghp_...` 토큰을 그대로 넣으면 된다.

## 3. 끝나고 나서 (보안 정리, 선택사항)

토큰이 원격 주소에 남아있지 않도록 정리:

```bash
git remote set-url origin https://github.com/계정명/저장소명.git
```

토큰 자체는 revoke(폐기)하지 않으면 계속 쓸 수 있다. 문제 생기면 GitHub Settings → Developer settings → Personal access tokens에서 삭제(Delete)하면 즉시 무효화된다.

## 다음에 또 push할 때는?

같은 토큰이 있다면 2번 섹션의 `git push "https://x-access-token:<토큰>@github.com/..."` 한 줄만 다시 실행하면 된다.
토큰을 잃어버렸거나 만료됐으면 1번부터 새로 발급받으면 된다.
