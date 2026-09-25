# 쓰는 법

이 폴더는 [토스 스타일 레퍼런스](https://claude.ai/artifact/F6eFyBxS4PVsP6q8BmJbC2) Claude Design 시스템을 그대로 내보낸 파일이에요. Claude Design 밖에서, 평범한 웹 페이지나 React 프로젝트에서 쓸 때 참고하세요.

## 폴더 구조

```
toss-style/
├── README.md              브랜드 북. 색·글자·간격·모션 사용 규칙
├── USAGE.md                이 파일
├── tokens.json             토큰 원본 데이터(색 123개, 글자 스타일 31개, 간격·모서리·그림자 등)
├── tokens.css               tokens.json을 CSS 커스텀 프로퍼티로 미리 컴파일한 파일
├── guidelines/
│   ├── 10-writing.md        보이스와 톤, 8가지 라이팅 원칙, 고쳐 쓰기 예시
│   ├── 20-patterns.md        화면 흐름 패턴(한 화면 한 질문, 확인/되돌리기 등)
│   └── 30-motion.md          스프링·이징 수치
├── components/
│   ├── bundle.js             React 컴포넌트 11개 (window.TossStyle)
│   ├── bundle.css            컴포넌트 스타일(위 tokens.css를 var()로 참조)
│   ├── index.d.ts            타입 정의(문서용)
│   └── <Comp>/README.md, preview.html   컴포넌트별 사용법과 예시
├── fonts/                    Pretendard woff2 (OFL 라이선스, 토스 전용 서체의 공개 대체 서체)
├── licenses/
│   └── Pretendard-OFL.txt
└── example.html              아래 방법을 실제로 적용한 완성 예시
```

## 가장 빠른 방법: `example.html` 열어보기

`example.html`을 브라우저로 열면(인터넷 연결 필요 — React를 cdnjs에서 불러와요) 목록, 입력 칸, 하단 버튼이 실제로 동작하는 화면을 볼 수 있어요.

## 새 프로젝트에 붙이는 법

### 1. 일반 HTML/CSS 프로젝트 (컴포넌트 없이 스타일만)

```html
<link rel="stylesheet" href="tokens.css">
```

`tokens.css`는 라이트/다크 테마를 모두 포함한 CSS 변수를 정의해요. 시스템 다크 모드를 따르거나(`prefers-color-scheme`), `<html data-theme="dark">`를 붙여 강제로 바꿀 수 있어요.

```css
.title { font-size: 22px; line-height: 31px; font-weight: 700; color: var(--grey900); }
.primary-button { background: var(--blue500); color: var(--white); border-radius: var(--radius-button-xlarge); }
```

토큰 이름과 값, 각 토큰을 언제 쓰는지는 `tokens.json`과 `README.md`에 있어요.

### 2. React 프로젝트 (컴포넌트까지 쓰기)

`components/bundle.js`는 `window.React`/`window.ReactDOM` 전역을 읽는 **UMD 스크립트**예요. 번들러(Vite, webpack 등)를 쓰는 프로젝트라면 그대로 import하는 대신, 이 파일의 컴포넌트 구현(같은 폴더의 `preview.html` 예시 코드 참고)을 자기 프로젝트의 컴포넌트로 옮겨 쓰는 걸 권장해요. 빠르게 써보고 싶다면:

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components/bundle.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="components/bundle.js"></script>
<script>
  var T = window.TossStyle, h = React.createElement;
  ReactDOM.createRoot(document.getElementById('root')).render(
    h(T.Button, null, '다음')
  );
</script>
```

`window.TossStyle`에 있는 컴포넌트: `Button`, `BottomCTA`, `Top`, `ListRow`, `Avatar`, `Border`, `TextField`, `Switch`, `Badge`, `Toast`, `ConfirmDialog`, `BottomSheet`. 각 props는 `components/<이름>/README.md`와 `components/index.d.ts`에 있어요.

### 3. 서체

`tokens.css`에 Pretendard `@font-face`가 이미 들어 있어요(`fonts/` 폴더 상대 경로). 토스 전용 서체(Toss Product Sans)는 공개되지 않아서 대신 넣었어요. 실제 토스 서체 파일을 구하면 `tokens.json`의 `type.fonts[].file`과 `type.families.sans`만 바꾸면 돼요.

## 규칙을 먼저 읽으세요

토큰과 컴포넌트를 가져다 쓰기 전에 `README.md`(색·글자·레이아웃·모서리·상태 규칙)와 `guidelines/` 세 파일(보이스, 화면 패턴, 모션)을 먼저 읽으세요. 토큰 값보다 "언제, 왜 쓰는지"가 더 중요해요.

## 주의

- 여기 있는 값은 토스가 npm에 공개한 `@toss/tds-colors`, `@toss/tds-mobile` 패키지와 토스가 발표한 원칙에서 가져온 **비공식 레퍼런스**예요. 토스 공식 자료가 아니에요.
- 이 스타일로 만든 화면에 토스 이름, 로고, 앱 아이콘을 넣지 마세요.
- 아이콘 세트는 포함되어 있지 않아요(토스 아이콘은 비공개). 자유롭게 쓸 수 있는 아이콘 세트를 골라 `icon`(24px)·`icon-small`(20px) 크기와 `grey400`~`grey600`, 강조 시 `blue500` 색 규칙에 맞춰 쓰세요.
