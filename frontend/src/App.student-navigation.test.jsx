// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, expect, it } from 'vitest'
import { CanonicalRedirect } from './App.jsx'

let root, host
function Location() {
  const location = useLocation()
  return <output>{`${location.pathname}${location.search}${location.hash}`}</output>
}
async function render(entry, to) {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="*" element={<CanonicalRedirect to={to} />} /><Route path={to} element={<Location />} /></Routes></MemoryRouter>))
}
afterEach(() => { root?.unmount(); host?.remove() })

it.each([
  ['/stats?range=30#volume', '/progress', '/progress?range=30#volume'],
  ['/history?from=home', '/progress/history', '/progress/history?from=home'],
  ['/body-progress', '/progress/body', '/progress/body'],
  ['/more', '/account', '/account'],
])('redirects %s to its canonical route without losing URL context', async (entry, to, expected) => {
  await render(entry, to)
  expect(host.querySelector('output')?.textContent).toBe(expected)
})
