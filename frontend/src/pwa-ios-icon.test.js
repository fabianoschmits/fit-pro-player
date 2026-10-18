// @vitest-environment node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'
import { createServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const frontendRoot = fileURLToPath(new URL('../', import.meta.url))
const appleIcon = readFileSync(new URL('../public/apple-touch-icon.png', import.meta.url))

describe('native iOS installation icon', () => {
  let server
  let document

  beforeAll(async () => {
    server = await createServer({
      configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
      root: frontendRoot,
      logLevel: 'silent',
      server: { middlewareMode: true, watch: null, hmr: false },
    })
    const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    const html = await server.transformIndexHtml('/', source)
    document = parseHTML(html).document
  })

  afterAll(async () => {
    await server?.close()
  })

  it('embeds the preferred Apple icon and keeps the same PNG as a URL fallback', () => {
    const preferred = document.head.querySelector('link[rel="apple-touch-icon-precomposed"]')
    expect(preferred).not.toBeNull()
    expect(preferred.getAttribute('sizes')).toBe('180x180')
    const inlineHref = preferred.getAttribute('href')
    expect(inlineHref).toMatch(/^data:image\/png;base64,/)

    const embedded = Buffer.from(inlineHref.slice('data:image/png;base64,'.length), 'base64')
    expect(embedded).toEqual(appleIcon)
    expect(embedded.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect([embedded.readUInt32BE(16), embedded.readUInt32BE(20)]).toEqual([180, 180])
    expect(embedded[25]).toBe(2) // PNG color type 2: RGB without alpha.

    const fallback = document.head.querySelector('link[rel="apple-touch-icon"]')
    expect(fallback).not.toBeNull()
    expect(fallback.getAttribute('sizes')).toBe('180x180')
    const fallbackUrl = new URL(fallback.getAttribute('href'), 'https://fitpp.com.br/')
    expect(fallbackUrl.origin).toBe('https://fitpp.com.br')
    const fallbackBytes = readFileSync(new URL(`../public${fallbackUrl.pathname}`, import.meta.url))
    expect(fallbackBytes).toEqual(appleIcon)

    const networkPrecomposed = [...document.head.querySelectorAll('link[rel="apple-touch-icon-precomposed"]')]
      .filter(icon => !icon.getAttribute('href').startsWith('data:image/png;base64,'))
    expect(networkPrecomposed).toHaveLength(0)
  })
})
