# BottomSheet

짧은 선택이나 확인을 새 화면 없이 처리하는 시트예요. 은행 고르기, 기간 고르기, 약관 동의에 써요.

## 넘겨주는 것

- `open`, `onClose`(딤을 누르면 불려요)
- `title`(질문형), `description`
- `children`: 대개 `ListRow` 목록
- `cta`: 아래 버튼(`Button display="block"` 하나 또는 둘)

## 쓰는 법

- 화면 끝에 붙지 않고 양옆·아래를 10px(`sheet-inset`) 띄운 카드예요. 모서리 28px(`radius-sheet`), 배경 `layeredBackground`.
- 맨 위 16px 영역에 48×4px `grey200` 손잡이가 있어요. 제목 영역은 위 21px, 아래 13px.
- 닫으면 안 되는 시트는 딤을 눌렀을 때 좌우로 살짝 흔들어 알려줘요.
- 제목 글자 크기는 TDS 값이 공개되지 않아 20px 700으로 두었어요.
