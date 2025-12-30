# Chrome Web Store 배포 가이드

> 📅 **최신 업데이트**: 2025년 12월 22일 기준 Chrome Web Store API 공식 문서 반영

## 자동 배포 설정

이 프로젝트는 GitHub Actions를 통해 Chrome Web Store에 자동으로 배포됩니다.

## 초기 설정 (한 번만 필요)

### 1. Google Cloud Console 설정

#### 1-1. Chrome Web Store API 활성화

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. 검색창에 "Chrome Web Store API" 입력
4. "Chrome Web Store API" 활성화

#### 1-2. OAuth Consent Screen 구성

1. "OAuth consent screen" 메뉴로 이동
2. User Type: **External** 선택 → Create
3. 필수 정보 입력:
   - App name: 원하는 이름 (예: "HoverComp Publisher")
   - User support email: 본인 이메일
   - Developer contact information: 본인 이메일
4. "Save and Continue" 클릭
5. Scopes 화면은 건너뛰기 (Save and Continue)
6. Test users에 본인 이메일 추가 → Save and Continue

#### 1-3. OAuth Client 생성

1. "Credentials" 메뉴로 이동
2. "Create Credentials" → "OAuth client ID" 선택
3. Application type: **"Web application"** 선택
4. 이름 입력 (예: "Chrome Web Store Publisher")
5. Authorized redirect URIs에 추가:
   - `https://developers.google.com/oauthplayground`
6. "Create" 클릭
7. **Client ID와 Client Secret 복사 및 안전하게 보관**

> ⚠️ **중요**: 
> - 공식 문서에 따르면 **"Web application"** 타입 사용 (2025년 12월 기준)
> - Client Secret은 생성 시점에만 전체 값을 볼 수 있습니다

### 2. Access Token & Refresh Token 생성

#### OAuth 2.0 Playground 사용 (공식 권장 방법)

1. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) 접속

2. **설정 구성** (오른쪽 상단 ⚙️ 클릭):
   - ✅ "Use your own OAuth credentials" 체크
   - OAuth Client ID 입력
   - OAuth Client secret 입력

3. **Step 1 - Authorize APIs**:
   - "Input your own scopes" 필드에 입력:
     ```
     https://www.googleapis.com/auth/chromewebstore
     ```
   - "Authorize APIs" 클릭
   - Google 계정으로 로그인 및 권한 승인

4. **Step 2 - Exchange authorization code for tokens**:
   - "Exchange authorization code for tokens" 클릭
   - **Refresh token 복사** (재사용 가능)
   - Access token도 표시됨 (1시간 유효)

> 💡 **팁**: Refresh token은 영구적으로 사용 가능합니다. Access token은 만료되면 Refresh token으로 재생성할 수 있습니다.

### 3. Chrome Extension ID 확인

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) 접속
2. "Add new item" 클릭 → ZIP 파일 업로드
3. Store listing 정보 입력 (Privacy 탭 필수)
4. URL에서 Extension ID 확인: `...detail/YOUR_EXTENSION_ID/...`

> 📝 Extension ID는 32자 소문자 영문으로 자동 생성됩니다

### 4. GitHub Secrets 설정

GitHub 저장소의 Settings → Secrets and variables → Actions에서 다음 Secrets을 추가:

- `CHROME_EXTENSION_ID`: 확장 프로그램 ID
- `CHROME_CLIENT_ID`: OAuth Client ID
- `CHROME_CLIENT_SECRET`: OAuth Client Secret
- `CHROME_REFRESH_TOKEN`: 생성한 Refresh Token

## 배포 방법

### 자동 배포 (권장)

1. 버전 업데이트:
   ```bash
   # package.json과 manifest.json의 version을 동일하게 변경
   npm version patch  # 또는 minor, major
   ```

2. 태그로 배포:
   ```bash
   git add .
   git commit -m "Release v0.1.0"
   git tag v0.1.0
   git push origin main --tags
   ```

3. GitHub Actions가 자동으로:
   - 테스트 실행
   - 확장 프로그램 패키징
   - Chrome Web Store에 업로드 및 배포
   - GitHub Release 생성

### 수동 배포

GitHub Actions 페이지에서 "Publish to Chrome Web Store" workflow를 수동으로 실행할 수 있습니다.

## 버전 관리

- `manifest.json`과 `package.json`의 버전은 항상 동일해야 합니다
- 테스트 workflow가 자동으로 버전 일치를 확인합니다
- Semantic Versioning을 따릅니다: `MAJOR.MINOR.PATCH`

## 워크플로우

### Test Workflow (`.github/workflows/test.yml`)
- main, develop 브랜치 push 시 자동 실행
- Pull Request 시 자동 실행
- Lint, 테스트, 버전 검증 수행

### Publish Workflow (`.github/workflows/publish.yml`)
- `v*` 태그 push 시 자동 실행
- 수동 실행 가능
- 테스트 → 패키징 → 배포 → Release 생성

## 문제 해결

### "Invalid refresh token" 오류
- Refresh Token을 다시 생성하고 GitHub Secrets 업데이트

### "Extension ID not found" 오류
- Chrome Web Store에서 Extension ID를 확인하고 Secrets 업데이트

### 버전 불일치 오류
- `manifest.json`과 `package.json`의 version 값을 동일하게 수정

## 참고 자료

- [Chrome Web Store API 공식 문서](https://developer.chrome.com/docs/webstore/using-api) (2025-12-22 업데이트)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [chrome-extension-upload Action](https://github.com/mnao305/chrome-extension-upload)

---

**✅ 검증 완료**: 이 가이드는 Chrome Web Store API 공식 문서 (Last updated 2025-12-22 UTC)를 기반으로 작성되었습니다.
