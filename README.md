# Samsung Galaxy S24 Ultra 진동 센서 이상 감지 및 AI 모니터링 시스템

삼성 갤럭시 S24 Ultra의 고정밀 6축 MEMS 가속도계 센서를 활용한 산업 설비 진동 분석, ISO 10816 기계 진동 규격 판정, 실시간 이상 징후 알림 및 Google Gemini AI 진단 플랫폼입니다.

---

## 🚀 PC 로컬 환경에서 실행하는 방법

GitHub에서 프로젝트를 클론(Clone)하거나 다운로드한 후, PC에서 최신 변경 사항을 실행하는 방법입니다.

### 1. 패키지 의존성 설치
```bash
npm install
```

### 2. 실행 모드 선택

#### 🟢 [방법 A] 개발 서버로 즉시 실행 (가장 추천)
최신 React 코드(`src/App.tsx` 등)를 빌드 과정 없이 즉시 반영하여 실행합니다:
```bash
npm run dev
```
- 브라우저에서 `http://localhost:3000` 접속

---

#### 🔵 [방법 B] 프로덕션 빌드 후 실행
운영용 컴파일 번들(`dist/`)을 새로 생성한 후 실행합니다:
```bash
# 1. 최신 소스를 dist/ 폴더로 새로 컴파일 (필수!)
npm run build

# 2. 빌드된 고속 서버 실행
npm start
```

> ⚠️ **주의**: `npm run build`를 실행하지 않고 `npm start`만 실행하면, 이전에 빌드되었던 오래된 `dist/` 폴더가 실행되거나 빌드 파일 누락 에러가 발생할 수 있습니다.

---

## ❓ 깃허브에 푸시/다운로드 후 커밋이 반영되지 않은 상태로 실행될 때 체크리스트

### 1. Google AI Studio에서 GitHub로 "Export"를 다시 수행했는지 확인
- AI Studio는 코드가 수정되었다고 해서 GitHub 저장소로 **자동 커밋(Auto-push)하지 않습니다.**
- 반드시 AI Studio 화면 우측 상단 **설정(⚙️) 또는 더보기(⋮) -> [Export to GitHub]**를 클릭하여 최신 변경사항을 GitHub로 내보내야 합니다.
- GitHub 웹사이트의 리포지토리 페이지에서 최신 커밋 시간과 커밋 메시지가 업데이트되었는지 확인하세요.

### 2. PC 로컬 폴더에서 최신 코드를 가져왔는지 확인
- `git clone`을 새로 받았거나 기존 폴더에서 작업 중이라면 최신 커밋을 당겨와야 합니다:
  ```bash
  git pull origin main
  ```
- 만약 ZIP 파일로 다운로드했다면, 브라우저가 예전에 다운로드한 이전 ZIP 파일(`react-example (1).zip` 등)을 열지 않았는지 확인하세요.

### 3. `npm start` 전 `npm run build` 실행 여부 확인
- GitHub 저장소에는 용량 및 환경 차이로 인해 `.gitignore`에 의해 `dist/` 빌드 폴더가 올라가지 않습니다.
- 따라서 PC에서 다운로드 후 바로 `npm start`를 누르면 이전 버전의 `dist/`가 실행되거나 최신 소스가 반영되지 않습니다.
- 반드시 `npm run dev`를 실행하시거나, `npm run build && npm start`를 실행하세요.

### 4. 브라우저 캐시(Cache) 초기화
- 로컬 `http://localhost:3000` 접속 후 브라우저가 이전 정적 에셋(JS/CSS)을 캐시하고 있을 수 있습니다.
- 브라우저에서 **강력 새로고침**을 실행하세요:
  - Windows / Linux: `Ctrl + Shift + R` 또는 `Ctrl + F5`
  - macOS: `Cmd + Shift + R`
  - 또는 시크릿 창(Incognito)에서 접속

---

## 📱 포터블 단일 HTML 파일 실행
별도의 Node.js 설치나 터미널 없이 즉시 브라우저에서 실행하려면:
- 프로젝트 루트의 `galaxy_s24_vibration_monitor.html` 파일을 더블 클릭하여 크롬이나 엣지 등 브라우저로 바로 실행할 수 있습니다.
