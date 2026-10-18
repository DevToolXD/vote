import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, getDocs, limit, orderBy, query, type Firestore } from 'firebase/firestore'
import { css } from '../css'
import type { Person } from '../model'
import { Avatar } from './Avatar'
import { Segmented } from './Segmented'

// 랭킹 tab, second view: 음악 공유자 — everyone who shared songs in Spotify, ranked by the plays of all their songs added up
// (a song's `plays` are the full minutes people have listened to it; the worker counts them). Read once when the view opens.
type Row = { uid: string; plays: number; songs: number; best: string }

const MEDAL = ['#ffd84a', '#c9ced6', '#e0a370']

export function RankWithMusic({ db, loggedIn, byId, onOpenProfile, children }: { db: Firestore | null; loggedIn: boolean; byId: Map<string, Person>; onOpenProfile: (id: string) => void; children: ReactNode }) {
  const [view, setView] = useState<'rank' | 'music'>('rank')
  const [rows, setRows] = useState<Row[] | null>(null)
  useEffect(() => {
    if (view !== 'music' || !db || !loggedIn) return
    let live = true
    setRows(null)
    getDocs(query(collection(db, 'songs'), orderBy('plays', 'desc'), limit(500))).then(snap => {
      const by = new Map<string, Row & { top: number }>()
      for (const d of snap.docs) {
        const v = d.data(), uid = String(v.uid ?? ''), plays = Number(v.plays ?? 0)
        if (!uid || plays <= 0) continue
        const r = by.get(uid) ?? { uid, plays: 0, songs: 0, best: '', top: -1 }
        r.plays += plays; r.songs++
        if (plays > r.top) { r.top = plays; r.best = String(v.title ?? '') }
        by.set(uid, r)
      }
      if (live) setRows([...by.values()].sort((a, b) => b.plays - a.plays || b.songs - a.songs).slice(0, 50))
    }).catch(() => { if (live) setRows([]) })
    return () => { live = false }
  }, [view, db, loggedIn])
  const list = useMemo(() => rows ?? [], [rows])
  return (
    <div style={css('flex:1;min-height:0;display:flex;flex-direction:column')}>
      <div style={css('flex:none;padding:0 20px 10px')}>
        <Segmented label="랭킹 보기" items={[['rank', '인기 랭킹'], ['music', '음악 공유자']] as const} value={view} onChange={setView} />
      </div>
      {view === 'rank' ? children : (
        <div style={css('flex:1;padding:4px 20px 28px')}>
          <div style={css('font-size:13px;line-height:19px;color:#6b7684;padding:0 2px 12px')}>스포티파이에 올린 노래들의 조회수(들은 시간 기준 분)를 모두 합친 순서예요</div>
          {!loggedIn ? <div style={css('padding:40px;text-align:center;color:#8b95a1')}>로그인하면 볼 수 있어요</div>
            : rows === null ? <div style={css('padding:40px;text-align:center;color:#8b95a1')}>불러오는 중</div>
            : list.length === 0 ? <div style={css('padding:40px;text-align:center;color:#8b95a1')}>아직 조회수가 있는 노래가 없어요</div>
            : list.map((r, i) => {
              const p = byId.get(r.uid)
              return (
                <button key={r.uid} className="pr-98" onClick={() => p && onOpenProfile(r.uid)} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:10px 4px;text-align:left;background:none;border-bottom:1px solid #f2f4f6')}>
                  <span style={css(`flex:none;width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;background:${MEDAL[i] ?? '#f2f4f6'};color:${i < 3 ? '#191f28' : '#4e5968'}`)}>{i + 1}</span>
                  <span style={css('flex:none;display:block;width:40px;height:40px')}><Avatar frame={p?.frame ?? 'none'} photo={p?.photoCss} size={40} /></span>
                  <span style={css('flex:1;min-width:0')}>
                    <span style={css('display:block;font-size:16px;line-height:22px;font-weight:700;color:#191f28;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{p?.name ?? '알 수 없음'}</span>
                    <span style={css('display:block;font-size:13px;line-height:18px;color:#6b7684;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{r.songs}곡 · 대표곡 {r.best}</span>
                  </span>
                  <span style={css('flex:none;text-align:right;font-size:16px;font-weight:800;color:#3182f6;font-variant-numeric:tabular-nums')}>{r.plays.toLocaleString('ko-KR')}<span style={css('font-size:12px;font-weight:600;color:#8b95a1')}> 회</span></span>
                </button>
              )
            })}
        </div>
      )}
    </div>
  )
}
