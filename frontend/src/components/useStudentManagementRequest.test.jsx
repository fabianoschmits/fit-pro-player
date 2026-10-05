// @vitest-environment happy-dom
import React, { act, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: 's1' } }) }))
import useStudentManagementRequest from './useStudentManagementRequest.js'
let root, container
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
it('keeps a newer retry loading when the previous request completes', async () => {
  let first, second
  const load = vi.fn().mockReturnValueOnce(new Promise(r => { first = r })).mockReturnValueOnce(new Promise(r => { second = r }))
  function Workspace() { const request = useStudentManagementRequest(useCallback(load, []), 'Failed'); return <><button onClick={request.refresh}>Retry</button><p>{request.busy ? 'Loading' : request.data}</p></> }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<Workspace />)); await act(async () => container.querySelector('button').click()); await act(async () => first('Stale data'))
  expect(container.textContent).toContain('Loading'); expect(container.textContent).not.toContain('Stale data')
  await act(async () => second('Current data')); expect(container.textContent).toContain('Current data')
})
