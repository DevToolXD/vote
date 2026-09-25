// Mock data and design constants, ported from the prototype script.

export type Candidate = { id: number; name: string; up: number; down: number; rank: number }
export type Vote = -1 | 0 | 1
export type ItemKind = 'frame' | 'plate' | 'skin'
export type Tab = 'home' | 'acct' | 'rank'

export const RAW: [string, string, number, number][] = [['이지우','',980,300],['한서윤','가수',1840,212],['도하준','배우',1702,301],['강리아','크리에이터',1590,188],['윤태오','운동선수',1433,260],['서지안','가수',1391,344],['차은호','배우',1288,295],['민세라','크리에이터',1204,310],['유건','가수',1150,402],['백나래','배우',1022,288],['정시우','운동선수',990,351],['오하린','가수',921,330],['임도윤','크리에이터',860,402],['권채아','배우',812,390],['남궁현','운동선수',744,361],['표예린','가수',690,352],['신우진','배우',640,371],['홍다온','크리에이터',588,340],['구민재','가수',520,318],['엄소율','배우',471,305],['진하람','운동선수',420,296],['류아인','크리에이터',366,280],['방준서','가수',311,262],['염가을','배우',260,248],['석이안','운동선수',212,230],['피연우','크리에이터',180,241],['탁서하','가수',150,262],['마로운','배우',131,298],['변주원','운동선수',120,344],['하윤슬','크리에이터',98,371],['송태린','가수',80,402],['설재희','배우',66,455],['곽노을','크리에이터',40,512]];
export const DATA: Candidate[] = RAW.map((r, i) => ({ id: i, name: r[0], up: r[2], down: r[3] }))
  .sort((a, b) => (b.up - b.down) - (a.up - a.down))
  .map((d, i) => ({ ...d, rank: i + 1 }))
export const PER = 10
export const ME = '이지우'
export const FRAMES: [string, string][] = [['none','기본'],['neon','네온'],['crown','왕관'],['sakura','벚꽃'],['cat','고양이'],['stars','별빛'],['flame','불꽃'],['ocean','파도'],['bunny','토끼'],['halo','천사'],['devil','악마'],['butterfly','나비']]
export const BANNERS: Record<string, string> = {flame:'linear-gradient(135deg,#3a0c00,#ff5a00)',ocean:'linear-gradient(135deg,#032a40,#0b8fb0)',bunny:'linear-gradient(135deg,#fff3f7,#ffc9da)',halo:'linear-gradient(135deg,#fffbea,#ffe08a)',devil:'linear-gradient(135deg,#1a0003,#8a0016)',butterfly:'linear-gradient(135deg,#efe9ff,#cfeaff)',none:'linear-gradient(135deg,#e8f3ff,#c9e2ff)',neon:'linear-gradient(135deg,#0d0f2b,#3a1c71 55%,#7c1e8f)',crown:'linear-gradient(135deg,#fff1c2,#f5b400)',sakura:'linear-gradient(135deg,#ffeef4,#ffb3cb)',cat:'linear-gradient(135deg,#2b2d31,#56596a)',stars:'linear-gradient(135deg,#140f38,#4b3ab8)'};
export const PROFILES: Record<string, [string, string, string]> = {'차은호':['flame','남자','액션 신은 대역 없이 찍어요'],'민세라':['butterfly','여자','봄 브이로그 준비 중'],'정시우':['ocean','남자','서핑 대회 나가요'],'오하린':['bunny','여자',''],'임도윤':['devil','남자','장난은 제 전문이에요'],'권채아':['halo','여자','늘 감사해요'],'한서윤':['crown','여자','무대 위에서 제일 행복해요. 응원해주셔서 고마워요'],'도하준':['neon','남자','새 작품 촬영 중이에요'],'강리아':['sakura','여자','매주 금요일 저녁에 영상 올려요'],'윤태오':['stars','남자','다음 시즌도 부상 없이 달려볼게요'],'서지안':['cat','여자',''],'유건':['neon','남자',''],'백나래':['sakura','여자','']};
export const CHART_H = 300
export const SKINS: [string, string][] = [['none','기본'],['namsan','남산타워'],['eiffel','에펠탑'],['bigben','빅벤'],['victory','전승기념탑']]
export const SKIN_OF: Record<string, string> = {'한서윤':'eiffel','도하준':'bigben','강리아':'namsan','윤태오':'victory','서지안':'eiffel','유건':'bigben','백나래':'namsan','차은호':'victory'};
const SK: Record<string, { w: number; cap: number; base: number }> = {namsan:{w:24,cap:97.67,base:0},eiffel:{w:32,cap:9.67,base:28.33},bigben:{w:30,cap:90.67,base:0},victory:{w:32,cap:21,base:26.67}};
export const SKIN_FILES = ["namsan-cap","namsan-mid","eiffel-cap","eiffel-mid","eiffel-base","bigben-cap","bigben-mid","victory-cap","victory-mid","victory-base"];

export type SkinGeom = {
  tf: string; w: number; ml: number; H: number; k: string
  capH: number; capUrl: string; mid: string; hasBase: boolean; baseUrl: string; baseH: number
}

/** Cap and base keep their size; only the middle stretches. Too-short bars scale the whole tower down. */
export function skinGeom(s: string, h: number, neg: boolean): SkinGeom | null {
  const m = SK[s]
  if (!m) return null
  const mn = m.cap + m.base + 12, H = Math.max(h, mn), k = h < mn ? h / mn : 1
  return {
    tf: neg ? 'scaleY(-1)' : 'none', w: m.w, ml: -m.w / 2, H, k: k.toFixed(4),
    capH: m.cap, capUrl: `url(skins/${s}-cap.png)`, mid: `url(skins/${s}-mid.png)`,
    hasBase: m.base > 0, baseUrl: m.base > 0 ? `url(skins/${s}-base.png)` : 'none', baseH: m.base,
  }
}

const PRICE: { frame: Record<string, number>; skin: Record<string, number> } = {frame:{neon:120,crown:180,sakura:100,cat:100,stars:140,flame:160,ocean:120,bunny:100,halo:150,devil:150,butterfly:120},skin:{namsan:200,eiffel:250,bigben:250,victory:220}}
export const priceOf = (kind: ItemKind, k: string) =>
  k === 'none' ? 0 : kind === 'plate' ? (PRICE.frame[k] || 120) + 30 : (PRICE[kind][k] || 150)
export const KIND_NAME: Record<ItemKind, string> = { frame: '프레임', plate: '', skin: '막대 스킨' }
export const THEMES: [string, string][] = [['default','기본'],['glass','글라스']]
export const fmt = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString()
export const BLUE = '#3182f6', RED = '#f04452'
/** Gold / silver / bronze [background, foreground] for ranks 1–3. */
export const MEDALS: [string, string][] = [['#ffc342','#5c3d00'],['#d1d6db','#333d4b'],['#e0a276','#4a2a12']]
