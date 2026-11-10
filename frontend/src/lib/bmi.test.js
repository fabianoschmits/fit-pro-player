import { describe, expect, it } from 'vitest'
import { BMI_CATEGORIES, calculateBmi, getBmiDetails } from './bmi.js'

describe('BMI / IMC calculations and classifications', () => {
  it('calculates BMI accurately given weight in kg and height in cm', () => {
    // 70 kg, 175 cm -> 70 / (1.75 * 1.75) = 22.857... -> 22.9
    expect(calculateBmi(70, 175)).toBe(22.9)
    // 80 kg, 176 cm -> 80 / (1.76 * 1.76) = 25.826... -> 25.8
    expect(calculateBmi(80, 176)).toBe(25.8)
    // Invalid inputs
    expect(calculateBmi(null, 175)).toBeNull()
    expect(calculateBmi(70, null)).toBeNull()
    expect(calculateBmi(0, 175)).toBeNull()
    expect(calculateBmi(70, 0)).toBeNull()
  })

  it('categorizes healthy normal BMI appropriately', () => {
    const details = getBmiDetails(22.9, 175)
    expect(details.label).toBe('Peso saudável')
    expect(details.color).toBe('#34c759')
    expect(details.status).toBe('great')
    expect(details.idealWeightMin).toBe(56.7)
    expect(details.idealWeightMax).toBe(76.3)
  })

  it('categorizes overweight and obesity categories correctly', () => {
    const overweight = getBmiDetails(26.5, 175)
    expect(overweight.label).toBe('Sobrepeso')
    expect(overweight.status).toBe('caution')

    const obesity1 = getBmiDetails(31.2, 170)
    expect(obesity1.label).toBe('Obesidade Grau I')

    const obesity3 = getBmiDetails(42.0, 170)
    expect(obesity3.label).toBe('Obesidade Grau III')
  })

  it('categorizes underweight correctly', () => {
    const under = getBmiDetails(17.5, 175)
    expect(under.label).toBe('Abaixo do peso (Leve)')
  })
})
