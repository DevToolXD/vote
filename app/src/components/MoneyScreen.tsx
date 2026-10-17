import type { ReactNode } from 'react'
import { css } from '../css'
import { PointsChip } from './PointsChip'
import { Segmented } from './Segmented'

export type MoneyTab = 'bank' | 'invest' | 'shop'
export type InvestTab = 'coin' | 'stock'
const SUBS = [['bank', '은행'], ['invest', '투자'], ['shop', '상점']] as const
const INVEST = [['coin', '코인'], ['stock', '주식']] as const

/**
 * 돈 tab: 은행 · 투자 · 상점 under one title. 투자 has a second switch for 코인 and 주식. The pages are given
 * as `bank`, `coin`, `stock` and `shop`; each fills what is left under the switches.
 */
export function MoneyScreen({ sub, onSub, invest, onInvest, points, loggedIn, onPoints, bank, coin, stock, shop }: {
  sub: MoneyTab; onSub: (t: MoneyTab) => void; invest: InvestTab; onInvest: (t: InvestTab) => void
  points: number; loggedIn: boolean; onPoints: () => void; bank: ReactNode; coin: ReactNode; stock: ReactNode; shop: ReactNode
}) {
  const dark = sub === 'invest' && invest === 'stock'
  const body = sub === 'bank' ? bank : sub === 'shop' ? shop : invest === 'coin' ? coin : stock
  const bg = dark ? '#000000' : sub === 'shop' ? '#f2f2f7' : '#ffffff'
  return (
    <div data-ios="" style={css('flex:1;min-height:0;display:flex;flex-direction:column;transition:background 300ms;background:' + bg)}>
      <header style={css('flex:none;padding:10px 20px 8px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:' + (dark ? '#000' : sub === 'shop' ? '#f2f2f7' : '#fff') + ';transition:background 300ms')}>
        <span style={css('font-size:30px;line-height:38px;font-weight:800;letter-spacing:-0.6px;color:' + (dark ? '#fff' : '#191f28'))}>돈</span>
        {loggedIn && sub !== 'shop' && !dark && <PointsChip points={points} onClick={onPoints} />}
      </header>
      <div style={css('flex:none;padding:0 20px 10px;display:flex;flex-direction:column;gap:8px;background:' + (dark ? '#000' : sub === 'shop' ? '#f2f2f7' : '#fff') + ';transition:background 300ms')}>
        <Segmented label="돈" items={SUBS} value={sub} onChange={onSub} dark={dark} />
        {sub === 'invest' && <Segmented label="투자" items={INVEST} value={invest} onChange={onInvest} dark={dark} />}
      </div>
      <div key={sub + (sub === 'invest' ? invest : '')} data-phone-scroll style={css('flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto;position:relative;--phone-top:0px;--phone-bottom:' + (sub === 'shop' ? '26px' : '0px') + ';animation:pageIn 380ms cubic-bezier(0.32,0.72,0,1) both')}>
        {body}
      </div>
    </div>
  )
}
