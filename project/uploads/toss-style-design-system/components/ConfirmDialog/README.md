# ConfirmDialog

되돌릴 수 없는 행동을 한 번 더 확인하는 창이에요. 되돌릴 수 있는 행동에는 쓰지 말고 `Toast`로 알리세요.

## 넘겨주는 것

- `open`, `title`(질문형), `description`(선택), `onConfirm`, `onClose`
- `confirmLabel`: 구체적 행동("해지하기"). `closeLabel`: 기본 "닫기".
- `danger`: 위험한 행동이면 확인 버튼을 빨강으로.
- `onConfirm`이 없으면 버튼 하나짜리 알림창(AlertDialog)이 돼요. 오른쪽 정렬 텍스트 버튼이에요.

## 쓰는 법

- 가운데, 너비 `화면 - 64px`(최대 320px), 모서리 24px, 배경 `floatBackground`, 뒤는 `dimmedBackground`.
- 본문 여백 위·좌우 22px, 제목(20px 700 `grey800`)과 설명(15px 500 `grey600`, 줄 높이 1.5) 사이 8px.
- 버튼은 여백 20px 16px 16px 안에 반반(간격 8px). 좁으면 주요 버튼이 위로 쌓여요.
- **왼쪽 버튼은 항상 "닫기"** 예요. 버튼 크기는 TDS 기본값이 공개되지 않아 large(48px)로 두었어요.
