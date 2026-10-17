import { useSyncExternalStore } from 'react'
import type { Firestore, Unsubscribe } from 'firebase/firestore'
import { loadOlderPosts, watchPosts, type Post } from './posts'

// The 인스타그램 photos, kept for as long as the app is open (not by the screen): leaving the tab and coming back shows
// everything that was loaded, instantly, and nothing is fetched again. The newest page is live; older pages are asked for one at
// a time; a photo that is pushed out of the live page by newer ones stays in the list; a heart or comment on any photo shows
// at once (patchPost) without waiting for the server.

export type PostsView = { live: Post[] | null; older: Post[]; more: boolean }
const EMPTY: PostsView = { live: null, older: [], more: true }
let view = EMPTY
const subs = new Set<() => void>()
const emit = (p: Partial<PostsView>) => { view = { ...view, ...p }; subs.forEach(f => f()) }

let stop: Unsubscribe | null = null, owner = '', loading = false

/** Starts the live page for this person (once: asking again changes nothing; another person starts over). */
export function startPosts(db: Firestore, uid: string, page: number) {
  if (stop && owner === uid) return
  stopPosts()
  owner = uid
  stop = watchPosts(db, next => {
    const prev = view.live
    // photos that were in the live page and are now below its end (newer ones came) are kept; one that is gone from inside the page was deleted
    if (prev && next.length) {
      const oldest = Math.min(...next.map(p => p.at)), ids = new Set(next.map(p => p.id))
      const slid = prev.filter(p => !ids.has(p.id) && p.at < oldest)
      if (slid.length) emit({ older: [...view.older, ...slid.filter(x => !view.older.some(y => y.id === x.id))] })
    }
    emit({ live: next })
  }, page)
}
/** Signed out: everything is let go. */
export function stopPosts() {
  stop?.(); stop = null; owner = ''; loading = false
  view = EMPTY; subs.forEach(f => f())
}

/** The next older page, after the oldest photo there is. */
export async function morePosts(db: Firestore, page: number) {
  const all = [...(view.live ?? []), ...view.older].sort((a, b) => b.at - a.at)
  const last = all[all.length - 1]
  if (!last || !view.more || loading) return
  loading = true
  const who = owner
  try {
    const got = await loadOlderPosts(db, last, page)
    if (owner !== who) return
    emit({ older: [...view.older, ...got.filter(g => !view.older.some(x => x.id === g.id) && !(view.live ?? []).some(x => x.id === g.id))], more: got.length >= page })
  } catch { /* offline: asked again when the end comes near again */ } finally { loading = false }
}

/** Changes one photo in the list at once (the server's answer follows). */
export function patchPost(id: string, f: (p: Post) => Post) {
  const map = (l: Post[]) => l.map(p => (p.id === id ? f(p) : p))
  emit({ live: view.live && map(view.live), older: map(view.older) })
}
/** Takes a deleted photo out of the list at once. */
export function dropPost(id: string) {
  emit({ live: view.live && view.live.filter(p => p.id !== id), older: view.older.filter(p => p.id !== id) })
}

export const usePostStore = (): PostsView => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => view)
