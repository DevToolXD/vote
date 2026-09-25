# TextField

입력 칸이에요. 한 화면 한 질문 흐름에서는 밑줄형(`line`, `big`, `hero`)을, 여러 칸을 받는 폼에서는 `box`를 써요.

## 넘겨주는 것

- `variant`: `box`(17px, 옅은 회색 상자) · `line`(22px 밑줄, 기본) · `big`(30px 밑줄) · `hero`(30px, 밑줄 없음, 금액 입력)
- `label`: 위쪽 13px 라벨. 포커스되면 `blue600`, 오류면 `red600`.
- `help`: 아래쪽 13px 도움말(`grey600`). 오류면 `red600`으로 해결 방법을 써요.
- `hasError`, `disabled`, `suffix`(예: "원"), 그 밖의 `input` 속성(`placeholder`, `value`, `onChange`, `inputMode`)

## 쓰는 법

- 커서는 `blue500`, 입력 글자는 `grey800`, 플레이스홀더는 `grey500`이에요.
- 밑줄형: 글자 굵기 600, 밑줄 2px `grey100` → 포커스 `blue400` → 오류 `red600`.
- box형: 배경 `greyOpacity50`, 1px 테두리, 모서리 14px, 안쪽 14px 16px. 포커스되면 `blue900` 5% 막, 오류면 `red900` 5% 막이 덮여요.
- 화면에 들어오면 첫 입력 칸에 바로 포커스하세요.
