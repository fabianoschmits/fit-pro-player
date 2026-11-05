import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/max'

export const phoneCountries = getCountries()
export { getCountryCallingCode }
export function defaultPhoneCountry(languages = globalThis.navigator?.languages || []) {
 for (const language of languages) {
  try { const region = new Intl.Locale(language).region; const country = phoneCountries.find(code => code === region); if (country) return country } catch { /* Unsupported locale: use Brazil. */ }
 }
 return 'BR'
}
export function formatPhoneInput(value, country) {
 const digits = String(value || '').replace(/\D/g, '')
 if (country === 'BR') {
  const national = digits.slice(0, 11)
  if (national.length <= 2) return national
  const rest = national.slice(2), split = rest.length > 8 ? 5 : 4
  return `(${national.slice(0, 2)}) ${rest.slice(0, split)}${rest.length > split ? `-${rest.slice(split)}` : ''}`
 }
 return new AsYouType(country).input(digits.slice(0, 15))
}
export function normalizePhone(value, country) {
 if (!String(value || '').trim()) return null
 const phone = parsePhoneNumberFromString(value, country)
 if (!phone?.isValid() || phone.ext) throw new Error('Informe um telefone válido com código de área.')
 return phone.number
}
export function phoneDraft(value) {
 const phone = value && parsePhoneNumberFromString(value)
 const country = phone?.country || defaultPhoneCountry()
 return { country, number: phone ? formatPhoneInput(phone.nationalNumber, country) : '' }
}
export function displayPhone(value) {
 const phone = value && parsePhoneNumberFromString(value)
 return phone ? `+${phone.countryCallingCode} ${phone.formatNational()}` : ''
}
export function whatsappUrl(value) {
 return /^\+[1-9]\d{7,14}$/.test(value || '') ? `https://wa.me/${value.slice(1)}` : null
}
