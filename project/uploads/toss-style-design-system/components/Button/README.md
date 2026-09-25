# Button

화면의 주요 행동은 파란 fill 버튼 하나로, 보조 행동은 weak 버튼으로 둬요. 한 화면에 `color="primary"` `variant="fill"` 버튼은 하나만 두세요.

## 넘겨주는 것

- `size`: `xlarge`(기본, 56px) · `large`(48px) · `medium`(38px) · `small`(32px). 글자는 17 · 17 · 15 · 13px, 모서리는 16 · 14 · 10 · 8px이에요.
- `variant`: `fill`(기본) · `weak`
- `color`: `primary`(파랑) · `danger`(빨강, 삭제·해지) · `dark`(회색, 중립 보조) · `light`(흰색, 색 면이나 사진 위)
- `display`: `inline`(글자 길이) · `block`(너비 100%) · `full`(너비 100%, 모서리 0, 누를 때 축소 없음)
- `loading`: 글자를 숨기고 점 3개를 보여줘요. `aria-busy`가 켜져요.
- `disabled`: fill은 불투명도 0.3으로 흐려져요. 파란 버튼은 회색이 아니라 옅은 파랑으로 보여요.
- `children`: 짧은 동사형 문구("다음", "보내기").

## 쓰는 법

- 누르면 즉시 0.96배로 줄어요(`press-scale`).
- 버튼 글자 굵기는 항상 600이에요.
- 흰 글자와 `blue500`의 대비는 3.7:1(토스 원본 값)이라, 버튼보다 작은 글자를 파란 면 위에 올리지 마세요.
- 화면 하단의 주요 버튼은 `BottomCTA` 안에 넣으세요.
