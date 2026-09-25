# 글라스 테마 — liquid-glass-react 연결 스펙

UI 구현은 `Popular Vote v2.dc.html`의 `[data-theme="glass"]` 레이어(backdrop-filter + SVG 굴절 필터)로 되어 있어요. React로 옮길 때는 각 `data-g` 표면을 `<LiquidGlass>`로 감싸면 돼요.

## 재질 레벨 → LiquidGlass props

| 레벨 | data-g | 쓰는 곳 | displacementScale | blurAmount | saturation | aberrationIntensity | elasticity | cornerRadius |
|---|---|---|---|---|---|---|---|---|
| L0 배경 | app | 컬러 필드 | — | — | — | — | — | — |
| L1 Subtle | l1, secondary | 입력창, 검색, 작은 버튼, 뱃지 | 12 | 0.04 | 140 | 0.5 | 0 | 12–14 |
| L2 Standard | l2, bar | 카드, 차트 박스, 막대 | 28 | 0.08 | 160 | 1 | 0.05 | 20–24 |
| L3 Elevated | nav, l3, navpill | 하단 탭바, 토스트, 활성 탭 캡슐 | 48 | 0.10 | 170 | 1.5 | 0.15 | 30 / 999 |
| L4 Focused | l4 | 시트, 규칙 팝업, 테마 선택 | 64 | 0.14 | 180 | 2 | 0.1 | 28 |
| Primary | primary | 주요 버튼(파랑 틴트) | 32 | 0.06 | 170 | 1 | 0.25 | 16 |

- 불투명도(표면 흰색): L1 0.34 · L2 0.40 · L3 0.44 · L4 0.56
- 폴백(굴절 미지원 브라우저): blur + 반투명 표면 + 1px 안쪽 하이라이트 + 그림자. backdrop-filter도 없으면 불투명도 0.72–0.93으로 올림
- 모바일(≤480px): 토스트 굴절 끔. 탭바·시트만 굴절 유지
- `prefers-reduced-motion`: 굴절 필터와 전환 애니메이션 끔

## 컴포넌트 구조

```
<GlassProvider theme="glass">        // data-theme, 포인터 하이라이트(--mx/--my)
  <Background />                      // L0
  <LiquidGlass level="l2"> <Card/> </LiquidGlass>
  <LiquidGlass level="l3" mode="prominent"> <TabBar activeIndex/> </LiquidGlass>
  <Sheet> <LiquidGlass level="l4" .../> </Sheet>
</GlassProvider>
```

`level` → 위 표의 props 묶음을 반환하는 `glassPreset(level)` 하나로 관리하면 레벨 간 일관성이 유지돼요.
