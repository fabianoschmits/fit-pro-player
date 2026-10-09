// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import CompactList from './CompactList.jsx'
import Skeleton from './Skeleton.jsx'
let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = child => act(async () => root.render(child))
it('replaces the initial skeleton with real rows and retains them during refresh', async () => {
  await render(<CompactList status="loading" empty={<p>Sem alunos</p>} />)
  expect(container.querySelector('[role="status"]').getAttribute('aria-label')).toBe('Carregando…')
  expect(container.textContent).not.toContain('Sem alunos')
  await render(<CompactList status="success"><li>Ana Silva</li></CompactList>)
  expect(container.querySelector('.professional-skeleton')).toBeNull()
  await render(<CompactList status="refreshing"><li>Ana Silva</li></CompactList>)
  expect(container.querySelector('ul').textContent).toBe('Ana Silva')
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  expect(container.querySelector('.professional-skeleton')).toBeNull()
})
it('exposes all loading variants with hidden shapes and no fabricated content', async () => {
  for (const variant of ['rows', 'summary', 'detail']) {
    await render(<Skeleton variant={variant} />)
    expect(container.querySelector('[role="status"][aria-busy="true"]')).not.toBeNull()
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(container.textContent).toBe('')
  }
})
it('shows empty only when settled and disables pagination while a page loads', async () => {
  await render(<CompactList status="success" empty={<p>Sem alunos</p>} />)
  expect(container.textContent).toBe('Sem alunos')
  const load = vi.fn()
  await render(<CompactList status="success" hasMore onLoadMore={load}><li>Ana</li></CompactList>)
  await act(async () => container.querySelector('button').click())
  expect(load).toHaveBeenCalledOnce()
  await render(<CompactList status="loading_more" hasMore onLoadMore={load}><li>Ana</li></CompactList>)
  expect(container.querySelector('button').disabled).toBe(true)
  expect(container.querySelector('li').textContent).toBe('Ana')
})
