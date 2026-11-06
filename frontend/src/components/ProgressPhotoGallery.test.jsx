// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ProgressPhotoGallery from './ProgressPhotoGallery.jsx'

const mocks = vi.hoisted(() => ({ rows: [], list: vi.fn(), url: vi.fn(), user: { id: 'owner' }, body: 'male' }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: { body: mocks.body } }) }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('./AuthSheet.jsx', () => ({ openAuthSheet: vi.fn() }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: vi.fn() }))
vi.mock('../lib/progress-photo-repository.js', () => ({
  PHOTO_ANGLES: [{ value: 'front', label: 'Frente' }, { value: 'back', label: 'Costas' }],
  createProgressPhotoRepository: () => ({ list: mocks.list, url: mocks.url, dispose: vi.fn() }),
}))
vi.mock('./ProgressPhotoCompare.jsx', () => ({ default: ({ controls, children }) => <div data-comparator data-controls={controls}>{children}</div> }))
vi.mock('./ProgressPhotoUpload.jsx', () => ({ default: () => <div data-upload-form /> }))
vi.mock('./ui.jsx', () => ({ Button: ({ children, variant: _variant, ...props }) => <button {...props}>{children}</button> }))
let container, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.user = { id: 'owner' }; mocks.body = 'male'
  mocks.rows = [1, 2].map(id => ({ id: String(id), user_id: 'owner', photo_date: `2026-01-0${id}`, angle: 'front', width: 900, height: 1600 }))
  mocks.list.mockImplementation(async () => mocks.rows)
  mocks.url.mockReset().mockResolvedValue('/photo.webp')
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})

it('mostra o exemplo masculino sem inserir fotografias no histórico vazio', async () => {
  mocks.rows = []
  await render('preview')
  expect(container.textContent).toContain('Demonstração · modelo masculino')
  expect(container.querySelector('[data-comparator]')).toBeTruthy()
  expect(mocks.url).not.toHaveBeenCalled()
  expect(container.querySelector('.bp-photo-record')).toBeNull()
})

it('acompanha a preferência de silhueta feminina mesmo com conta vazia', async () => {
  mocks.rows = []; mocks.body = 'female'
  await render('editor')
  expect(container.textContent).toContain('Demonstração · modelo feminino')
  expect(container.textContent).toContain('Adicionar foto')
  expect(container.textContent).toContain('0 fotos')
  mocks.body = 'male'
  await render('editor')
  expect(container.textContent).toContain('Demonstração · modelo masculino')
})

it('exibe o exemplo para visitantes sem acessar fotografias privadas', async () => {
  mocks.user = null; mocks.body = 'female'
  mocks.list.mockClear()
  await render('preview')
  expect(container.textContent).toContain('Demonstração · modelo feminino')
  expect(mocks.list).not.toHaveBeenCalled()
  expect(mocks.url).not.toHaveBeenCalled()
})

it('uma fotografia pessoal substitui o exemplo sem misturar os modelos', async () => {
  mocks.rows = mocks.rows.slice(0, 1)
  await render('preview')
  expect(container.textContent).not.toContain('Demonstração')
  expect(container.querySelector('.bp-photo-single img')).toBeTruthy()
})

it('aguarda o histórico antes de permitir adicionar para não perder o formulário ao abrir o exemplo', async () => {
  let finish
  mocks.list.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await render('editor')
  const add = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Adicionar foto')
  expect(add().disabled).toBe(true)
  await act(async () => { finish([]) })
  await act(async () => { await vi.dynamicImportSettled() })
  expect(container.textContent).toContain('Demonstração · modelo masculino')
  expect(add().disabled).toBe(false)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = async mode => {
  await act(async () => { root.render(<ProgressPhotoGallery mode={mode} />) })
  await act(async () => { await vi.dynamicImportSettled() })
}

it('mostra somente o demonstrador no modo de apresentação', async () => {
  await render('preview')
  expect(container.querySelector('[data-comparator]')?.getAttribute('data-controls')).toBe('false')
  expect(container.querySelector('select,input,details,.bp-photo-history')).toBeNull()
  expect(container.textContent).not.toContain('Adicionar foto')
  expect(mocks.url).toHaveBeenCalledTimes(2)
})

it('prioriza comparador, adicionar foto e campos recolhidos no editor', async () => {
  await render('editor')
  const comparator = container.querySelector('[data-comparator]')
  const add = [...container.querySelectorAll('button')].find(button => button.textContent === 'Adicionar foto')
  const angle = [...container.querySelectorAll('details')].find(details => details.querySelector('summary')?.textContent.includes('Ângulo'))
  expect(comparator).not.toBeNull()
  expect(add).toBeTruthy()
  expect(angle).toBeTruthy()
  expect(angle.hasAttribute('open')).toBe(false)
  expect(add.compareDocumentPosition(angle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(container.querySelector('details.bp-photo-history-disclosure')?.hasAttribute('open')).toBe(false)
  expect(container.textContent).not.toMatch(/Check-in desta semana|Check-ins anteriores/)
})

it('preserva o formulário aberto ao impedir exclusões enquanto adiciona uma foto', async () => {
  await render('editor')
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Adicionar foto').click())
  const history = container.querySelector('.bp-photo-history-disclosure')
  await act(async () => { history.open = true; history.dispatchEvent(new Event('toggle')) })
  expect(container.querySelector('[data-upload-form]')).toBeTruthy()
  const remove = [...container.querySelectorAll('button')].filter(button => button.textContent === 'Excluir')
  expect(remove.length).toBe(2)
  expect(remove.every(button => button.disabled)).toBe(true)
})
