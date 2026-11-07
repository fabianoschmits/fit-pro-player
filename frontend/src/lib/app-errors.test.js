import { describe, expect, it } from 'vitest'
import { appErrorMessage, classifyAppError, serviceError } from './app-errors.js'

describe('project error messages', () => {
  it.each([
    [{ code: 'network_error' }, 'offline'],
    [new TypeError('Failed to fetch https://private.supabase.co'), 'offline'],
    [new Error('request-timeout'), 'timeout'],
    [{ status: 401 }, 'session'],
    [{ code: '42501' }, 'forbidden'],
    [{ code: '40001' }, 'conflict'],
    [{ code: '23505' }, 'duplicate'],
    [{ code: '22023' }, 'invalid'],
    [{ status: 429 }, 'rate_limit'],
    [{ status: 413 }, 'file_size'],
    [new Error('supabase-unavailable'), 'unavailable'],
    [{ status: 503 }, 'unavailable'],
  ])('classifies %j without showing infrastructure details', (error, kind) => {
    expect(classifyAppError(error)).toBe(kind)
    expect(appErrorMessage(error)).not.toMatch(/supabase|https?:|42501|40001|SQL/i)
  })

  it('never displays arbitrary server or thrown content, including when it looks friendly', () => {
    const fallback = 'Não foi possível carregar a ajuda. Tente novamente.'
    for (const error of [new Error('Supabase: relation private_profiles does not exist'), { message: 'Falha na tabela interna Supabase' }, 'Bearer secret-token', null]) {
      expect(appErrorMessage(error, fallback)).toBe(fallback)
    }
  })

  it('preserves a specific local image validation through an explicit allowlist', () => {
    expect(appErrorMessage(new Error('Escolha uma imagem de até 20 MB.'))).toBe('Escolha uma imagem de até 20 MB.')
  })

  it('has distinct actionable copy for each known situation', () => {
    expect(appErrorMessage({status:401})).toMatch(/sessão.*entre/i)
    expect(appErrorMessage({status:403})).toMatch(/permissão/i)
    expect(appErrorMessage({code:'40001'})).toMatch(/outra sessão/i)
    expect(appErrorMessage({status:429})).toMatch(/aguarde/i)
    expect(appErrorMessage(new Error('request-timeout'))).toMatch(/demorou/i)
  })

  it('preserves transport metadata and prioritizes a specific duplicate code over HTTP conflict', () => {
    const cause = { code: '23505', message: 'private constraint detail' }
    const error = serviceError(cause, 409)
    expect(error).toMatchObject({ code: '23505', status: 409, cause })
    expect(classifyAppError(error)).toBe('duplicate')
    expect(appErrorMessage(error)).toMatch(/já existe/i)
  })
})
