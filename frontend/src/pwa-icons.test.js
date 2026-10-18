import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'

const indexHtml = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8')
const { document } = parseHTML(indexHtml)
const publicFile = href => fileURLToPath(new URL(`../public${new URL(href, 'https://fitpp.com.br').pathname}`, import.meta.url))

describe('PWA icon fallbacks', () => {
  it('declares a lion favicon fallback for installation previews', () => {
    const icons = [...document.querySelectorAll('link[rel*="icon"]')]
    expect(icons.length).toBeGreaterThan(0)
    for (const icon of icons) expect(existsSync(publicFile(icon.getAttribute('href')))).toBe(true)
    expect(existsSync(publicFile('/favicon.ico'))).toBe(true)
  })

  it('ships real PNGs of the advertised size for every install icon', () => {
    const manifest = JSON.parse(readFileSync(publicFile('/manifest.json'), 'utf8'))
    expect(manifest.id).toBe('/')
    expect(manifest.icons.filter(icon => icon.purpose === 'maskable')).toHaveLength(2)
    for (const icon of manifest.icons) {
      const png = readFileSync(publicFile(icon.src))
      expect(png.subarray(1, 4).toString()).toBe('PNG')
      const [width, height] = icon.sizes.split('x').map(Number)
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([width, height])
    }
  })

  it('ships the sharing preview at its advertised dimensions', () => {
    const og = property => document.querySelector(`meta[property="${property}"]`).getAttribute('content')
    const png = readFileSync(publicFile(og('og:image')))
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([Number(og('og:image:width')), Number(og('og:image:height'))])
    expect(document.querySelector('meta[name="twitter:image"]').getAttribute('content')).toBe(og('og:image'))
  })
})
