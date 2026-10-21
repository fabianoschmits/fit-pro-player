import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { parseHTML } = require('linkedom')
const { chromium } = require('@playwright/test')
const root = new URL('../', import.meta.url)
const base = 'https://fitpp.com.br'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const result = { base, assets: [], browser: {} }
const htmlResponse = await fetch(base, { cache: 'no-store' })
assert.equal(htmlResponse.status, 200)
const html = await htmlResponse.text()
const { document } = parseHTML(html)
const manifestHref = document.querySelector('link[rel="manifest"]').getAttribute('href')
const manifest = await (await fetch(new URL(manifestHref, base), { cache: 'no-store' })).json()
assert.equal(manifest.id, '/')
assert.equal(manifest.scope, '/')
assert.equal(manifest.start_url, '/')
const iconLinks = [...document.querySelectorAll('link[rel*="icon"]')].map(el => el.getAttribute('href'))
assert(iconLinks.every(path => path.includes('/icons/lion-794daf1cde13')))
assert(manifest.icons.every(icon => icon.src.includes('/icons/lion-794daf1cde13')))
const preview = document.querySelector('meta[property="og:image"]').getAttribute('content')
assert.equal(preview, 'https://fitpp.com.br/icons/lion-794daf1cde13-preview.png')

const publicDir = new URL('frontend/public/', root)
const aliases = readdirSync(publicDir).filter(name => /^(?:favicon.*\.(?:ico|png)|apple-touch-icon.*\.png|icon-.*\.png|brand-logo\.png)$/.test(name))
const exported = readdirSync(new URL('icons/', publicDir)).map(name => `icons/${name}`)
const paths = [...new Set([...aliases, ...exported, 'manifest.json', 'sw.js'])]
for (let i = 0; i < paths.length; i += 6) {
  await Promise.all(paths.slice(i, i + 6).map(async path => {
    const response = await fetch(new URL(`/${path}`, base), { cache: 'no-store' })
    assert.equal(response.status, 200, path)
    const bytes = Buffer.from(await response.arrayBuffer())
    const local = readFileSync(new URL(path, publicDir))
    assert.equal(sha(bytes), sha(local), `Deployed bytes differ: ${path}`)
    const cache = response.headers.get('cache-control')
    if (path.startsWith('icons/')) assert.match(cache, /immutable/, path)
    else assert.match(cache, /max-age=0.*must-revalidate/, path)
    assert.match(response.headers.get('content-type'), path.endsWith('.png') ? /image\/png/ : path.endsWith('.ico') ? /image\// : path.endsWith('.json') ? /json/ : /javascript/)
    result.assets.push({ path, status: response.status, sha256: sha(bytes), cache })
  }))
}
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'allow' })
  const page = await context.newPage()
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('img[src="/brand-logo.png"]').first().waitFor({ state: 'visible' })
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  const cdp = await context.newCDPSession(page)
  const appManifest = await cdp.send('Page.getAppManifest')
  assert.equal(appManifest.errors.length, 0, JSON.stringify(appManifest.errors))
  assert.equal(JSON.parse(appManifest.data).icons[0].src, manifest.icons[0].src)
  result.browser.manifestErrors = appManifest.errors
  result.browser.installability = await cdp.send('Page.getInstallabilityErrors')
  result.browser.title = await page.title()
  result.browser.iconLinks = await page.locator('link[rel*="icon"]').evaluateAll(links => links.map(link => link.href))
  result.browser.worker = await page.evaluate(async () => (await navigator.serviceWorker.ready).active.scriptURL)
  await page.screenshot({ path: fileURLToPath(new URL('test-results/production-lion-home.png', root)), fullPage: false })
  // Exercise a real active worker against a deliberately obsolete cached alias.
  await page.reload({ waitUntil: 'networkidle' })
  const liveBrand = await page.evaluate(async () => {
    const cache = await caches.open('fit-pro-player-rt-v19')
    await cache.put('/icon-512-v22.png', new Response('obsolete brand bytes', { headers: { 'Content-Type': 'image/png' } }))
    const response = await fetch('/icon-512-v22.png')
    const data = await response.arrayBuffer()
    return { signature: [...new Uint8Array(data).slice(0, 8)], length: data.byteLength }
  })
  assert.deepEqual(liveBrand.signature, [137, 80, 78, 71, 13, 10, 26, 10])
  result.browser.oldCacheRefresh = liveBrand
  await context.close()
} finally { await browser.close() }
writeFileSync(new URL('test-results/production-lion-verification.json', root), JSON.stringify(result, null, 2))
console.log(JSON.stringify({ verifiedAssets: result.assets.length, browser: result.browser }, null, 2))
