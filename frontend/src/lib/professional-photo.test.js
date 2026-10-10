import { describe, expect, it, vi } from 'vitest'
import { createProfessionalPhotoRepository, professionalPhotoUrl, validateProfessionalPhoto } from './professional-photo.js'

const owner = '11111111-1111-4111-8111-111111111111'
const old = `${owner}/22222222-2222-4222-8222-222222222222.jpg`
function setup() {
  const storage = { upload: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })), getPublicUrl: path => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/professional-photos/${path}` } }) }
  const client = { storage: { from: vi.fn(() => storage) }, rpc: vi.fn(async (_, { p_path }) => ({ data: { user_id: owner, photo_path: p_path, professional_name: 'Ana' }, error: null })) }
  return { storage, client, repo: createProfessionalPhotoRepository({ client }) }
}
describe('professional photos', () => {
  it('allows only bounded JPEG, PNG and WebP files', () => {
    expect(() => validateProfessionalPhoto({ type: 'image/svg+xml', size: 10 })).toThrow('professional-photo-type')
    expect(() => validateProfessionalPhoto({ type: 'image/png', size: 5242881 })).toThrow('professional-photo-size')
    expect(() => validateProfessionalPhoto({ type: 'image/png', size: 0 })).toThrow('professional-photo-size')
    expect(validateProfessionalPhoto({ type: 'image/webp', size: 5242880 })).toBe('webp')
  })
  it('constructs public URLs only for bucket paths, rejecting URLs and traversal', () => {
    const { client } = setup()
    expect(professionalPhotoUrl(old, client)).toContain(`/professional-photos/${old}`)
    expect(professionalPhotoUrl(old.replace('.jpg', '.jpeg'), client)).toContain('.jpeg')
    for (const path of ['https://evil.test/photo.jpg', '../photo.jpg', `${owner}/../evil.jpg`]) expect(professionalPhotoUrl(path, client)).toBeNull()
  })
  it('uploads with a fresh owner path and saves the pointer before deleting the old object', async () => {
    const { repo, storage, client } = setup(); const events = []
    client.rpc.mockImplementation(async (_, args) => { events.push('pointer'); return { data: { photo_path: args.p_path }, error: null } })
    storage.remove.mockImplementation(async () => { events.push('delete'); return { error: null } })
    const result = await repo.upload({ userId: owner, file: { type: 'image/png', size: 10 }, previousPath: old })
    expect(result.photoPath).toMatch(new RegExp(`^${owner}/[a-f0-9-]+\\.png$`))
    expect(storage.upload).toHaveBeenCalledWith(result.photoPath, expect.any(Object), { contentType: 'image/png', upsert: false })
    expect(client.rpc).toHaveBeenCalledWith('set_professional_photo', { p_path: result.photoPath })
    expect(events).toEqual(['pointer', 'delete'])
  })
  it('cleans up the uploaded object if the pointer cannot be saved', async () => {
    const { repo, client, storage } = setup(); client.rpc.mockResolvedValue({ error: { code: '42501' } })
    await expect(repo.upload({ userId: owner, file: { type: 'image/jpeg', size: 10 }, previousPath: old })).rejects.toThrow('professional-photo-save')
    expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[0][0]])
    expect(storage.remove).not.toHaveBeenCalledWith([old])
  })
  it('stops saving and cleanup when the authenticated owner changes during upload', async () => {
    const { repo, client, storage } = setup(); let current = true
    storage.upload.mockImplementation(async () => { current = false; return { error: null } })
    await expect(repo.upload({ userId: owner, file: { type: 'image/png', size: 10 }, previousPath: old, isCurrent: () => current })).rejects.toThrow('professional-photo-stale')
    expect(client.rpc).not.toHaveBeenCalled(); expect(storage.remove).not.toHaveBeenCalled()
  })
  it('removes the pointer first and retains storage if removal fails or account changes', async () => {
    const { repo, client, storage } = setup(); client.rpc.mockResolvedValueOnce({ error: {} })
    await expect(repo.remove({ userId: owner, previousPath: old })).rejects.toThrow('professional-photo-save')
    expect(storage.remove).not.toHaveBeenCalled()
    let current = true; client.rpc.mockImplementation(async () => { current = false; return { data: { photo_path: null } } })
    await expect(repo.remove({ userId: owner, previousPath: old, isCurrent: () => current })).rejects.toThrow('professional-photo-stale')
    expect(storage.remove).not.toHaveBeenCalled()
  })
})
