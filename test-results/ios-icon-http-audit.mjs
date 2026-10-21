import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const agents = {
  safari26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  safari18: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1',
  appleNetworking: 'com.apple.WebKit.Networking/8619.1.26.30.7 CFNetwork/3860.200.71.2.2 Darwin/25.0.0',
  safariViewService: 'SafariViewService/8622.1.15.10.7 CFNetwork/3860.200.71.2.2 Darwin/25.0.0',
  none: '',
}
const paths = ['/', '/manifest.json', '/icons/lion-794daf1cde13-180.png', '/icons/lion-794daf1cde13-maskable-512.png', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png', '/apple-touch-icon-180x180.png', '/apple-touch-icon-120x120.png', '/favicon.ico']
const results = []
for (const [agent, ua] of Object.entries(agents)) {
  await Promise.all(paths.map(async path => {
    const response = await fetch(`https://www.fitpp.com.br${path}`, { headers: { 'User-Agent': ua, 'Accept': '*/*' }, cache: 'no-store' })
    const bytes = Buffer.from(await response.arrayBuffer())
    const entry = { agent, path, status: response.status, finalURL: response.url, type: response.headers.get('content-type'), length: bytes.length, signature: bytes.subarray(0, 8).toString('hex'), sha256: createHash('sha256').update(bytes).digest('hex'), cache: response.headers.get('cache-control'), csp: response.headers.get('content-security-policy'), mitigation: response.headers.get('x-vercel-mitigated'), vercelId: response.headers.get('x-vercel-id') }
    results.push(entry)
    console.log(JSON.stringify({ agent, path, status: entry.status, type: entry.type, length: entry.length, mitigation: entry.mitigation }))
    if (agent === 'safari26' && path === '/') writeFileSync(new URL('ios-live-page.html', import.meta.url), bytes)
  }))
}
writeFileSync(new URL('ios-icon-http-audit.json', import.meta.url), JSON.stringify(results, null, 2))
