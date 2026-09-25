import { serverTimestamp } from 'firebase/firestore'

/** A brand-new leaderboard entry — exactly the shape the candidates create rule accepts. */
export const newCandidateDoc = (uid: string, name: string) => ({
  name,
  ownerUid: uid,
  up: 0,
  down: 0,
  score: 0,
  gender: '',
  bio: '',
  photoURL: '',
  frame: 'none',
  plate: 'none',
  skin: 'none',
  spent: 0,
  owned: { frame: ['none'], plate: ['none'], skin: ['none'] },
  createdAt: serverTimestamp(),
})
