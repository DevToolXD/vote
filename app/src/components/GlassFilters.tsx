// SVG displacement filters used by the glass theme (url(#lg-l3), url(#lg-l4)) — chromatic-aberration refraction.

const layer = (id: string, s: number) => (
  <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves={2} seed={7} result="n" />
    <feGaussianBlur in="n" stdDeviation="2" result="nb" />
    <feDisplacementMap in="SourceGraphic" in2="nb" scale={s} xChannelSelector="R" yChannelSelector="G" result="dr" />
    <feDisplacementMap in="SourceGraphic" in2="nb" scale={s + 1.5} xChannelSelector="R" yChannelSelector="G" result="dg" />
    <feDisplacementMap in="SourceGraphic" in2="nb" scale={s + 3} xChannelSelector="R" yChannelSelector="G" result="db" />
    <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r" />
    <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g" />
    <feColorMatrix in="db" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b" />
    <feBlend in="r" in2="g" mode="screen" result="rg" />
    <feBlend in="rg" in2="b" mode="screen" />
  </filter>
)

export const GlassFilters = () => (
  <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
    <defs>{layer('lg-l3', 12)}{layer('lg-l4', 20)}</defs>
  </svg>
)
