import { readFileSync } from 'node:fs'

// Safari 26 supports data: icons and prefers precomposed at equal size.
// Deliver the PNG with the document so the native installer needs no icon
// download. Keep the ordinary file link as the fallback for older WebKit.
export function inlineAppleTouchIcon() {
  return {
    name: 'inline-apple-touch-icon',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const png = readFileSync(new URL('../public/apple-touch-icon.png', import.meta.url))
        const uri = `data:image/png;base64,${png.toString('base64')}`
        return html.replace(
          /(<link rel="apple-touch-icon-precomposed"[^>]*\bhref=")[^"]*(")/,
          (_, before, after) => `${before}${uri}${after}`,
        )
      },
    },
  }
}
