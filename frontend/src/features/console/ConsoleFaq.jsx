import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { createSupportRepository } from '../../lib/support.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { useConsoleAccess, AccessGate } from './ConsoleAccess.jsx'
import useConsoleResource from './useConsoleResource.js'
import { Alert, SectionBody, Chip, Empty, Loading, CxButton } from './ConsoleUI.jsx'
import { useFppAction } from '../../components/useFppAction.js'

export default function ConsoleFaq() {
  const { userId, allowed } = useConsoleAccess()
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const [query, setQuery] = useState(''), [visibility, setVisibility] = useState('all')
  const { data, busy, error, refresh } = useConsoleResource({ userId, allowed, resourceKey: 'faq', load: () => repo.listFaqAdmin() })
  const articles = (data || []).filter(article => (visibility === 'all' || article.isPublished === (visibility === 'published')) && `${article.question} ${article.answer} ${article.categoryLabel}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
  return <AccessGate allowed={allowed}><ConsoleShell userId={userId} allowed={allowed}><div className="cx-page-body">
    <div className="cx-page-head console-page-heading"><div><h1 className="cx-page-title">Perguntas frequentes</h1><p className="cx-page-sub">Gerencie o conteúdo de Ajuda e suporte.</p></div><Link className="cx-pill-btn cx-pill-btn--accent" to="/console/faq/new">Nova pergunta</Link></div>
    <section className="console-filter-section" aria-label="Filtros do FAQ"><div className="console-faq-filters"><label className="cx-label">Buscar no FAQ<input className="cx-field" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Pergunta, resposta ou categoria" /></label><label className="cx-label">Publicação<select className="cx-field" value={visibility} onChange={e => setVisibility(e.target.value)}><option value="all">Todas</option><option value="published">Publicadas</option><option value="draft">Rascunhos</option></select></label></div></section>
    {error && <Alert onRetry={refresh}>{error}</Alert>}
    {busy ? <Loading label="Carregando perguntas…" /> : <section aria-label="Artigos do FAQ"><div className="console-list-heading"><h2>Conteúdo do FAQ</h2><span>{articles.length} perguntas</span></div>{!articles.length ? <Empty title="Nenhuma pergunta encontrada" sub="Ajuste a busca ou crie uma nova pergunta." /> : <SectionBody>{articles.map(article => <Link className="console-faq-row" key={article.articleId} to={`/console/faq/${article.articleId}`}><span><strong>{article.question}</strong><small>{article.categoryLabel} · Ordem {article.sortOrder}</small><span className="console-faq-excerpt">{article.answer}</span></span><span className="console-message-badges"><Chip tone={article.isPublished ? 'ok' : 'neutral'}>{article.isPublished ? 'Publicada' : 'Rascunho'}</Chip>{article.isFeatured && <Chip>Destaque</Chip>}</span></Link>)}</SectionBody>}</section>}
  </div></ConsoleShell></AccessGate>
}

const emptyArticle = { articleId: null, categorySlug: '', question: '', answer: '', sortOrder: 0, isFeatured: false, isPublished: false }
export function ConsoleFaqEditor() {
  const { articleId } = useParams(), nav = useNavigate()
  const { userId, allowed } = useConsoleAccess()
  const repo = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const identity = `${userId}:${articleId}`
  const current = useRef(identity); current.current = identity
  const [draft, setDraft] = useState(null), [saveError, setSaveError] = useState('')
  useEffect(() => { current.current = identity; setDraft(null); setSaveError(''); return () => { current.current = null } }, [identity])
  const { data, busy, error, refresh } = useConsoleResource({ userId, allowed, resourceKey: 'faq:' + articleId, load: async () => {
    const [categories, articles] = await Promise.all([repo.listCategories(), articleId === 'new' ? Promise.resolve([]) : repo.listFaqAdmin()])
    const article = articleId === 'new' ? { ...emptyArticle, categorySlug: categories[0]?.slug || '' } : articles.find(item => item.articleId === articleId)
    if (!article) throw new Error('article-not-found')
    return { categories, article }
  } })
  const form = draft || data?.article
  const field = (key, value) => setDraft({ ...form, [key]: value })
  const operation = useFppAction({
    onAction: async () => {
      if (!form?.categorySlug || form.question.trim().length < 3 || form.answer.trim().length < 3) { setSaveError('Preencha a categoria, a pergunta e a resposta com pelo menos 3 caracteres.'); return false }
      setSaveError('')
      await repo.saveFaqArticle({ ...form, question: form.question.trim(), answer: form.answer.trim() })
      return current.current === identity
    },
    onSuccess: () => nav('/console/faq'),
    onError: () => { if (current.current === identity) setSaveError('Não foi possível salvar a pergunta. Seu texto foi mantido.') },
  })
  const save = event => { event.preventDefault(); void operation.run(event) }
  return <AccessGate allowed={allowed}><ConsoleShell userId={userId} allowed={allowed} back="/console/faq" backLabel="Perguntas frequentes"><div className="cx-page-body">
    <div className="cx-page-head"><h1 className="cx-page-title">{articleId === 'new' ? 'Nova pergunta' : 'Editar pergunta'}</h1><p className="cx-page-sub">Escreva uma resposta clara e escolha como ela aparece no FAQ.</p></div>
    {error && <Alert onRetry={refresh}>{error}</Alert>}{saveError && <Alert>{saveError}</Alert>}
    {busy ? <Loading label="Carregando editor…" /> : form && <form className="console-faq-editor" onSubmit={save}>
      <section><h2>Conteúdo</h2><SectionBody><div className="console-panel-content console-field-stack">
        <label className="cx-label">Categoria<select className="cx-field" value={form.categorySlug} onChange={e => field('categorySlug', e.target.value)}>{data.categories.map(category => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label>
        <label className="cx-label">Pergunta<input className="cx-field" value={form.question} onChange={e => field('question', e.target.value)} maxLength={240} required minLength={3} /></label>
        <label className="cx-label">Resposta<textarea className="cx-field cx-field--ta" value={form.answer} onChange={e => field('answer', e.target.value)} rows={9} maxLength={10000} required minLength={3} /></label>
      </div></SectionBody></section>
      <section><h2>Publicação e organização</h2><SectionBody><div className="console-panel-content console-field-stack">
        <label className="cx-label">Ordem de exibição<input className="cx-field" type="number" min={0} step={1} value={form.sortOrder} onChange={e => field('sortOrder', Math.max(0, Number(e.target.value) || 0))} /></label>
        <label className="console-checkbox"><input type="checkbox" checked={form.isFeatured} onChange={e => field('isFeatured', e.target.checked)} /><span>Destacar entre as perguntas mais importantes</span></label>
        <label className="console-checkbox"><input type="checkbox" checked={form.isPublished} onChange={e => field('isPublished', e.target.checked)} /><span>Publicar em Ajuda e suporte</span></label>
      </div></SectionBody></section><div className="console-editor-actions"><Link className="cx-pill-btn" to="/console/faq">Cancelar</Link><CxButton className="cx-pill-btn cx-pill-btn--accent" type="submit" state={operation.state} loadingLabel="Salvando…">Salvar pergunta</CxButton></div>
    </form>}
  </div></ConsoleShell></AccessGate>
}
