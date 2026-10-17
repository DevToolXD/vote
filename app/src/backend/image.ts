/**
 * Profile photos are stored as a small JPEG data URL directly on the candidate
 * doc (no Firebase Storage — that now requires the paid Blaze plan). Shrinking
 * to a small square here keeps each doc a few KB so the whole leaderboard
 * subscription — which fetches every candidate doc on every load — stays cheap.
 * Not meant to scale to a large user base; see app/README.md.
 */
export function fileToPhotoDataUrl(file: File, maxDim = 128, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const side = Math.min(img.width, img.height)
      const sx = (img.width - side) / 2, sy = (img.height - side) / 2
      const size = Math.min(maxDim, side)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas-unsupported')); return }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image-decode-failed')) }
    img.src = url
  })
}

/** Longest data URL a chat photo may be (firestore.rules checks the same; a doc holds 1 MiB). */
export const MAX_CHAT_IMAGE = 700_000

/**
 * Chat photos: keeps the aspect ratio and is made small to save data (the sender's and everyone who opens the chat):
 * the long side ≤1024px, lowered until the JPEG data URL is about 150 KB (it only has to fit MAX_CHAT_IMAGE at the very least).
 */
export function fileToChatImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas-unsupported')); return }
      let last = ''
      for (const [side, q] of [[1024, 0.72], [900, 0.64], [800, 0.58], [640, 0.52], [512, 0.5]] as const) {
        const k = Math.min(1, side / Math.max(img.width, img.height))
        canvas.width = Math.round(img.width * k)
        canvas.height = Math.round(img.height * k)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const out = canvas.toDataURL('image/jpeg', q)
        last = out
        if (out.length <= 150_000) { resolve(out); return }
      }
      if (last.length <= MAX_CHAT_IMAGE) resolve(last)
      else reject(new Error('image-too-large'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image-decode-failed')) }
    img.src = url
  })
}
