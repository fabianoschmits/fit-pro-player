import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '../../../components/ui.jsx'
import { t } from '../../../lib/i18n.js'
import { useStore } from '../../../store/useStore.js'
import { assignedPlanToState, clearAssignedProgramFromState } from '../../../lib/assigned-program.js'
import { useProgramEditorResource } from '../hooks/useProgramEditorResource.js'
import { useProfessionalLists } from '../hooks/useProfessionalLists.js'
import { useProfessionalMutation } from '../hooks/useProfessionalMutation.js'
import { professionalPath, preserveProfessionalIdentity } from '../routes.js'
import ProfessionalLayout from '../components/ProfessionalLayout.jsx'
import ProgramResourceGate from '../components/ProgramResourceGate.jsx'
import ResourceNotice from '../components/ResourceNotice.jsx'
import SearchBar from '../components/SearchBar.jsx'
import SectionHeader from '../components/SectionHeader.jsx'
import CompactList from '../components/CompactList.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PublishedWeek from '../components/PublishedWeek.jsx'
import BottomActionBar from '../components/BottomActionBar.jsx'
export default function ProgramAssignPage() {
  const { programId } = useParams(), location = useLocation()
  const versionId = new URLSearchParams(location.search).get('version')
  const resource = useProgramEditorResource(programId, versionId)
  return <ProgramResourceGate resource={resource}>{resource.data?.program && <Assign key={`${resource.accountId}:${programId}:${versionId || 'latest'}`} resource={resource} />}</ProgramResourceGate>
}
function Assign({ resource }) {
  const location = useLocation(), { program, version } = resource.data
  const [selected, setSelected] = useState(null), [review, setReview] = useState(null), [sent, setSent] = useState(false)
  const mutation = useProfessionalMutation(resource.isCurrent)
  const students = useProfessionalLists({ accountId: !program.archived && version ? resource.accountId : null, resourceKey: `students:program-assign:${program.id}:${version?.id}`,
    initialFilters: { search: '', status: 'all' }, loadPage: filters => resource.repo.studentPage(filters) })
  const initialStudentId = new URLSearchParams(location.search).get('student')
  useEffect(() => {
    if (!initialStudentId || selected || review || students.status !== 'success') return
    const student = students.items.find(item => item.studentUserId === initialStudentId)
    if (student) setSelected(student)
    else if (students.hasMore) students.loadMore()
  }, [initialStudentId, selected, review, students.status, students.items, students.hasMore])
  const backTo = preserveProfessionalIdentity(professionalPath({ kind: 'program', id: program.id }), location.search)
  const send = () => {
    if (!review || !version || program.archived) return
    const choice = review
    mutation.run(async current => {
      await resource.repo.assignProgramVersion({ programId: program.id, versionId: choice.versionId, studentUserId: choice.student.studentUserId })
      if (!current()) return
      // Only reconcile this browser's authenticated student, never another person's state.
      if (choice.student.studentUserId === resource.accountId) {
        const store = useStore.getState(), token = store.getAssignedProgramReadToken()
        const ownsRead = () => current() && useStore.getState().isAssignedProgramReadCurrent(token, resource.accountId)
        if (!ownsRead()) return
        const assignments = await resource.repo.assignedPrograms(resource.accountId)
        if (!ownsRead()) return
        const active = assignments.find(item => item.status === 'active' && item.student_user_id === resource.accountId)
        const assignedVersion = active ? await resource.repo.version(active.version_id) : null
        if (!ownsRead()) return
        if (active && (!assignedVersion || assignedVersion.id !== active.version_id)) throw new Error('missing-assigned-version')
        store.invalidateAssignedProgramReads(token)
        store.replaceState(active ? assignedPlanToState({ ...store.S }, assignedVersion, active) : clearAssignedProgramFromState({ ...store.S }))
      }
    }, () => { setSent(true); students.retry() }, t('Não foi possível enviar esta versão.'))
  }
  return <ProfessionalLayout title={t('Enviar para aluno')} subtitle={`${program.title}${version ? ` · ${t('Versão {0}', version.version_number)}` : ''}`} backTo={backTo}>
    <ResourceNotice resource={resource} />
    {program.archived || !version ? <EmptyState title={t(program.archived ? 'Arquivado' : 'Sem versão publicada')} /> : sent ? <>
      <p role="status" className="management-notice">{t('Programa enviado.')}</p><p>{review.student.displayName} · {program.title} · {t('Versão {0}', review.versionNumber)}</p>
      <Link className="management-button" to={preserveProfessionalIdentity(professionalPath({ kind: 'student', id: review.student.studentUserId }), location.search)} state={location.state}>{t('Ver aluno')}</Link>
      <Link className="management-button" to={backTo} state={location.state}>{t('Voltar para programas')}</Link>
    </> : review ? <>
      <SectionHeader title={t('Revisar envio')} /><p><strong>{review.student.displayName}</strong></p>
      <p>{program.title} · {t('Versão {0}', review.versionNumber)}</p>
      {review.student.currentProgram && <p>{t('Programa atual')}: {review.student.currentProgram.title} · {t('Versão {0}', review.student.currentProgram.versionNumber)}</p>}
      <p>{t('O envio substitui o programa ativo do aluno, inclusive de qualquer profissional. O histórico será preservado.')}</p>
      <PublishedWeek programId={program.id} version={review.version} search={preserveProfessionalIdentity(`?version=${encodeURIComponent(review.versionId)}`, location.search)} state={location.state} />
      {mutation.error && <p role="alert">{mutation.error}</p>}
      <BottomActionBar><Button disabled={mutation.pending} onClick={() => setReview(null)}>{t('Voltar')}</Button><Button variant="primary" disabled={mutation.pending} onClick={send}>{t(mutation.pending ? 'Enviando…' : 'Enviar para aluno')}</Button></BottomActionBar>
    </> : <>
      <SearchBar label={t('Buscar aluno')} value={students.filters.search} onChange={search => { setSelected(null); students.setFilters({ search }) }} />
      <SectionHeader title={students.total == null ? t('Alunos') : t('{0} aluno(s)', students.total)} />
      {students.error && <p role="alert">{t('Não foi possível carregar os alunos.')} <button onClick={students.retry}>{t('Tentar novamente')}</button></p>}
      <CompactList status={students.status} hasMore={students.hasMore} onLoadMore={students.loadMore} empty={<EmptyState title={t('Nenhum resultado')} />}>{students.items.map(student => <li key={student.studentUserId} className="professional-row">
        <button className="professional-row-link professional-student-choice" aria-pressed={selected?.studentUserId === student.studentUserId} onClick={() => setSelected(student)}><span className="professional-row-copy"><strong>{student.displayName}</strong><small>{student.currentProgram?.title || t('Sem programa ativo')}</small></span></button>
      </li>)}</CompactList>
      <BottomActionBar><Button variant="primary" disabled={!selected || students.status === 'loading'} onClick={() => setReview({ student: structuredClone(selected), version: structuredClone(version), versionId: version.id, versionNumber: version.version_number })}>{t('Revisar envio')}</Button></BottomActionBar>
    </>}
  </ProfessionalLayout>
}
