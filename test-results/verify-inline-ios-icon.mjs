import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
const require = createRequire(new URL('../frontend/package.json', import.meta.url))
const { parseHTML } = require('linkedom')
const { webkit, devices } = require('@playwright/test')
const live = process.argv.includes('--live')
const url = 'https://www.fitpp.com.br/?pwa-icon=inline-v1'
const response = live ? await fetch(url, { cache: 'no-store' }) : null
if (response) assert.equal(response.status, 200)
const html = response ? await response.text() : readFileSync(new URL('../frontend/dist/index.html', import.meta.url), 'utf8')
const document = parseHTML(html).document
const inline = document.querySelector('link[rel="apple-touch-icon-precomposed"]').getAttribute('href')
assert(inline.startsWith('data:image/png;base64,'), 'Installer still depends on an external preferred Apple icon')
const bytes = Buffer.from(inline.split(',')[1], 'base64')
const expected = readFileSync(new URL('../frontend/public/apple-touch-icon.png', import.meta.url))
assert.deepEqual(bytes, expected)
const fallback = document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href')
assert(!fallback.startsWith('data:'))
if (live) {
  const fetchedFallback = await fetch(new URL(fallback, url), { cache: 'no-store' })
  assert.equal(fetchedFallback.status, 200)
  assert.deepEqual(Buffer.from(await fetchedFallback.arrayBuffer()), expected)
}
const csp = response?.headers.get('content-security-policy') || JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url))).headers[0].headers.find(header => header.key === 'Content-Security-Policy').value
const browser = await webkit.launch({ headless: true })
const result = { live, pngBytes: bytes.length, pngSha256: createHash('sha256').update(bytes).digest('hex'), htmlBytes: Buffer.byteLength(html), fallback, nativeSheetVerified: false }
try {
  const context = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' })
  const blocked = []
  await context.route('**/*', async route => {
    if (route.request().isNavigationRequest()) return route.fulfill({ status: 200, contentType: 'text/html', body: html, headers: { 'Content-Security-Policy': csp } })
    blocked.push(route.request().url())
    await route.abort()
  })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  result.decodedWithoutNetwork = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="apple-touch-icon-precomposed"]')
    const image = new Image()
    image.src = link.href
    await image.decode()
    return [image.naturalWidth, image.naturalHeight]
  })
  assert.deepEqual(result.decodedWithoutNetwork, [180, 180])
  assert(!blocked.some(path => path.startsWith('data:')))
  result.networkRequestsBlocked = blocked.length
  await context.close()
} finally { await browser.close() }
writeFileSync(new URL(live ? 'ios-inline-live-verification.json' : 'ios-inline-local-verification.json', import.meta.url), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
