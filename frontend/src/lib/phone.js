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
 if (/[^\d\s()+.-]/.test(String(value || ''))) return String(value || '')
 const digits = String(value || '').replace(/\D/g, '')
 if (country === 'BR') {
  const national = digits
  if (national.length <= 2) return national
  const rest = national.slice(2), split = rest.length > 8 ? 5 : 4
  return `(${national.slice(0, 2)}) ${rest.slice(0, split)}${rest.length > split ? `-${rest.slice(split)}` : ''}`
 }
 return new AsYouType(country).input(digits)
}
export function normalizePhone(value, country) {
 if (!String(value || '').trim()) return null
 const phone = /^[+\d\s().-]+$/.test(value) && parsePhoneNumberFromString(value, { defaultCountry: country, extract: false })
 if (!phone || !phone.isValid() || phone.ext || phone.country !== country) throw new Error('Informe um telefone válido com código de área para o país selecionado.')
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
