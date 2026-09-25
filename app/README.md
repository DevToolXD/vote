# 인기투표 (Popular Vote) — app

React + TypeScript + Vite build of `project/Popular Vote v2.dc.html` (Claude Design handoff). This is UI only: all data is mock, and only the theme is saved (`localStorage` `pv-theme`).

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
```

Preview options (the design tool's controls): `?loggedIn=1`, `?tab=home|acct|rank`, `?palette=swap` (red 추천 / blue 비추천).

## Layout

- `src/App.tsx`: app state, tab routing, overlays
- `src/data.ts`, `src/model.ts`: mock candidates, prices, skin geometry, derived view data
- `src/components/`: screens (`HomeScreen`, `RankScreen`, `AccountScreen`), `Overlays` (vote/profile/theme sheets, real-name rule and purchase dialogs, toast), `EditProfile` (frame/nameplate/skin shop), `Reveal` (TOP 3 drum reveal), `Avatar`, `Nameplate`, `TowerSkin`
- `src/styles.css`: fonts, keyframes, glass theme layer (`[data-theme="glass"]` × `data-g` surface levels; see `project/Glass Theme Spec.md`)
- `avatarArt.ts`, `plateArt.ts`, `drumArt.ts`: decorative SVG copied verbatim from the design (generated, don't hand-edit)

Static styles are kept as the prototype's CSS strings through `css()` in `src/css.ts`, so values stay identical to the design.
