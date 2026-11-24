import { expect, it } from 'vitest'
import { weeklyProgressLocale } from '../weekly-progress-locales.js'
it.each(['pt', 'de', 'es', 'fr', 'it', 'pl', 'tr', 'ru', 'zh', 'ko', 'hi'])('provides complete weekly translations and interpolation for %s', language => {
  const source = weeklyProgressLocale('en'), translated = weeklyProgressLocale(language)
  expect(Object.keys(translated)).toEqual(Object.keys(source))
  for (const [key, value] of Object.entries(translated)) {
    expect(value.trim(), key).not.toBe('')
    expect(value, key).not.toBe(key)
    expect((value.match(/\{\d+\}/g) || []).sort(), key).toEqual((key.match(/\{\d+\}/g) || []).sort())
  }
})
