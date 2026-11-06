import { describe, it, expect } from 'vitest'
import { defaultPhoneCountry, formatPhoneInput, normalizePhone, whatsappUrl } from './phone.js'
describe('optional international phone', () => {
 it('detects Brazil from device region and supports manual international numbers', () => {
  expect(defaultPhoneCountry(['pt-BR'])).toBe('BR')
  expect(defaultPhoneCountry(['en-US'])).toBe('US')
  expect(defaultPhoneCountry(['pt'])).toBe('BR')
  expect(normalizePhone('(11) 91234-5678', 'BR')).toBe('+5511912345678')
  expect(normalizePhone('2025550123', 'US')).toBe('+12025550123')
 })
 it('formats without using the account owner number and rejects incomplete input', () => {
  expect(formatPhoneInput('11912345678', 'BR')).toBe('(11) 91234-5678')
  expect(normalizePhone('', 'BR')).toBeNull()
  expect(() => normalizePhone('11912', 'BR')).toThrow()
  expect(whatsappUrl('+5511912345678')).toBe('https://wa.me/5511912345678')
  expect(whatsappUrl('javascript:alert(1)')).toBeNull()
 })
 it('does not silently truncate extra digits into a valid phone', () => {
  const formatted = formatPhoneInput('119123456789', 'BR')
  expect(formatted.replace(/\D/g, '')).toBe('119123456789')
  expect(() => normalizePhone(formatted, 'BR')).toThrow()
  expect(formatPhoneInput('2025550123456789', 'US').replace(/\D/g, '')).toBe('2025550123456789')
 })
 it.each(['00123456789', '11111111111', '1191234', '119123456789', 'abc (11) 91234-5678', '(11) 91234-5678 ramal 2'])(
  'rejects invalid Brazilian input %s', value => { expect(() => normalizePhone(value, 'BR')).toThrow() },
 )
 it('rejects international numbers for a different selected country and preserves invalid text', () => {
  expect(() => normalizePhone('+12025550123', 'BR')).toThrow()
  expect(formatPhoneInput('abc11912345678', 'BR')).toBe('abc11912345678')
 })
})
