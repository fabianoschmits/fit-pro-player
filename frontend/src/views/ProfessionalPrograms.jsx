import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { PROFESSIONAL_EXERCISES } from '../lib/exercises.js'
import { professionalDate } from '../lib/professional-ux.js'
import { t } from '../lib/i18n.js'
import { Button, Section, TextArea, TextField } from '../components/ui.jsx'
import Dialog from '../components/Dialog.jsx'
import { ProfessionalPrescription } from '../components/ProfessionalPrescription.jsx'
import AppHeader from '../components/AppHeader.jsx'
import ProfessionalWorkspaceNav from '../components/ProfessionalWorkspaceNav.jsx'
import ProfessionalProgramEditor from '../components/ProfessionalProgramEditor.jsx'

export default function ProfessionalPrograms() {
  const auth = useAuth(); const navigate = useNavigate(); const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const owner = useRef(auth.user?.id); owner.current = auth.user?.id
  const [programs, setPrograms] = useState([]); const [versions, setVersions] = useState({}); const [editor, setEditor] = useState(null)
  const [form, setForm] = useState({ title: '', description: '' }); const [busy, setBusy] = useState(true); const [saving, setSaving] = useState(false)
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [query, setQuery] = useState(''); const [limit, setLimit] = useState(20)
  const [comparison, setComparison] = useState(null); const [archiveId, setArchiveId] = useState(null)
  const refresh = async () => {
    const requestOwner = auth.user?.id; setBusy(true)
    try {
      const nextPrograms = await repo.programs(); if (owner.current !== requestOwner) return
      const pairs = await Promise.all(nextPrograms.map(async program => [program.id, await repo.versions(program.id)]))
      if (owner.current !== requestOwner) return
      setPrograms(nextPrograms); setVersions(Object.fromEntries(pairs))
    } catch { if (owner.current === requestOwner) setError(t('Não foi possível carregar os programas.')) }
    finally { if (owner.current === requestOwner) setBusy(false) }
  }
  useEffect(() => { owner.current = auth.user?.id; if (auth.user?.id) refresh(); return () => { owner.current = null } }, [auth.user?.id])
  const create = async () => {
    if (!form.title.trim() || saving) return; const requestOwner = auth.user.id; setSaving(true); setError('')
    try { const result = await repo.createProgram(auth.user.id, form.title, form.description); if (owner.current !== requestOwner) return; setForm({ title: '', description: '' }); setMessage(t('Programa criado.')); await refresh(); if (result?.id && owner.current === requestOwner) setEditor({ program: result, initialPlan: {} }) }
    catch { if (owner.current === requestOwner) setError(t('Não foi possível criar o programa.')) }
    finally { if (owner.current === requestOwner) setSaving(false) }
  }
  const saveMetadata = async (program, metadata) => {
    await repo.updateProgram(program.id, { ...metadata, archived: false })
    if (owner.current !== auth.user?.id) return
    setPrograms(items => items.map(item => item.id === program.id ? { ...item, ...metadata } : item)); setMessage(t('Dados do programa salvos.'))
  }
  const publish = async (program, plan, metadata) => {
    const requestOwner = auth.user.id
    if (metadata.title !== program.title || metadata.description !== (program.description || '')) await repo.updateProgram(program.id, { ...metadata, archived: false })
    await repo.publishProgramVersion(program.id, plan)
    if (owner.current !== requestOwner) return
    setEditor(null); setMessage(t('Nova versão publicada.')); await refresh()
  }
  const archive = async (program, archived) => {
    if (saving) return; const requestOwner = auth.user.id; setSaving(true); setError('')
    try { await repo.updateProgram(program.id, { title: program.title, description: program.description || '', archived }); if (owner.current !== requestOwner) return; setArchiveId(null); setMessage(t(archived ? 'Programa arquivado.' : 'Programa restaurado.')); await refresh() }
    catch { if (owner.current === requestOwner) setError(t('Não foi possível atualizar o programa.')) }
    finally { if (owner.current === requestOwner) setSaving(false) }
  }
  const filtered = programs.filter(program => `${program.title} ${program.description || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()))
  const compareList = comparison ? versions[comparison.programId] || [] : []
  const before = compareList.find(version => version.id === comparison?.before); const after = compareList.find(version => version.id === comparison?.after)
  return <div className="narrow professional-page professional-programs-page"><AppHeader title={t('Programas')} subtitle={t('Prescrições e versões reutilizáveis')} backTo="/professional" /><ProfessionalWorkspaceNav />
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    {busy ? <p role="status">{t('Carregando programas…')}</p> : editor ? <ProfessionalProgramEditor key={editor.program.id} exercises={PROFESSIONAL_EXERCISES} initialPlan={editor.initialPlan} initialMetadata={{ title: editor.program.title, description: editor.program.description || '' }} draftKey={`${auth.user.id}:${editor.program.id}`} onSaveMetadata={metadata => saveMetadata(editor.program, metadata)} onCancel={() => setEditor(null)} onPublish={(plan, metadata) => publish(editor.program, plan, metadata)} /> : <>
      <Section title={t('Novo programa')}><label>{t('Nome do programa')}<TextField maxLength={160} aria-label={t('Nome do programa')} placeholder={t('Nome do programa')} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>{t('Descrição do programa')}<TextArea maxLength={2000} aria-label={t('Descrição do programa')} placeholder={t('Descrição opcional')} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><Button variant="primary" disabled={saving || !form.title.trim()} onClick={create}>{t(saving ? 'Salvando…' : 'Criar programa')}</Button></Section>
      <Section title={t('Programas ({0})', programs.length)}><TextField aria-label={t('Buscar programa')} placeholder={t('Buscar programa')} value={query} onChange={event => { setQuery(event.target.value); setLimit(20) }} />{filtered.length ? <div className="professional-program-list">{filtered.slice(0, limit).map(program => {
        const list = versions[program.id] || []; const latest = list[0]
        return <article className="card professional-program-card" key={program.id}><div><strong>{program.title}</strong>{program.archived && <span className="status-pill">{t('Arquivado')}</span>}<p className="muted">{program.description || t('Sem descrição')}</p></div>
          <p className="muted">{latest ? t('Versão {0} · {1} versão(ões)', latest.version_number, list.length) : t('Sem versão publicada')}{latest?.published_at && ` · ${professionalDate(latest.published_at)}`}</p>
          <div className="row-actions">{!program.archived && <><Button onClick={() => setEditor({ program, initialPlan: latest?.weekly_plan || {} })}>{t(latest ? 'Criar nova versão' : 'Editar programa')}</Button>{latest && <Button onClick={() => navigate(`/professional/students?program=${encodeURIComponent(program.id)}&version=${encodeURIComponent(latest.id)}`)}>{t('Enviar para aluno')}</Button>}</>}{list.length > 1 && <Button onClick={() => setComparison({ programId: program.id, before: list[1].id, after: list[0].id })}>{t('Comparar versões')}</Button>}{program.archived ? <Button disabled={saving} onClick={() => archive(program, false)}>{t('Restaurar')}</Button> : <Button disabled={saving} onClick={() => setArchiveId(program.id)}>{t('Arquivar')}</Button>}</div>
          {archiveId === program.id && <div className="danger-confirm"><p>{t('Arquivar encerra as atribuições ativas deste programa. As versões e o histórico serão preservados.')}</p><Button variant="danger" disabled={saving} onClick={() => archive(program, true)}>{t('Confirmar arquivo')}</Button><Button disabled={saving} onClick={() => setArchiveId(null)}>{t('Cancelar')}</Button></div>}
        </article>
      })}</div> : <p className="muted">{t(programs.length ? 'Nenhum resultado.' : 'Crie seu primeiro programa semanal.')}</p>}{filtered.length > limit && <Button onClick={() => setLimit(value => value + 20)}>{t('Carregar mais')}</Button>}</Section>
    </>}
    {comparison && <Dialog title={t('Comparar versões')} onClose={() => setComparison(null)} className="professional-version-dialog"><p className="muted">{t(before && after && JSON.stringify(before.weekly_plan) === JSON.stringify(after.weekly_plan) ? 'Prescrições iguais.' : 'Compare os exercícios, cargas e descansos antes de enviar uma nova versão.')}</p><div className="professional-version-compare">{[['before', before], ['after', after]].map(([side, version]) => <div key={side}><label>{t(side === 'before' ? 'Versão anterior' : 'Versão nova')}<select value={comparison[side]} onChange={event => setComparison({ ...comparison, [side]: event.target.value })}>{compareList.map(item => <option key={item.id} value={item.id}>{t('Versão {0}', item.version_number)} / {professionalDate(item.published_at)}</option>)}</select></label>{version && <ProfessionalPrescription plan={version.weekly_plan} />}</div>)}</div></Dialog>}
  </div>
}
