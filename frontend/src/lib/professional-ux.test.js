import { describe, expect, it } from 'vitest'
import { FILTERS, filterStudents, inviteLink, normalizeInviteCode, statusLabel, studentStats, withTimeout } from './professional-ux.js'

describe('professional UX contracts', () => {
  it('normalizes invite codes and creates the same deep link for every share action', () => {
    expect(normalizeInviteCode(' ab12 - cd34 ')).toBe('AB12CD34')
    expect(inviteLink('https://app.example', ' ab12cd34 ')).toBe('https://app.example/#/invite/AB12CD34')
  })

  it('filters students by active program without inventing data', () => {
    const students = [{ studentUserId: 'a', displayName: 'Ana', programTitle: 'Força' }, { studentUserId: 'b', displayName: 'Bruno', programTitle: null }]
    expect(filterStudents(students, '', FILTERS.ALL)).toHaveLength(2)
    expect(filterStudents(students, 'brun', FILTERS.WITHOUT_PROGRAM)).toEqual([students[1]])
    expect(filterStudents(students, 'ana', FILTERS.WITH_PROGRAM)).toEqual([students[0]])
  })

  it('summarizes a client and presents domain status labels', () => {
    expect(studentStats({ programTitle: 'Força', lastExecutionStatus: 'completed', lastExecutionAt: '2026-09-24T10:00:00Z' })).toMatchObject({ hasProgram: true, lastStatus: 'completed' })
    expect(statusLabel('active')).toBe('Ativo')
    expect(statusLabel('revoked')).toBe('Revogado')
  })

  it('fails a stuck workspace request instead of leaving the page loading forever', async () => {
    await expect(withTimeout(new Promise(() => {}), 1)).rejects.toThrow('request-timeout')
  })
})
