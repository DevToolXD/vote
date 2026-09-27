// 아우라 — the 1000P 레전드 set. Hand-made to match across frame, 이름표 and 막대 스킨:
// violet / cyan / magenta / gold energy, aura waves spreading out, comets leaving 잔상.
// Solid fills only (no SVG gradient ids), so many copies on one page never clash.

const ring = (a: number, b: number) => `-webkit-mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1.5}%,#000 ${b}%,transparent ${b + 1.5}%);mask:radial-gradient(closest-side,transparent ${a}%,#000 ${a + 1.5}%,#000 ${b}%,transparent ${b + 1.5}%)`
const SPECTRUM = '#ffe27a,#ff4fd8,#7b3cff,#22e1ff,#7b3cff,#ff4fd8,#ffe27a'
const star = (x: number, y: number, r: number, fill: string, delay: number) =>
  `<g transform="translate(${x} ${y})"><path d="M0 -${r} C${r * 0.12} -${r * 0.26} ${r * 0.26} -${r * 0.12} ${r} 0 C${r * 0.26} ${r * 0.12} ${r * 0.12} ${r * 0.26} 0 ${r} C-${r * 0.12} ${r * 0.26} -${r * 0.26} ${r * 0.12} -${r} 0 C-${r * 0.26} -${r * 0.12} -${r * 0.12} -${r * 0.26} 0 -${r}Z" fill="${fill}" style="transform-box:fill-box;transform-origin:center;animation:avTw 1.6s ease-in-out ${delay}s infinite"></path></g>`
const spark = (x: number, y: number, r: number, fill: string, delay: number) =>
  `<g transform="translate(${x} ${y})"><circle r="${r}" fill="${fill}" class="aura-spark" style="animation:auraSpark 1.9s ease-out ${delay}s infinite"></circle></g>`
/** A cut gem (faceted, solid colours), centred on 0,0, about 20 wide. */
export const GEM = '<polygon points="-10,-3 -5.5,-9 5.5,-9 10,-3" fill="#ffd9ff"></polygon><polygon points="-5.5,-9 -2.5,-3 -10,-3" fill="#ffe27a"></polygon><polygon points="5.5,-9 2.5,-3 10,-3" fill="#9ff3ff"></polygon><polygon points="-10,-3 -2.5,-3 0,11" fill="#7b3cff"></polygon><polygon points="-2.5,-3 2.5,-3 0,11" fill="#ff4fd8"></polygon><polygon points="2.5,-3 10,-3 0,11" fill="#22c4ff"></polygon><polygon points="-10,-3 -5.5,-9 5.5,-9 10,-3 0,11" fill="none" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round"></polygon><polygon points="-3,-7.5 -1,-4.5 -5,-4.5" fill="#ffffff" opacity="0.9"></polygon>'

export const AURA_AVATAR = {
  before:
    // a breathing glow behind everything, then aura waves spreading out
    `<div class="aura-glow" style="position:absolute;inset:-22%;border-radius:50%;background:radial-gradient(closest-side,rgba(123,60,255,0.6),rgba(34,225,255,0.28) 55%,rgba(255,79,216,0.12) 70%,transparent 78%);animation:auraBreath 1.8s ease-in-out infinite"></div>` +
    `<div class="aura-wave" style="position:absolute;inset:-8%;border-radius:50%;background:radial-gradient(closest-side,transparent 58%,rgba(123,60,255,0.7) 72%,rgba(34,225,255,0.35) 86%,transparent 100%);animation:auraSpread 2.2s ease-out infinite"></div>` +
    `<div class="aura-wave" style="position:absolute;inset:-8%;border-radius:50%;background:radial-gradient(closest-side,transparent 58%,rgba(255,79,216,0.6) 72%,rgba(255,226,122,0.35) 86%,transparent 100%);animation:auraSpread 2.2s ease-out 1.1s infinite"></div>` +
    // glow + spinning spectrum ring
    `<div style="position:absolute;inset:-10%;filter:blur(4px);opacity:0.95"><div class="aura-ring" style="position:absolute;inset:0;border-radius:50%;background:conic-gradient(${SPECTRUM});${ring(80, 99)};animation:avSpin 2s linear infinite"></div></div>` +
    `<div class="aura-ring" style="position:absolute;inset:-10%;border-radius:50%;background:conic-gradient(${SPECTRUM});${ring(84, 98)};animation:avSpin 2s linear infinite"></div>`,
  after:
    // two comets orbiting the other way, each dragging a fading tail (잔상)
    `<div class="aura-comet" style="position:absolute;inset:-14%;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 60%,rgba(255,226,122,0.08) 64%,rgba(255,226,122,0.6) 90%,#ffffff 99%,transparent 100%);${ring(89, 96)};animation:avSpin 1.25s linear infinite"></div>` +
    `<div class="aura-comet" style="position:absolute;inset:-18%;border-radius:50%;background:conic-gradient(from 180deg,transparent 0 64%,rgba(34,225,255,0.08) 68%,rgba(34,225,255,0.6) 92%,#e8fdff 99%,transparent 100%);${ring(91, 96)};animation:avSpin 1.8s linear infinite reverse"></div>` +
    `<svg viewBox="0 0 120 120" style="position:absolute;inset:-10%;width:120%;height:120%;overflow:visible">` +
    `<g transform="translate(60 4) scale(1.4)"><g class="aura-gem" style="transform-box:fill-box;transform-origin:center;animation:auraGem 2s ease-in-out infinite">${GEM}</g></g>` +
    star(12, 30, 6, '#ffe27a', 0) + star(110, 42, 5, '#9ff3ff', 0.5) + star(104, 104, 6, '#ff9cf0', 0.9) + star(14, 96, 4.5, '#ffffff', 1.3) +
    spark(24, 108, 2.2, '#ffe27a', 0) + spark(96, 112, 1.8, '#22e1ff', 0.6) + spark(60, 116, 2, '#ff4fd8', 1.2) +
    `</svg>`,
}

