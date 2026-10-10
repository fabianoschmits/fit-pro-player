// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-photo.js', async original => ({ ...await original(), createProfessionalPhotoRepository: () => mocks }))
import ProfessionalPhotoEditor from './ProfessionalPhotoEditor.jsx'
let root, container, changed
const profile = { professionalName: 'Ana', photoPath: 'owner/old.jpg' }
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.resetAllMocks(); changed = vi.fn(); container = document.createElement('div'); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()) })
const render = () => act(async () => root.render(<ProfessionalPhotoEditor userId="owner" profile={profile} onChange={changed} />))
const choose = file => act(async () => { const input = container.querySelector('input[type="file"]'); Object.defineProperty(input, 'files', { configurable: true, value: [file] }); input.dispatchEvent(new Event('change', { bubbles: true })) })
it('validates an unsupported file before calling storage', async () => {
  await render(); await choose(new File(['svg'], 'test.svg', { type: 'image/svg+xml' }))
  expect(container.querySelector('[role="alert"]').textContent).toContain('Escolha uma imagem JPG, PNG ou WebP.')
  expect(mocks.upload).not.toHaveBeenCalled()
})
it('saves the photo independently and reports the returned profile', async () => {
  mocks.upload.mockResolvedValue({ ...profile, photoPath: 'owner/new.png' }); await render()
  await choose(new File(['photo'], 'test.png', { type: 'image/png' }))
  expect(changed).toHaveBeenCalledWith(expect.objectContaining({ photoPath: 'owner/new.png' }))
  expect(container.querySelector('[role="status"]').textContent).toContain('Foto atualizada.')
})
it('ignores a late photo result after unmounting the owner workspace', async () => {
  let resolve; mocks.upload.mockReturnValue(new Promise(r => { resolve = r })); await render()
  await choose(new File(['photo'], 'test.png', { type: 'image/png' }))
  const isCurrent = mocks.upload.mock.calls[0][0].isCurrent
  await act(async () => root.unmount()); expect(isCurrent()).toBe(false)
  await act(async () => resolve({ ...profile, photoPath: 'owner/new.png' })); expect(changed).not.toHaveBeenCalled()
})
it('removes the saved photo independently', async () => {
  mocks.remove.mockResolvedValue({ ...profile, photoPath: null }); await render()
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Remover foto').click())
  expect(changed).toHaveBeenCalledWith(expect.objectContaining({ photoPath: null }))
})
it('discards an old owner operation if the editor receives another owner', async () => {
  let resolve; mocks.upload.mockReturnValue(new Promise(r => { resolve = r })); await render()
  await choose(new File(['photo'], 'test.png', { type: 'image/png' }))
  const isCurrent = mocks.upload.mock.calls[0][0].isCurrent
  await act(async () => root.render(<ProfessionalPhotoEditor userId="another-owner" profile={profile} onChange={changed} />))
  expect(isCurrent()).toBe(false)
  await act(async () => resolve({ ...profile, photoPath: 'owner/new.png' })); expect(changed).not.toHaveBeenCalled()
})
