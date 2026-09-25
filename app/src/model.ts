import { DATA, ME, PROFILES, SKIN_OF, fmt, type Candidate, type Vote } from './data'

export type MyLook = { skin: string; frame: string; plate: string; gender: string; bio: string; photo: string | null }

export type Person = Candidate & {
  v: Vote
  upN: number
  downN: number
  score: number
  scoreLabel: string
  upLabel: string
  downLabel: string
  skin: string
  frame: string
  plate: string
  gender: string
  bio: string
  photoCss: string
  isMe: boolean
}

/** Applies the viewer's votes and decorations to the mock list (rank stays as seeded). */
export function buildPeople(votes: Record<number, Vote>, me: MyLook): Person[] {
  return DATA.map(d => {
    const v = votes[d.id] || 0
    const upN = d.up + (v === 1 ? 1 : 0), downN = d.down + (v === -1 ? 1 : 0), score = upN - downN
    const isMe = d.name === ME, p = PROFILES[d.name] || ['none', '', '']
    return {
      ...d, v, upN, downN, score, scoreLabel: fmt(score), upLabel: upN.toLocaleString(), downLabel: downN.toLocaleString(),
      skin: isMe ? me.skin : SKIN_OF[d.name] || 'none',
      frame: isMe ? me.frame : p[0],
      plate: isMe ? me.plate : p[0],
      gender: isMe ? me.gender : p[1],
      bio: isMe ? me.bio : p[2],
      photoCss: isMe && me.photo ? `url(${me.photo})` : 'none',
      isMe,
    }
  })
}