export const AURA_PLATE =
  `<div style="position:absolute;inset:0;overflow:hidden;border-radius:14px">` +
  // drifting aurora
  `<div class="aura-drift" style="position:absolute;left:-12%;top:-70%;width:58%;height:240%;background:radial-gradient(closest-side,rgba(123,60,255,0.95),transparent);filter:blur(10px);animation:auraDrift 6s ease-in-out infinite alternate"></div>` +
  `<div class="aura-drift" style="position:absolute;left:32%;top:-80%;width:50%;height:250%;background:radial-gradient(closest-side,rgba(34,225,255,0.7),transparent);filter:blur(12px);animation:auraDrift 7.5s ease-in-out infinite alternate-reverse"></div>` +
  `<div class="aura-drift" style="position:absolute;left:62%;top:-70%;width:48%;height:240%;background:radial-gradient(closest-side,rgba(255,79,216,0.75),rgba(255,226,122,0.25) 60%,transparent);filter:blur(10px);animation:auraDrift 5s ease-in-out infinite alternate"></div>` +
  // a comet crossing, with two tinted afterimages trailing it (잔상)
  `<div class="aura-streak" style="position:absolute;left:0;right:0;top:calc(50% - 5px);height:2px;animation:auraStreak 3.4s cubic-bezier(.3,.1,.3,1) 0.16s infinite;opacity:0"><div style="width:30%;height:100%;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(34,225,255,0.55))"></div></div>` +
  `<div class="aura-streak" style="position:absolute;left:0;right:0;top:calc(50% + 3px);height:2px;animation:auraStreak 3.4s cubic-bezier(.3,.1,.3,1) 0.08s infinite;opacity:0"><div style="width:30%;height:100%;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(255,79,216,0.6))"></div></div>` +
  `<div class="aura-streak" style="position:absolute;left:0;right:0;top:calc(50% - 1px);height:2px;animation:auraStreak 3.4s cubic-bezier(.3,.1,.3,1) infinite;opacity:0"><div style="width:30%;height:100%;border-radius:2px;background:linear-gradient(90deg,transparent,#ffffff);box-shadow:0 0 6px #fff,0 0 12px #b58cff"></div></div>` +
  // aura rings spreading from the emblem
  `<div class="aura-wave" style="position:absolute;right:6px;top:calc(50% - 22px);width:44px;height:44px;border-radius:50%;background:radial-gradient(closest-side,transparent 55%,rgba(255,226,122,0.7) 72%,rgba(123,60,255,0.3) 88%,transparent 100%);animation:auraSpread 2.2s ease-out infinite"></div>` +
  `<div class="aura-wave" style="position:absolute;right:6px;top:calc(50% - 22px);width:44px;height:44px;border-radius:50%;background:radial-gradient(closest-side,transparent 55%,rgba(34,225,255,0.7) 72%,rgba(255,79,216,0.3) 88%,transparent 100%);animation:auraSpread 2.2s ease-out 1.1s infinite"></div>` +
  `<svg viewBox="0 0 320 56" preserveAspectRatio="xMaxYMid slice" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">` +
  star(150, 12, 3.5, '#ffffff', 0) + star(212, 44, 3, '#9ff3ff', 0.6) + star(250, 10, 2.6, '#ffe27a', 1.1) + star(186, 30, 2.2, '#ff9cf0', 0.3) +
  `<g transform="translate(286 29) scale(1.1)"><g class="aura-gem" style="transform-box:fill-box;transform-origin:center;animation:auraGem 2s ease-in-out infinite">${GEM}</g></g>` +
  `</svg>` +
  `</div>` +
  // spinning spectrum border
  `<div style="position:absolute;inset:0;border-radius:14px;padding:1.5px;overflow:hidden;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);z-index:3;pointer-events:none">` +
  `<div class="aura-ring" style="position:absolute;left:-25%;top:50%;width:150%;padding-top:150%;margin-top:-75%;background:conic-gradient(${SPECTRUM});animation:avSpin 3s linear infinite"></div></div>`
