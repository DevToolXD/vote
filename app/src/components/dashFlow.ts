// A dashed line whose dashes flow along it, for 이름표 art (viewBox 320×56 shown with
// preserveAspectRatio="xMaxYMid slice"). Animating stroke-dashoffset repaints on the main thread
// every frame; here the line is drawn solid and cut into dashes by a striped mask that slides
// sideways while the line is held still by an equal and opposite slide — both transforms, so the
// GPU runs it. Lengths are viewBox units turned into CSS px with container units (the box is the
// container): 1 unit = max(100cqw / 320, 100cqh / 56). Dashes are measured across rather than
// along the line, which on these gentle curves looks the same.

const u = (n: number) => `max(${(n * 100 / 320).toFixed(4)}cqw,${(n * 100 / 56).toFixed(4)}cqh)`

export function dashFlow(o: { path: string; dash: number; gap: number; dur: number; reverse?: boolean; glow?: string; style?: string }) {
  const p = u(o.dash + o.gap), d = u(o.dash)
  const run = (k: string) => `animation:${k} ${o.dur}s linear infinite${o.reverse ? ' reverse' : ''}`
  const stripes = `repeating-linear-gradient(90deg,#000 0 ${d},transparent ${d} ${p})`
  return `<div style="position:absolute;inset:0;container-type:size;pointer-events:none${o.style ? ';' + o.style : ''}">` +
    `<div style="position:absolute;inset:0;overflow:hidden${o.glow ? `;filter:drop-shadow(0 0 ${u(4)} ${o.glow})` : ''}">` +
    `<div class="dash-flow" style="position:absolute;top:0;bottom:0;left:calc(-1 * ${p});right:0;-webkit-mask:${stripes};mask:${stripes};--p:${p};${run('dashFlow')}">` +
    `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" class="dash-flow" style="position:absolute;top:0;left:${p};width:calc(100% - ${p});height:100%;${run('dashHold')}">${o.path}</svg>` +
    `</div></div></div>`
}
