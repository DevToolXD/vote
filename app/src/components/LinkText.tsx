import { splitLinks } from '../linkText'
import { css } from '../css'

/** Text with its web links made clickable (blue; white on a blue bubble). They open in a new tab. */
export function LinkText({ text, mine = false }: { text: string; mine?: boolean }) {
  return (
    <>
      {splitLinks(text).map((p, i) => p.href
        ? <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            style={css(`color:${mine ? '#ffffff' : '#1b64da'};text-decoration:underline;text-underline-offset:2px;word-break:break-all`)}>{p.text}</a>
        : <span key={i}>{p.text}</span>)}
    </>
  )
}
