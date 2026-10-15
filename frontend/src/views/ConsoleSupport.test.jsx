import { describe, expect, it } from 'vitest'
import { supportStatusLabel } from './Console.jsx'

describe('console support labels', () => {
  it('presents every support workflow status in Portuguese', () => {
    expect(Object.keys(supportStatusLabel)).toEqual(['unread', 'read', 'pending', 'answered', 'resolved', 'archived'])
    expect(supportStatusLabel.pending).toBe('Pendente')
    expect(supportStatusLabel.archived).toBe('Arquivada')
  })
})
