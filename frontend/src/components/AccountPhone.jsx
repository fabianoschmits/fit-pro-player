import { appErrorMessage } from '../lib/app-errors.js'
import { useEffect, useState } from 'react'
import useRelationshipRefresh from './useRelationshipRefresh.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { displayPhone, normalizePhone, phoneDraft, whatsappUrl } from '../lib/phone.js'
import PhoneField from './PhoneField.jsx'
import { Button } from './ui.jsx'

export default function AccountPhone({ userId = undefined, editable = false, iconOnly = false, contactLabel = '' }) {
 const auth = useAuth(), caller = auth.user?.id, target = userId || caller
 return <ScopedPhone key={`${caller}:${target}`} caller={caller} target={target} iconOnly={iconOnly} contactLabel={contactLabel} editable={editable && target === caller} />
}
function ScopedPhone({ caller, target, editable, iconOnly, contactLabel }) {
 const [phone, setPhone] = useState(null), [draft, setDraft] = useState(() => phoneDraft(null))
 const [state, setState] = useState('loading'), [error, setError] = useState('')
 const [revision, setRevision] = useState(0)
 const [phoneValidationAttempted, setPhoneValidationAttempted] = useState(false)
 useRelationshipRefresh(() => { if (!editable) { setState('loading'); setPhone(null); setRevision(value => value + 1) } })
 useEffect(() => {
  let alive = true
  const client = getBrowserSupabaseClient()
  if (!caller || !target || typeof client?.rpc !== 'function') { setState('unavailable'); return }
  client.rpc('account_contact_phone', { p_user_id: target }).then(({ data, error: cause }) => {
   if (!alive) return
   if (cause) { setState('error'); setError('Não foi possível carregar o telefone.'); return }
   setPhone(typeof data === 'string' ? data : null); setDraft(phoneDraft(typeof data === 'string' ? data : null)); setState('ready')
  }).catch((failure) => { if (alive) { setState('error'); setError(appErrorMessage(failure, 'Não foi possível carregar o telefone.')) } })
  const visible = () => { if (!editable && document.visibilityState === 'visible') { setState('loading'); setPhone(null); setRevision(value => value + 1) } }
  document.addEventListener('visibilitychange', visible)
  return () => { alive = false; document.removeEventListener('visibilitychange', visible) }
 }, [caller, target, editable, revision])
 const save = async () => {
  setError('')
  setPhoneValidationAttempted(true)
  const next = normalizePhone(draft.number, draft.country)
  try {
   const client = getBrowserSupabaseClient()
   if (!client) throw new Error('Não foi possível salvar o telefone.')
   const { error: cause } = await client.rpc('save_account_phone', { p_phone: next })
   if (cause) throw new Error('Não foi possível salvar o telefone. Tente novamente.')
   setPhone(next)
  } catch (cause) { setError(appErrorMessage(cause)); throw cause }
 }
 if (editable) return <section className="fpp-account-phone" aria-label="Contato da conta">
  <details className="fpp-account-phone-details">
  <summary>Telefone / WhatsApp</summary>
  <div className="fpp-account-phone-editor">
  {state === 'loading' ? <p role="status">Carregando telefone…</p> : state === 'ready' ? <><PhoneField value={draft} onChange={setDraft} showErrors={phoneValidationAttempted} /><Button onAction={save} successLabel="Telefone salvo">Salvar telefone</Button><p className="fpp-phone-hint">Para remover o contato, deixe o campo vazio e salve.</p></> : null}
  {error && <p role="alert">{error}</p>}
  {state === 'error' && <Button onClick={() => { setError(''); setState('loading'); setRevision(value => value + 1) }}>Tentar carregar telefone novamente</Button>}
  </div>
  </details>
 </section>
 const url = whatsappUrl(phone)
 if (!url || state !== 'ready') return null
 return <div className={`fpp-whatsapp-contact${iconOnly ? ' is-icon-only' : ''}${contactLabel ? ' has-contact-label' : ''}`}><a className={iconOnly ? 'fpp-whatsapp-icon' : 'management-button'} title="Conversar pelo WhatsApp" href={url} target="_blank" rel="noopener noreferrer" aria-label="Conversar pelo WhatsApp">
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.5 0 .2 5.3.2 11.9c0 2.1.6 4.2 1.6 6L0 24l6.3-1.7a12 12 0 0 0 5.8 1.5h.1C18.7 23.8 24 18.5 24 12c0-3.2-1.2-6.2-3.5-8.5ZM12.1 21.8c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.8 9.8 0 0 1-1.5-5.3A9.9 9.9 0 0 1 12.1 2 9.9 9.9 0 0 1 22 12a9.9 9.9 0 0 1-9.9 9.8Zm5.4-7.4c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.2 8.2 0 0 1-2.5-1.5 9.4 9.4 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.1 1.1-1.1 2.6s1.1 2.9 1.3 3.1c.1.2 2.2 3.4 5.4 4.8l1.8.6c.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4Z" /></svg>
  {contactLabel ? <span>{contactLabel}</span> : !iconOnly && 'WhatsApp'}</a>{!iconOnly && <span>{displayPhone(phone)}</span>}</div>
}
