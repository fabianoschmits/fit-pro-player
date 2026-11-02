// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CommunityPostMedia from './CommunityPostMedia.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, container
const client = { storage: { from: () => ({ getPublicUrl: path => ({ data: { publicUrl: `https://media.example/${path}` } }), download: vi.fn() }) } }
const renderPost = async (path = 'https://media.example/photo.jpg', storageClient = client) => {
  await act(async () => root.render(<CommunityPostMedia post={{ image_path: path, caption: 'Treino' }} client={storageClient}>{image => <article className="community-post"><header>Maria</header>{image}<button>Curtir</button></article>}</CommunityPostMedia>))
}
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

describe('community image loading', () => {
  it('downloads legacy public paths privately and revokes object URLs on replacement and unmount', async () => {
    const download = vi.fn().mockResolvedValue({ data: new Blob(['photo']), error: null })
    const getPublicUrl = vi.fn(), createSignedUrl = vi.fn()
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:private-one').mockReturnValueOnce('blob:private-two')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const storage = { storage: { from: vi.fn().mockReturnValue({ download, getPublicUrl, createSignedUrl }) } }
    await renderPost('https://test.supabase.co/storage/v1/object/public/community-posts/user%2Fone.jpg', storage)
    expect(download).toHaveBeenLastCalledWith('user/one.jpg')
    expect(storage.storage.from).toHaveBeenCalledWith('community-posts')
    expect(container.querySelector('img').src).toBe('blob:private-one')
    await renderPost('user/two.jpg', storage)
    expect(revoke).toHaveBeenCalledWith('blob:private-one')
    expect(container.querySelector('img').src).toBe('blob:private-two')
    await act(async () => root.render(null))
    expect(revoke).toHaveBeenCalledWith('blob:private-two')
    expect(getPublicUrl).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('does not publish a private download completed after switching posts', async () => {
    let finish
    const download = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce({ data: new Blob(['new']), error: null })
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:new-private')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const storage = { storage: { from: () => ({ download }) } }
    await renderPost('late/old.jpg', storage)
    await renderPost('late/new.jpg', storage)
    await act(async () => finish({ data: new Blob(['old']), error: null }))
    expect(create).toHaveBeenCalledTimes(1)
    expect(container.querySelector('img').src).toBe('blob:new-private')
  })
  it('keeps the post conversation available while its photo decodes', async () => {
    await renderPost('https://media.example/decode.jpg')
    const image = container.querySelector('img')
    let finishDecode
    image.decode = () => new Promise(resolve => { finishDecode = resolve })
    Object.defineProperties(image, { naturalWidth: { value: 800 }, naturalHeight: { value: 600 } })
    expect(container.querySelector('header').textContent).toBe('Maria')
    expect(container.querySelector('button').textContent).toBe('Curtir')
    expect(container.querySelector('[data-media-content]')).toBeNull()
    await act(async () => image.dispatchEvent(new Event('load')))
    expect(container.querySelector('header').textContent).toBe('Maria')
    await act(async () => finishDecode())
    expect(container.querySelector('.community-media-slot').getAttribute('aria-busy')).toBe('false')
    expect(image.dataset.orientation).toBe('landscape')
    expect(container.querySelector('.community-media-placeholder')).toBe(null)
  })

  it('provides a retry after an authenticated private download fails', async () => {
    const download = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(()=>new Promise(()=>{}))
    const storageClient = { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://media.example/error.jpg' } }), download }) } }
    await renderPost('error.jpg', storageClient)
    expect(container.querySelector('img')).toBeNull()
    expect(download).toHaveBeenCalledWith('error.jpg')
    expect(container.textContent).toContain('Tentar novamente')
    expect(container.querySelector('header').textContent).toBe('Maria')
    expect(container.querySelector('[data-media-content]')).toBeNull()
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Tentar novamente').click())
    expect(container.querySelector('.community-media-error')).toBe(null)
    expect(container.querySelector('.community-media-placeholder')).not.toBe(null)
  })

  it('does not keep a previous photo visible when the path changes', async () => {
    await renderPost('https://media.example/old.jpg')
    const image = container.querySelector('img')
    Object.defineProperties(image, { naturalWidth: { value: 600 }, naturalHeight: { value: 800 } })
    await act(async () => image.dispatchEvent(new Event('load')))
    expect(container.querySelector('.community-media-slot').getAttribute('aria-busy')).toBe('false')
    await renderPost('https://media.example/new.jpg')
    expect(container.querySelector('.community-media-slot').getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('img').src).toBe('https://media.example/new.jpg')
  })
})
