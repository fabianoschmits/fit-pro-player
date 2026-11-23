import { describe, expect, it } from 'vitest'
import { trainingComparisonEnglish, trainingComparisonLocale } from './training-comparison-locales.js'

const translatedLanguages = ['es', 'de', 'fr', 'it', 'pl', 'tr', 'ru', 'zh', 'ko', 'hi']
const placeholders = value => (value.match(/\{\d+\}/g) || []).sort()

describe('training comparison translations', () => {
  it('uses the Portuguese source copy for Portuguese', () => {
    const portuguese = trainingComparisonLocale('pt')
    expect(Object.keys(portuguese).sort()).toEqual(Object.keys(trainingComparisonEnglish).sort())
    for (const [source, value] of Object.entries(portuguese)) expect(value).toBe(source)
  })

  it.each(translatedLanguages)('provides complete, nonempty translated copy and matching placeholders for %s', lang => {
    const translated = trainingComparisonLocale(lang)
    expect(Object.keys(translated).sort()).toEqual(Object.keys(trainingComparisonEnglish).sort())
    for (const [source, english] of Object.entries(trainingComparisonEnglish)) {
      const value = translated[source]
      expect(value, `${lang}: ${source}`).toBeTypeOf('string')
      expect(value.trim(), `${lang}: ${source}`).not.toBe('')
      expect(placeholders(value), `${lang}: ${source}`).toEqual(placeholders(source))
      if (source !== 'Original') expect(value, `${lang}: ${source}`).not.toBe(english)
    }
    expect(translated['FPP Flex aplicado']).toContain('FPP Flex')
  })

  it.each(['en', 'unknown', 'constructor', '__proto__', 'toString', undefined])('falls back to English for %s', lang => {
    expect(trainingComparisonLocale(lang)).toEqual(trainingComparisonEnglish)
  })

  it.each(['pt', ...translatedLanguages])('keeps comparison translations intact in the complete %s locale pack', async lang => {
    const { default: pack } = await import(`../locales/${lang}.js`)
    for (const [source, translation] of Object.entries(trainingComparisonLocale(lang))) {
      expect(pack[source], `${lang}: ${source}`).toBe(translation)
    }
  })

  it('does not let a caller mutate later locale results', () => {
    const translated = trainingComparisonLocale('es')
    translated['Ver comparativo'] = 'changed'
    expect(trainingComparisonLocale('es')['Ver comparativo']).not.toBe('changed')
  })
})
