import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { parsePhoneNumberFromString } from 'libphonenumber-js/max'
import { defaultPhoneCountry, formatPhoneInput, getCountryCallingCode, normalizePhone, phoneCountries } from '../lib/phone.js'
import './phone-contact.css'

const flags = import.meta.glob('/node_modules/country-flag-icons/3x2/*.svg', { query: '?url', import: 'default', eager: true })
const flagUrl = country => String(flags[`/node_modules/country-flag-icons/3x2/${country}.svg`] || '')
const names = new Intl.DisplayNames(['pt-BR'], { type: 'region' })
const countries = [...phoneCountries].sort((a, b) => a === 'BR' ? -1 : b === 'BR' ? 1 : names.of(a).localeCompare(names.of(b), 'pt-BR'))

export default function PhoneField({ value, onChange, disabled = false, showErrors = false }) {
 const id = useId(), menu = useRef(null), inputRef = useRef(null)
 const [search, setSearch] = useState('')
 const [touched, setTouched] = useState(false)
 const country = value.country || defaultPhoneCountry()
 let validationError = ''
 try { normalizePhone(value.number, country) } catch (cause) { validationError = cause.message }
 const error = (touched || showErrors) ? validationError : ''
 useEffect(() => {
  inputRef.current?.setCustomValidity(validationError)
  if (showErrors && validationError) inputRef.current?.focus()
 }, [validationError, showErrors])
 const options = useMemo(() => countries.filter(code => `${names.of(code)} ${code} +${getCountryCallingCode(code)}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))), [search])
 const changeNumber = event => {
  const input = event.target.value
  if (input.trim().startsWith('+')) {
   const parsed = parsePhoneNumberFromString(input, { extract: false })
   if (/^[+\d\s().-]+$/.test(input) && parsed?.country && parsed.isValid() && !parsed.ext) { onChange({ country: parsed.country, number: formatPhoneInput(parsed.nationalNumber, parsed.country) }); return }
   onChange({ country, number: input }); return
  }
  onChange({ country, number: formatPhoneInput(input, country) })
 }
 return <div className="fpp-phone-field">
  <label htmlFor={id}>Telefone / WhatsApp <span className="muted">(opcional)</span></label>
  <div className="fpp-phone-controls">
   <details ref={menu} className="fpp-phone-country" onKeyDown={event => { if (event.key === 'Escape') menu.current.open = false }}>
    <summary aria-label={`País do telefone: ${names.of(country)}, +${getCountryCallingCode(country)}`} tabIndex={disabled ? -1 : 0} onClick={event => { if (disabled) event.preventDefault() }}>
     <img src={flagUrl(country)} alt={names.of(country)} width="24" height="16" /><span>+{getCountryCallingCode(country)}</span><span aria-hidden="true">⌄</span>
    </summary>
    <div className="fpp-phone-country-menu">
     <input className="field" aria-label="Buscar país" placeholder="Buscar país ou código" value={search} onChange={event => setSearch(event.target.value)} />
     <div className="fpp-phone-country-options">{options.map(code => <button type="button" key={code} aria-pressed={code === country} onClick={() => { onChange({ country: code, number: formatPhoneInput(value.number, code) }); menu.current.open = false; setSearch('') }}>
      <img src={flagUrl(code)} alt="" width="24" height="16" /><span>{names.of(code)}</span><span>+{getCountryCallingCode(code)}</span>
     </button>)}{!options.length && <p>Nenhum país encontrado.</p>}</div>
    </div>
   </details>
   <input ref={inputRef} id={id} className="field" aria-label="Telefone / WhatsApp (opcional)" type="tel" inputMode="tel" autoComplete="tel-national" placeholder={country === 'BR' ? '(11) 91234-5678' : 'Número com código de área'} value={value.number} onChange={changeNumber} onBlur={() => setTouched(true)} onInvalid={event => { event.preventDefault(); setTouched(true); event.currentTarget.focus() }} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} />
  </div>
  {error && <p id={`${id}-error`} className="fpp-phone-error" role="alert">{error}</p>}
  <p id={`${id}-hint`} className="fpp-phone-hint">Compartilhado apenas com seus profissionais e alunos com vínculo ativo. Não aparece na comunidade.</p>
 </div>
}
