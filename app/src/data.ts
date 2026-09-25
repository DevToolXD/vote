// Static design constants — prices, skins, themes. Live candidate/vote data now comes from Firestore (see backend/).

export type Vote = -1 | 0 | 1
export type ItemKind = 'frame' | 'plate' | 'skin'
export type Tab = 'home' | 'acct' | 'rank'

export const PER = 10
export const FRAMES: [string, string][] = [['none','기본'],['neon','네온'],['crown','왕관'],['sakura','벚꽃'],['cat','고양이'],['stars','별빛'],['flame','불꽃'],['ocean','파도'],['bunny','토끼'],['halo','천사'],['devil','악마'],['butterfly','나비']]
export const BANNERS: Record<string, string> = {flame:'linear-gradient(135deg,#3a0c00,#ff5a00)',ocean:'linear-gradient(135deg,#032a40,#0b8fb0)',bunny:'linear-gradient(135deg,#fff3f7,#ffc9da)',halo:'linear-gradient(135deg,#fffbea,#ffe08a)',devil:'linear-gradient(135deg,#1a0003,#8a0016)',butterfly:'linear-gradient(135deg,#efe9ff,#cfeaff)',none:'linear-gradient(135deg,#e8f3ff,#c9e2ff)',neon:'linear-gradient(135deg,#0d0f2b,#3a1c71 55%,#7c1e8f)',crown:'linear-gradient(135deg,#fff1c2,#f5b400)',sakura:'linear-gradient(135deg,#ffeef4,#ffb3cb)',cat:'linear-gradient(135deg,#2b2d31,#56596a)',stars:'linear-gradient(135deg,#140f38,#4b3ab8)'}
export const CHART_H = 300
export const SKINS: [string, string][] = [['none','기본'],['namsan','남산타워'],['eiffel','에펠탑'],['bigben','빅벤'],['victory','전승기념탑']]
const SK: Record<string, { w: number; cap: number; base: number }> = {namsan:{w:24,cap:97.67,base:0},eiffel:{w:32,cap:9.67,base:28.33},bigben:{w:30,cap:90.67,base:0},victory:{w:32,cap:21,base:26.67}}
export const SKIN_FILES = ["namsan-cap","namsan-mid","eiffel-cap","eiffel-mid","eiffel-base","bigben-cap","bigben-mid","victory-cap","victory-mid","victory-base"]

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
