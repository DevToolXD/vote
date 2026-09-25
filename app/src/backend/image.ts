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
 * Chat photos: keeps the aspect ratio, shrinks the long side to ≤1280px and
 * lowers quality until the JPEG data URL fits MAX_CHAT_IMAGE.
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
      for (const [side, q] of [[1280, 0.75], [1024, 0.68], [800, 0.6], [640, 0.55]] as const) {
        const k = Math.min(1, side / Math.max(img.width, img.height))
        canvas.width = Math.round(img.width * k)
        canvas.height = Math.round(img.height * k)
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const out = canvas.toDataURL('image/jpeg', q)
        if (out.length <= MAX_CHAT_IMAGE) { resolve(out); return }
      }
      reject(new Error('image-too-large'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image-decode-failed')) }
    img.src = url
  })
}
