import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveLocalScope } from './local-state-scope.js'

const readFile = vi.fn()
const writeFile = vi.fn()
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { readFile, writeFile }, Directory: { Data: 'DATA' }, Encoding: { UTF8: 'utf8' } }))

import { nativeLoad, nativeSave } from './mobile.js'

describe('Capacitor cache isolation', () => {
  beforeEach(() => { readFile.mockReset(); writeFile.mockReset(); readFile.mockResolvedValue({ data: '{}' }); writeFile.mockResolvedValue({}) })

  it('reads an account-specific private file', async () => {
    await nativeLoad(resolveLocalScope('72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2'))
    expect(readFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'fitproplayer-account-v1-72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2.json' }))
  })

  it('writes anonymous data to the compatibility file', async () => {
    await nativeSave(resolveLocalScope(null), { workouts: [] })
    expect(writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'fitproplayer-state.json' }))
  })
})
