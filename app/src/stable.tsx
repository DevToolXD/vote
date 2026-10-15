import { memo, useRef, useState, type ReactNode } from 'react'

/**
 * Functions that keep one identity for the life of the component but always run their latest
 * version. A memoized screen given these isn't drawn again just because its parent re-rendered and
 * made new closures. The set of names must stay the same between renders.
 */
export function useStableFns<T extends Record<string, ((...args: never[]) => unknown) | undefined>>(fns: T): T {
  const latest = useRef(fns)
  latest.current = fns
  const [stable] = useState(() => {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(fns)) out[k] = (...args: unknown[]) => (latest.current[k] as ((...a: unknown[]) => unknown) | undefined)?.(...args)
    return out as T
  })
  return stable
}

/** The page under a full-screen room: not drawn again while the room covers it (nobody can see it), brought up to date when it closes. */
export const Covered = memo(function Covered({ children }: { covered: boolean; children: ReactNode }) {
  return <>{children}</>
}, (_prev, next) => next.covered)
