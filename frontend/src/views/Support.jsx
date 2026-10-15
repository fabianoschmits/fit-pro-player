import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createSupportRepository } from '../lib/support.js'
import { Button, Section, TextArea, TextField } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'
import Icon from '../components/Icon.jsx'
import '../support.css'

export const SUPPORT_CATEGORIES = [
  ['question', 'Dúvida'], ['technical', 'Problema técnico'], ['criticism', 'Crítica'], ['suggestion', 'Sugestão de melhoria'],
  ['feature_request', 'Solicitação de recurso'], ['account', 'Conta e acesso'], ['training', 'Treino e exercícios'], ['privacy', 'Privacidade e dados'], ['other', 'Outro'],
]

export function validateSupportForm({ category, subject, body }) {
  return { ...(category ? {} : { category: 'Selecione uma categoria.' }), ...(subject?.trim() ? {} : { subject: 'Informe um assunto.' }), ...(body?.trim() ? {} : { body: 'Escreva sua mensagem.' }) }
}

const repoFor = () => createSupportRepository({ client: getBrowserSupabaseClient() })

export default function Support() {
  const nav = useNavigate()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(null)
  const [faq, setFaq] = useState([])
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const repo = useMemo(repoFor, [])
  useEffect(() => { let live = true; setBusy(true); repo.listFaq({ query, category }).then(rows => live && setFaq(rows)).catch(e => live && setError(e.message || 'Não foi possível carregar a ajuda.')).finally(() => live && setBusy(false)); return () => { live = false } }, [repo, query, category])
  return <div className="narrow support-page">
    <AppHeader title="Ajuda e suporte" subtitle="Encontre respostas ou fale com o administrador." />
    <div className="support-actions"><Link className="support-action-card" to="/support/tickets/new"><Icon name="chat" /><span><strong>Fale com o administrador</strong><small>Envie dúvidas, críticas ou sugestões.</small></span><Icon name="chevronRight" /></Link><Link className="support-action-card" to="/support/tickets"><Icon name="history" /><span><strong>Meus chamados</strong><small>Acompanhe suas mensagens e respostas.</small></span><Icon name="chevronRight" /></Link></div>
    <Section title="Perguntas frequentes" className="support-section">
      <TextField className="support-search" placeholder="Buscar no FAQ" value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar no FAQ" />
      <div className="support-category-row"><button className={!category ? 'support-filter active' : 'support-filter'} onClick={() => setCategory(null)}>Todos</button>{SUPPORT_CATEGORIES.map(([id, label]) => <button key={id} className={category === id ? 'support-filter active' : 'support-filter'} onClick={() => setCategory(id)}>{label}</button>)}</div>
      {error && <p role="alert" className="support-error">{error}</p>}{busy && <p role="status" className="muted">Carregando perguntas…</p>}{!busy && !error && faq.length === 0 && <p className="muted">Nenhuma pergunta encontrada.</p>}
      <div className="support-faq-list">{faq.map(item => <article key={item.articleId} className="support-faq-item"><button type="button" onClick={() => setOpen(open === item.articleId ? null : item.articleId)}><span>{item.question}</span><Icon name={open === item.articleId ? 'chevronUp' : 'chevronDown'} /></button>{open === item.articleId && <p>{item.answer}</p>}</article>)}</div>
    </Section>
  </div>
}

export function SupportComposer() {
  const nav = useNavigate(); const repo = useMemo(repoFor, [])
  const [form, setForm] = useState({ category: '', subject: '', body: '' }); const [errors, setErrors] = useState({}); const [busy, setBusy] = useState(false); const [success, setSuccess] = useState(false)
  const submit = async e => { e.preventDefault(); const next = validateSupportForm(form); setErrors(next); if (Object.keys(next).length) return; setBusy(true); try { const id = await repo.createTicket(form); setSuccess(true); setTimeout(() => nav(`/support/tickets/${id}`), 250) } catch (err) { setErrors({ form: err.message || 'Não foi possível enviar. Tente novamente.' }) } finally { setBusy(false) } }
  return <div className="narrow support-page"><AppHeader title="Fale com o administrador" subtitle="Responderemos pelo próprio aplicativo." backTo="/support" /><form className="support-form" onSubmit={submit} noValidate>{errors.form && <p role="alert" className="support-error">{errors.form}</p>}{success && <p role="status" className="support-success">Mensagem enviada. Abrindo seu chamado…</p>}<label>Categoria<select className="field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="">Selecione</option>{SUPPORT_CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>{errors.category && <small className="support-field-error">{errors.category}</small>}</label><label>Assunto<TextField value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} maxLength={160} placeholder="Como podemos ajudar?" />{errors.subject && <small className="support-field-error">{errors.subject}</small>}</label><label>Mensagem<TextArea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={7} maxLength={10000} placeholder="Descreva sua dúvida, crítica ou sugestão…" />{errors.body && <small className="support-field-error">{errors.body}</small>}</label><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar mensagem'}</Button></form></div>
}
