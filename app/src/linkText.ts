// Finds the web links in a message or caption: "https://…" and "www.…" (a www. link opens as https).
// Only http and https are ever linked, so nothing else can be made clickable.
export type TextPiece = { text: string; href?: string }

const LINK = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi
// punctuation right after a link ("see https://a.b/c.") is the sentence's, not the link's
const TRAIL = /[.,!?;:)\]}>"'』」”’]+$/

export function splitLinks(text: string): TextPiece[] {
  const out: TextPiece[] = []
  let last = 0
  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0
    const url = m[0].slice(0, m[0].length - (m[0].match(TRAIL)?.[0].length ?? 0))
    if (url.replace(/^(https?:\/\/|www\.)/i, '').length < 3) continue // "www." on its own is not a link
    if (start > last) out.push({ text: text.slice(last, start) })
    out.push({ text: url, href: /^https?:\/\//i.test(url) ? url : `https://${url}` })
    last = start + url.length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}
