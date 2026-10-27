// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CommunityPostMedia from './CommunityPostMedia.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, container
const client = { storage: { from: () => ({ getPublicUrl: path => ({ data: { publicUrl: `https://media.example/${path}` } }), download: vi.fn() }) } }
const renderPost = async (path = 'photo.jpg', storageClient = client) => {
  await act(async () => root.render(<CommunityPostMedia post={{ image_path: path, caption: 'Treino' }} client={storageClient}>{image => <article className="community-post"><header>Maria</header>{image}<button>Curtir</button></article>}</CommunityPostMedia>))
}
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

describe('community image loading', () => {
  it('keeps the post conversation available while its photo decodes', async () => {
    await renderPost('decode.jpg')
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

  it('provides a retry after both the public image and authenticated download fail', async () => {
    const download = vi.fn().mockRejectedValue(new Error('offline'))
    const storageClient = { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: 'https://media.example/error.jpg' } }), download }) } }
    await renderPost('error.jpg', storageClient)
    await act(async () => container.querySelector('img').dispatchEvent(new Event('error')))
    expect(download).toHaveBeenCalledWith('error.jpg')
    expect(container.textContent).toContain('Tentar novamente')
    expect(container.querySelector('header').textContent).toBe('Maria')
    expect(container.querySelector('[data-media-content]')).toBeNull()
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Tentar novamente').click())
    expect(container.querySelector('.community-media-error')).toBe(null)
    expect(container.querySelector('.community-media-placeholder')).not.toBe(null)
  })

  it('does not keep a previous photo visible when the path changes', async () => {
    await renderPost('old.jpg')
    const image = container.querySelector('img')
    Object.defineProperties(image, { naturalWidth: { value: 600 }, naturalHeight: { value: 800 } })
    await act(async () => image.dispatchEvent(new Event('load')))
    expect(container.querySelector('.community-media-slot').getAttribute('aria-busy')).toBe('false')
    await renderPost('new.jpg')
    expect(container.querySelector('.community-media-slot').getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('img').src).toBe('https://media.example/new.jpg')
  })
})
