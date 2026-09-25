import type { CSSProperties } from 'react'
import { css, sx } from '../css'
import { CHART_H, MEDALS, PER, skinGeom } from '../data'
import type { Person } from '../model'
import { Avatar } from './Avatar'
import { SearchIcon } from './icons'
import { TowerSkin } from './TowerSkin'

const EASE = '550ms cubic-bezier(0.22,1,0.36,1)'
const RIDE = 'labelRide 600ms cubic-bezier(0.22,1,0.36,1) both'
const LABEL_PAD = 60, CHART_EFF = CHART_H - LABEL_PAD

type Props = {
  all: Person[]
  query: string
  onQuery: (q: string) => void
  page: number
  onPage: (p: number) => void
  onOpenProfile: (id: number) => void
}

/**
 * Vertical net-score chart, 10 per page. Bar length is relative to the page's own max.
 * Rows are keyed by slot index so paging animates heights instead of remounting.
 */
export function RankScreen({ all, query, onQuery, page, onPage, onOpenProfile }: Props) {
  const q = query.trim()
  const filtered = q ? all.filter(d => d.name.includes(q)) : all
  const nPages = Math.max(1, Math.ceil(filtered.length / PER))
  const pg = Math.min(page, nPages - 1)
  const slice = filtered.slice(pg * PER, pg * PER + PER)

  const posMax = Math.max(0, ...slice.map(d => d.score)), negMax = Math.max(0, ...slice.map(d => -d.score))
  const span = Math.max(1, posMax + negMax)
  const zeroTop = Math.round((posMax > 0 ? LABEL_PAD : 6) + posMax / span * CHART_EFF)
  const chartH = negMax > 0 ? Math.round(zeroTop + Math.max(negMax / span * CHART_EFF, 3) + 60) : zeroTop

  const rows = slice.map((d, i) => {
    const h = Math.max(Math.abs(d.score) / span * CHART_EFF, 3), pos = d.score >= 0
    const barTop = Math.round(pos ? zeroTop - h : zeroTop), barH = Math.round(h)
    const skin = d.skin !== 'none' ? skinGeom(d.skin, barH, !pos) : null
    return {
      d, skin, pos, barTop, barH,
      dy: (pos ? barH : -barH) + 'px',
      scoreShort: d.score > 0 ? d.score.toLocaleString() : d.scoreLabel,
      nameTop: pos ? Math.round(barTop - 42) : Math.round(barTop + h + 30),
      scoreTop: pos ? Math.round(barTop - 56) : Math.round(barTop + h + 44),
      avTop: pos ? Math.round(barTop - 27) : Math.round(barTop + h + 6),
      delay: (i * 0.04).toFixed(2) + 's',
      medal: MEDALS[d.rank - 1],
    }
  })

  const prevDisabled = pg === 0, nextDisabled = pg >= nPages - 1
  const arrow = 'position:absolute;top:0;bottom:0;width:24px;display:flex;align-items:center;justify-content:center;transition:color 200ms'

  return (
    <div data-g="clear" style={css('flex:1;background:#ffffff;padding-bottom:32px')}>
      <div style={{ height: 8 }} />
      <div style={css('padding:24px 24px 20px;display:flex;flex-direction:column;gap:4px')}>
        <h1 style={css('margin:0;font-size:22px;line-height:31px;font-weight:700;color:#191f28')}>실시간 랭킹</h1>
        <p style={css('margin:0;font-size:15px;line-height:22.5px;font-weight:500;color:#6b7684')}>추천에서 비추천을 뺀 점수로 순위를 매겨요</p>
      </div>
      <div style={css('padding:0 24px')}>
        <label data-g="l1" className="ring-within" style={css('height:48px;border-radius:14px;background:#f2f4f6;padding:0 8px 0 14px;display:flex;align-items:center;gap:8px')}>
          <SearchIcon size={20} stroke="#8b95a1" />
          <input value={query} onChange={e => onQuery(e.target.value)} placeholder="이름으로 찾기" style={css('flex:1;min-width:0;height:100%;border:0;background:transparent;font-size:17px;color:#191f28')} />
          {q && (
            <button onClick={() => onQuery('')} aria-label="지우기" style={css('width:32px;height:32px;display:flex;align-items:center;justify-content:center')}>
              <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#b0b8c1" /><path d="m9 9 6 6M15 9l-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          )}
        </label>
      </div>

      <div style={css('padding:20px 24px 8px;display:flex;align-items:center;justify-content:space-between;gap:12px')}>
        <span style={css('font-size:13px;line-height:19.5px;color:#6b7684')}>
          {filtered.length ? `${pg * PER + 1}~${Math.min(filtered.length, pg * PER + PER)}위 · ${q ? '검색 결과 ' : '총 '}${filtered.length}명` : '검색 결과 0명'}
        </span>
        {filtered.length > PER && <span style={css('font-size:13px;line-height:19.5px;font-weight:600;color:#4e5968;font-variant-numeric:tabular-nums')}>{pg + 1} / {nPages}</span>}
      </div>

      <div style={css('padding:8px 8px 0')}>
        <div data-g="l2" style={css('position:relative;border:1px solid #e5e8eb;border-radius:20px;background:#ffffff;padding:14px 24px 14px')}>
          <button className="pr-dim" onClick={() => !prevDisabled && onPage(pg - 1)} disabled={prevDisabled} aria-label="이전 페이지" style={sx(arrow + ';left:0;border-radius:20px 0 0 20px', { color: prevDisabled ? '#d1d6db' : '#191f28' })}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>
          </button>
          <button className="pr-dim" onClick={() => !nextDisabled && onPage(pg + 1)} disabled={nextDisabled} aria-label="다음 페이지" style={sx(arrow + ';right:0;border-radius:0 20px 20px 0', { color: nextDisabled ? '#d1d6db' : '#191f28' })}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg>
          </button>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', gap: 0, transition: `height ${EASE}`, height: chartH }}>
            <div style={{ position: 'absolute', left: 0, right: 0, height: 1, background: '#d1d6db', transition: `top ${EASE}`, top: zeroTop }} />
            {rows.map((r, i) => (
              <button key={i} className="pr-bar" onClick={() => onOpenProfile(r.d.id)} aria-label={`${r.d.name} 프로필`} style={css('flex:0 0 10%;min-width:0;position:relative;height:100%;padding:0;border-radius:10px;transition:background 150ms')}>
                <span
                  data-g={r.skin ? 'skin' : 'bar'}
                  style={{
                    position: 'absolute', left: 3, right: 3, borderRadius: 6, boxSizing: 'border-box',
                    border: r.skin ? '0' : '1.5px solid #191f28',
                    transition: `top ${EASE},height ${EASE}`,
                    background: r.skin ? 'transparent' : '#ffffff',
                    top: r.barTop, height: r.barH,
                    overflow: r.skin ? 'visible' : 'hidden',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: r.pos ? 'flex-end' : 'flex-start',
                    transformOrigin: r.pos ? 'bottom' : 'top',
                    animation: 'growY 600ms cubic-bezier(0.22,1,0.36,1) both',
                    animationDelay: r.delay,
                  }}
                >
                  {r.skin && <TowerSkin g={r.skin} animateSize />}
                </span>
                <span style={{ ...label, ...css('font-size:10px;line-height:12px;font-weight:600;letter-spacing:-0.3px;white-space:nowrap;color:#191f28'), ...ride(r.delay, r.dy), top: r.nameTop }}>{r.d.name}</span>
                <span style={{ ...label, width: 20, height: 20, ...ride(r.delay, r.dy), top: r.avTop }}>
                  <Avatar frame={r.d.frame} photo={r.d.photoCss} size={20} />
                </span>
                <span style={{ ...label, ...css('font-size:10px;letter-spacing:-0.4px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;color:#191f28'), ...ride(r.delay, r.dy), top: r.scoreTop }}>{r.scoreShort}</span>
              </button>
            ))}
          </div>
          <div style={css('display:flex;gap:0;padding-top:8px')}>
            {rows.map((r, i) => (
              <div key={i} style={css('flex:0 0 10%;min-width:0;display:flex;justify-content:center')}>
                <span style={{ ...css('width:26px;height:26px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums'), background: r.medal ? r.medal[0] : '#f2f4f6', color: r.medal ? r.medal[1] : '#4e5968', boxShadow: r.medal ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'none' }}>{r.d.rank}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {filtered.length === 0 && (
        <div style={css('padding:72px 24px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center')}>
          <span style={css('font-size:40px;line-height:1;margin-bottom:12px')}>🔍</span>
          <span style={css('font-size:17px;line-height:25.5px;font-weight:600;color:#333d4b')}>‘{query}’ 후보가 없어요</span>
          <span style={css('font-size:15px;line-height:22.5px;color:#6b7684')}>다른 이름으로 찾아보세요</span>
        </div>
      )}
    </div>
  )
}

const label = css('position:absolute;left:50%;transform:translateX(-50%)')

/** Name/avatar/score start at the bar base and ride up with the growing bar, then follow `top` transitions. */
function ride(delay: string, dy: string) {
  return { animation: RIDE, animationDelay: delay, '--dy': dy, transition: `top ${EASE}` } as CSSProperties
}
