import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const indexHtml = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8')
const faviconPath = fileURLToPath(new URL('../public/favicon.ico', import.meta.url))

describe('PWA icon fallbacks', () => {
  it('declares a lion favicon fallback for installation previews', () => {
    expect(indexHtml).toContain('rel="shortcut icon" href="/favicon.ico"')
    expect(existsSync(faviconPath)).toBe(true)
  })
})
