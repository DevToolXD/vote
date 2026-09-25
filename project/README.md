# 인기투표 UI

모바일 기준 인기투표 웹/앱 UI 프로토타입이에요. 실제 기능 없이 화면과 인터랙션만 있어요.

## 디자인 지침 — 토스 스타일

- **Organic 디자인 시스템은 쓰지 않아요.** 모든 화면은 토스 스타일 레퍼런스를 따라요: `uploads/toss-style-design-system/README.md` (+ `guidelines/10-writing.md`, `20-patterns.md`, `30-motion.md`, `tokens.css`)
- 토스 이름·로고·아이콘은 넣지 않아요. 방식(단순함, 한 화면 한 가지, 쉬운 말)만 빌려요.
- 모바일 단일 칼럼(375~430px). PC에서는 가운데 모바일 폭 칼럼.
- 제품 원칙: One Thing for One Page · Easy to Answer · Value First, Cost Later · Casual Concept · Minimum Features.
- 문구는 모두 **해요체**, 능동·긍정형. 제목은 질문형/결과형, 버튼은 짧은 동사. 다이얼로그 왼쪽 버튼은 "닫기". 느낌표·과장 금지.
- 색: 화면 90% 이상 무채색(grey 스케일), 강조색은 `blue500`(#3182f6) 하나. 한 화면에 파란 fill 버튼 하나. 의미색(red 오류, green 성공)은 의미 있을 때만.
- 글자: Toss Product Sans → 대체 Pretendard. 크기 30·26·22·20·**17(본문)**·15·13, 굵기 700/600/500/400. 제목은 본문 첫머리에 크게, 왼쪽 정렬.
- 간격: 좌우 24px, 4px 배수. 섹션은 16px 회색 띠로, 목록 사이는 왼쪽 24px 들여쓴 0.5px 선.
- 모서리: 버튼 8~16, 다이얼로그 24, 바텀시트 28, 토스트·칩 알약형.
- 그림자는 거의 쓰지 않고 딤과 배경색 차이로 층을 나눠요. 테두리 상자 금지.

## 파일

- `Popular Vote v2.dc.html` — 메인 (홈 · 계정 · 랭킹)
- `Avatar.dc.html` — 프로필 사진 + 꾸미기 프레임
- `Nameplate.dc.html` — 이름표 (이름 + 소개)
- `skins/` — 막대 스킨(실사 랜드마크) 이미지
- `Glass Theme Spec.md` — 글라스 테마 스펙
