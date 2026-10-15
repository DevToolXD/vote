// Paints the 삼겹살 먹고싶다 set's images (src/components/silverArt.ts) in a real browser and saves
// them to public/art/silver/, where the app loads them from. Run after changing the painting code,
// and bump SILVER_VER in silverArt.ts so phones don't keep the old pictures:
//   node scripts/silver-art.mjs        (needs the playwright package and its Chromium)
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const app = fileURLToPath(new URL('..', import.meta.url))
const ver = /const SILVER_VER = (\d+)/.exec((await import('node:fs')).readFileSync(app + 'src/components/silverArt.ts', 'utf8'))[1]
const out = await build({
  stdin: { contents: `import { paintSilverImages } from './src/components/silverArt'
window.__paint = async () => { const m = await paintSilverImages(); const o = {}; for (const [k, c] of Object.entries(m)) o[k] = c.toDataURL('image/webp', 0.9); return o }`, resolveDir: app, loader: 'ts' },
  bundle: true, write: false, format: 'iife', loader: { '.png': 'empty', '.jpg': 'empty' },
})
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
const page = await browser.newPage()
await page.setContent('<!doctype html><body></body>')
await page.addScriptTag({ content: out.outputFiles[0].text })
const images = await page.evaluate(() => window.__paint())
await browser.close()
const dir = app + 'public/art/silver/'
mkdirSync(dir, { recursive: true })
let total = 0
for (const [cls, url] of Object.entries(images)) {
  if (!url.startsWith('data:image/webp')) throw new Error(`${cls}: the browser didn't make a webp`)
  const buf = Buffer.from(url.split(',')[1], 'base64')
  writeFileSync(`${dir}${cls}.v${ver}.webp`, buf)
  total += buf.length
  console.log(cls, Math.round(buf.length / 1024) + ' KB')
}
console.log(`${Object.keys(images).length} images, ${Math.round(total / 1024)} KB in all`)
