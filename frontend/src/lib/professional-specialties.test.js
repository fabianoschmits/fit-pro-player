import { describe, expect, it } from 'vitest'
import { combineProfessionalSpecialties, describeSpecialty, splitProfessionalSpecialties, teachingSpecialty } from './professional-specialties.js'

describe('professional specialties', () => {
  it('splits catalog practice, teaching, and typed values', () => {
    expect(splitProfessionalSpecialties(['Força', 'lecionar pilates', 'treino indoor', 'força'])).toEqual({
      practice: ['força'],
      teaching: ['pilates'],
      custom: ['treino indoor'],
    })
  })

  it('combines selected groups without duplicates', () => {
    expect(combineProfessionalSpecialties({
      practice: ['força', 'Força'],
      teaching: ['pilates'],
      custom: ['Treino indoor', ''],
    })).toEqual(['força', teachingSpecialty('pilates'), 'treino indoor'])
  })

  it('labels catalog practice and teaching specialties for display', () => {
    expect(describeSpecialty('força')).toEqual({ kind: 'practice', label: 'Força' })
    expect(describeSpecialty('lecionar pilates')).toEqual({ kind: 'teaching', label: 'Pilates' })
    expect(describeSpecialty('treino indoor')).toEqual({ kind: 'practice', label: 'treino indoor' })
  })
})
