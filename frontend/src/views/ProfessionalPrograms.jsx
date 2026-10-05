import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { PROFESSIONAL_EXERCISES } from '../lib/exercises.js'
import { professionalDate } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { Button, TextArea, TextField } from '../components/ui.jsx'
import Dialog from '../components/Dialog.jsx'
import { ProfessionalPrescription } from '../components/ProfessionalPrescription.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel, ManagementEmpty, ManagementStatus } from '../components/ManagementUI.jsx'
import ProfessionalProgramEditor from '../components/ProfessionalProgramEditor.jsx'

export default function ProfessionalPrograms() {
  const auth = useAuth(); const location = useLocation(); const { programId } = useParams()
  return <ProgramsWorkspace key={`${auth.user?.id}:${location.pathname}`} userId={auth.user?.id} programId={programId} creating={location.pathname.endsWith('/new')} editing={location.pathname.endsWith('/edit')} initialMessage={location.state?.message || ''} />
}

function ProgramsWorkspace({ userId, programId, creating, editing, initialMessage }) {
  const navigate = useNavigate(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const mounted = useRef(true)
  const [programs, setPrograms] = useState([]); const [versions, setVersions] = useState([])
  const [form, setForm] = useState({ title: '', description: '' }); const [busy, setBusy] = useState(Boolean(userId && !creating)); const [saving, setSaving] = useState(false)
  const [error, setError] = useState(''); const [message, setMessage] = useState(initialMessage); const [query, setQuery] = useState(''); const [limit, setLimit] = useState(20)
  const [filter, setFilter] = useState('available'); const [comparison, setComparison] = useState(null); const [archiveId, setArchiveId] = useState(null)
  const refresh = async () => {
    setBusy(true); setError('')
    try {
      const next = await repo.programs(); if (!mounted.current) return
      const selected = next.find(item => item.id === programId)
      const list = selected ? await repo.versions(programId) : []
      if (!mounted.current) return
      setPrograms(next); setVersions(list)
    } catch { if (mounted.current) setError(t('Não foi possível carregar os programas.')) }
    finally { if (mounted.current) setBusy(false) }
  }
  useEffect(() => { mounted.current = true; if (userId && !creating) refresh(); return () => { mounted.current = false } }, [userId, programId, creating])
  const create = async event => {
    event.preventDefault()
    if (!form.title.trim() || saving) return
    setSaving(true); setError('')
    try {
      const result = await repo.createProgram(userId, form.title, form.description)
      if (!mounted.current) return
      if (!result?.id) throw new Error('missing-program')
      navigate(`/professional/programs/${encodeURIComponent(result.id)}/edit`, { state: { message: t('Programa criado.') } })
    } catch { if (mounted.current) setError(t('Não foi possível criar o programa.')) }
    finally { if (mounted.current) setSaving(false) }
  }
  const program = programs.find(item => item.id === programId); const latest = versions[0]
  const saveMetadata = async metadata => {
    await repo.updateProgram(program.id, { ...metadata, archived: false })
    if (!mounted.current) return
    setPrograms(items => items.map(item => item.id === program.id ? { ...item, ...metadata } : item)); setMessage(t('Dados do programa salvos.'))
  }
  const publish = async (plan, metadata) => {
    if (metadata.title !== program.title || metadata.description !== (program.description || '')) await repo.updateProgram(program.id, { ...metadata, archived: false })
    if (!mounted.current) throw new Error('context-changed')
    await repo.publishProgramVersion(program.id, plan)
    if (!mounted.current) throw new Error('context-changed')
    navigate(`/professional/programs/${encodeURIComponent(program.id)}`, { state: { message: t('Nova versão publicada.') } })
  }
  const archive = async archived => {
    if (saving) return
    setSaving(true); setError('')
    try { await repo.updateProgram(program.id, { title: program.title, description: program.description || '', archived }); if (!mounted.current) return; setArchiveId(null); setMessage(t(archived ? 'Programa arquivado.' : 'Programa restaurado.')); await refresh() }
    catch { if (mounted.current) setError(t('Não foi possível atualizar o programa.')) }
    finally { if (mounted.current) setSaving(false) }
  }
  const filtered = programs.filter(item => Boolean(item.archived) === (filter === 'archived') && `${item.title} ${item.description || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()))
  const compareList = versions
  const before = versions.find(version => version.id === comparison?.before); const after = versions.find(version => version.id === comparison?.after)
  const backTo = editing ? `/professional/programs/${encodeURIComponent(programId)}` : programId || creating ? '/professional/programs' : '/professional'
  return <ManagementLayout className="professional-page professional-programs-page" title={creating ? t('Novo programa') : programId ? program?.title || t('Programa') : t('Programas')} subtitle={editing ? t('Monte uma nova versão; versões enviadas permanecem no histórico.') : t('Prescrições e versões reutilizáveis')} backTo={backTo} action={!programId && !creating && <Link className="management-button management-button-primary" to="/professional/programs/new">{t('Criar programa')}</Link>}>
    {error && <p role="alert" className="management-error">{error} {!creating && <button className="link" onClick={refresh}>{t('Tentar novamente')}</button>}</p>}{message && <p role="status" className="management-notice">{message}</p>}
    {!userId ? <ManagementEmpty title={t('Entre na sua conta para continuar.')} /> : busy ? <p role="status">{t('Carregando programas…')}</p> : creating ? <form className="management-profile-form" onSubmit={create}>
      <fieldset className="management-form-group"><legend>{t('Dados do programa')}</legend><label>{t('Nome do programa')}<TextField required maxLength={160} aria-label={t('Nome do programa')} value={form.title} disabled={saving} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>{t('Descrição do programa')}<TextArea maxLength={2000} aria-label={t('Descrição do programa')} placeholder={t('Descrição opcional')} value={form.description} disabled={saving} onChange={event => setForm({ ...form, description: event.target.value })} /></label></fieldset>
      <div className="management-form-actions"><Button type="submit" variant="primary" disabled={saving || !form.title.trim()}>{t(saving ? 'Salvando…' : 'Criar programa')}</Button><Link className="management-button" to="/professional/programs">{t('Cancelar')}</Link></div>
    </form> : programId && !program ? <ManagementEmpty title={t('Programa não encontrado.')} action={<Link className="management-button" to="/professional/programs">{t('Voltar para programas')}</Link>} /> : editing && !program.archived ? <ProfessionalProgramEditor exercises={PROFESSIONAL_EXERCISES} initialPlan={latest?.weekly_plan || {}} initialMetadata={{ title: program.title, description: program.description || '' }} draftKey={`${userId}:${program.id}`} onSaveMetadata={saveMetadata} onCancel={() => navigate(backTo)} onPublish={publish} /> : program ? <>
      <ManagementPanel title={t('Dados do programa')} action={<ManagementStatus tone={program.archived ? 'neutral' : 'success'}>{t(program.archived ? 'Arquivado' : 'Disponível')}</ManagementStatus>}>
        <p className="management-program-description">{program.description || t('Sem descrição')}</p>
        <div className="row-actions">{!program.archived && <Link className="management-button management-button-primary" to={`/professional/programs/${encodeURIComponent(program.id)}/edit`}>{t(latest ? 'Criar nova versão' : 'Editar programa')}</Link>}{versions.length > 1 && <Button onClick={() => setComparison({ before: versions[1].id, after: latest.id })}>{t('Comparar versões')}</Button>}{program.archived ? <Button disabled={saving} onClick={() => archive(false)}>{t('Restaurar')}</Button> : <Button disabled={saving} onClick={() => setArchiveId(program.id)}>{t('Arquivar')}</Button>}</div>
        {archiveId && <div className="danger-confirm"><p>{t('Arquivar encerra as atribuições ativas deste programa. As versões e o histórico serão preservados.')}</p><Button variant="danger" disabled={saving} onClick={() => archive(true)}>{t('Confirmar arquivo')}</Button><Button disabled={saving} onClick={() => setArchiveId(null)}>{t('Cancelar')}</Button></div>}
      </ManagementPanel>
      <ManagementPanel title={t('Versões publicadas')}>
        {versions.length ? <div className="management-version-list">{versions.map((version, index) => <article className="management-version" key={version.id}><div className="management-record-heading"><div><h3>{t('Versão {0}', version.version_number)}</h3><p className="muted small">{professionalDate(version.published_at)}</p></div>{index === 0 && <ManagementStatus tone="success">{t('Mais recente')}</ManagementStatus>}</div><details><summary>{t('Ver prescrição')}</summary><ProfessionalPrescription plan={version.weekly_plan} /></details>{!program.archived && <Link className="management-button" to={`/professional/students?program=${encodeURIComponent(program.id)}&version=${encodeURIComponent(version.id)}`}>{t('Enviar para aluno')}</Link>}</article>)}</div> : <ManagementEmpty title={t('Sem versão publicada')} description={t('Crie seu primeiro programa semanal.')} />}
      </ManagementPanel>
    </> : <>
      <div className="management-list-tools"><label>{t('Buscar programa')}<TextField type="search" aria-label={t('Buscar programa')} placeholder={t('Buscar programa')} value={query} onChange={event => { setQuery(event.target.value); setLimit(20) }} /></label><div className="management-filter" aria-label={t('Status do programa')}>{[['available', 'Disponíveis'], ['archived', 'Arquivados']].map(([value, label]) => <button type="button" aria-pressed={filter === value} key={value} onClick={() => { setFilter(value); setLimit(20) }}>{t(label)}</button>)}</div></div>
      <ManagementPanel title={t('Programas ({0})', filtered.length)}>{filtered.length ? <div className="management-record-list">{filtered.slice(0, limit).map(item => <Link className="management-record" to={`/professional/programs/${encodeURIComponent(item.id)}`} key={item.id}><div><strong>{item.title}</strong><p>{item.description || t('Sem descrição')}</p></div><span aria-hidden="true">›</span></Link>)}</div> : <ManagementEmpty title={t(programs.length ? 'Nenhum resultado' : 'Sem programas')} description={t(programs.length ? 'Ajuste a busca ou troque o filtro.' : 'Crie seu primeiro programa semanal.')} action={!programs.length && <Link className="management-button" to="/professional/programs/new">{t('Criar programa')}</Link>} />}{filtered.length > limit && <Button onClick={() => setLimit(value => value + 20)}>{t('Carregar mais')}</Button>}</ManagementPanel>
    </>}
    {comparison && <Dialog title={t('Comparar versões')} onClose={() => setComparison(null)} className="professional-version-dialog"><p className="muted">{t(before && after && JSON.stringify(before.weekly_plan) === JSON.stringify(after.weekly_plan) ? 'Prescrições iguais.' : 'Compare os exercícios, cargas e descansos antes de enviar uma nova versão.')}</p><div className="professional-version-compare">{[['before', before], ['after', after]].map(([side, version]) => <div key={side}><label>{t(side === 'before' ? 'Versão anterior' : 'Versão nova')}<select value={comparison[side]} onChange={event => setComparison({ ...comparison, [side]: event.target.value })}>{compareList.map(item => <option key={item.id} value={item.id}>{t('Versão {0}', item.version_number)} / {professionalDate(item.published_at)}</option>)}</select></label>{version && <ProfessionalPrescription plan={version.weekly_plan} />}</div>)}</div></Dialog>}
  </ManagementLayout>
}
