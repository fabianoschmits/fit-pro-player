import { describe, it, expect, vi } from 'vitest'
import { createProgressPhotoRepository } from './progress-photo-repository.js'

const owner = '11111111-1111-4111-8111-111111111111'
const photo = { id: '22222222-2222-4222-8222-222222222222', user_id: owner, storage_path: `${owner}/22222222-2222-4222-8222-222222222222/original.webp` }
function setup() {
  const session = { user: { id: owner, is_anonymous: false } }
  const store = { upload: vi.fn().mockResolvedValue({ data: {}, error: null }), remove: vi.fn().mockResolvedValue({ data: {}, error: null }), createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://private.test/photo' }, error: null }) }
  const insert = vi.fn().mockResolvedValue({ error: null })
  const finalize = vi.fn().mockResolvedValue({ data: { id: photo.id }, error: null })
  const updateQuery = { eq: () => updateQuery, select: () => updateQuery, single: finalize }
  const range = vi.fn().mockResolvedValue({ data: [], error: null })
  const listQuery = { eq: () => listQuery, order: () => listQuery, range }
  const client = { auth: { getSession: vi.fn(async () => ({ data: { session }, error: null })) }, storage: { from: () => store }, from: vi.fn(() => ({ insert, update: () => updateQuery, select: () => listQuery })), functions: { invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }) } }
  const repo = createProgressPhotoRepository(owner, client)
  return { repo, client, store, session, insert, finalize, range }
}
const processed = { blob: new Blob(['test']), width: 900, height: 1600, mime_type: 'image/webp', file_size: 4 }

describe('repositório fotográfico isolado', () => {
  it('deduplica consultas e pagina sem limitar o histórico ao teto padrão do servidor', async () => {
    const { repo, range } = setup()
    range.mockResolvedValueOnce({ data: Array.from({ length: 200 }, (_, id) => ({ id })), error: null }).mockResolvedValueOnce({ data: [{ id: 200 }], error: null })
    const [first, second] = await Promise.all([repo.list(), repo.list()])
    expect(first.length).toBe(201)
    expect(first).toBe(second)
    expect(range.mock.calls).toEqual([[0, 199], [200, 399]])
  })
  it('deduplica URLs temporárias e rejeita arquivos de outra conta', async () => {
    const { repo, store } = setup()
    await Promise.all([repo.url(photo), repo.url(photo)])
    await repo.url(photo)
    expect(store.createSignedUrl).toHaveBeenCalledTimes(1)
    await expect(repo.url({ ...photo, user_id: 'other' })).rejects.toThrow()
    repo.dispose()
    await expect(repo.url(photo)).rejects.toThrow()
  })
  it('compensa reserva e upload quando a finalização falha', async () => {
    const { repo, store, client, finalize } = setup()
    finalize.mockResolvedValue({ error: new Error('database failure') })
    await expect(repo.upload(processed, { date: '2026-01-01', angle: 'front', automatic: null })).rejects.toThrow()
    expect(client.functions.invoke).toHaveBeenCalledWith('body-progress-photo-cleanup', expect.objectContaining({ body: expect.objectContaining({ action: 'photo' }) }))
    expect(store.upload.mock.calls[0][0]).toMatch(new RegExp(`^${owner}/.+/original.webp$`))
  })
  it('não associa upload à nova conta após troca de usuário', async () => {
    const { repo, store, session, insert } = setup()
    store.upload.mockImplementation(async () => { session.user.id = 'new-owner'; return { data: {}, error: null } })
    await expect(repo.upload(processed, { date: '2026-01-01', angle: 'front', automatic: null })).rejects.toThrow()
    expect(insert).toHaveBeenCalledTimes(1)
    expect(store.remove).not.toHaveBeenCalled()
  })
  it('nunca apaga o objeto de um registro confirmado após troca de conta', async () => {
    const { repo, store, session, finalize } = setup()
    finalize.mockImplementation(async () => { session.user.id = 'new-owner'; return { data: { id: photo.id }, error: null } })
    await expect(repo.upload(processed, { date: '2026-01-01', angle: 'front', automatic: null })).rejects.toThrow()
    expect(store.remove).not.toHaveBeenCalled()
  })
})
