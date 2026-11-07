import { appErrorMessage } from '../lib/app-errors.js'
import Icon from '../components/Icon.jsx'
import InviteQrCode from '../components/InviteQrCode.jsx'
import Link from '../components/ManagementLink.jsx'
import { t } from '../lib/i18n.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { inviteLink, normalizeInviteCode, professionalDate, statusLabel, professionalInviteState } from '../lib/professional-ux.js'
import { Button, TextField } from '../components/ui.jsx'
import ManagementLayout from '../components/ManagementLayout.jsx'
import { ManagementPanel, ManagementEmpty, ManagementStatus } from '../components/ManagementUI.jsx'
import { FppActionFeedback, FppSkeleton } from '../components/FppFeedback.jsx'

const copyText = async value => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value)
  const input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select()
  try { if (!document.execCommand('copy')) throw new Error('copy-failed') }
  finally { input.remove() }
}

export default function ProfessionalInvites() {
  const auth = useAuth()
  return <InvitesWorkspace key={auth.user?.id || 'anonymous'} userId={auth.user?.id} />
}

function InvitesWorkspace({ userId = undefined }) {
  const [params, setParams] = useSearchParams()
  const creating = params.get('section') === 'create'
  const selectedCode = params.get('code')
  const currentContext = useRef(params.toString())
  currentContext.current = params.toString()
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const mounted = useRef(true)
  const savingRef = useRef(false)
  const [invites, setInvites] = useState([])
  const [busy, setBusy] = useState(Boolean(userId))
  const [saving, setSaving] = useState(false)
  const [savingPersonal, setSavingPersonal] = useState(false)
  const [editingPersonal, setEditingPersonal] = useState(false)
  const editingPersonalRef = useRef(editingPersonal)
  editingPersonalRef.current = editingPersonal
  const [personalDraft, setPersonalDraft] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const [deleteId, setDeleteId] = useState('')

  const refresh = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const rows = await repo.invites()
      if (mounted.current) {
        setInvites(rows)
        const personal = rows.find(item => item.is_personal)
        if (!editingPersonalRef.current && personal) setPersonalDraft(personal.code)
      }
    } catch (failure) {
      if (mounted.current) setError(appErrorMessage(failure, t('Não foi possível carregar os convites.')))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [repo])

  useEffect(() => {
    mounted.current = true
    if (userId) refresh()
    return () => { mounted.current = false }
  }, [refresh, userId])

  const create = async () => {
    if (savingRef.current) return false
    savingRef.current = true
    const requestContext = currentContext.current
    setSaving(true); setError(''); setMessage('')
    try {
      const result = await repo.createInvite('code')
      if (!mounted.current) return false
      const invite = Array.isArray(result) ? result[0] : result
      const code = normalizeInviteCode(invite?.code)
      if (!code) throw new Error('missing-code')
      setMessage(t('Convite criado. Compartilhe o código abaixo.'))
      setInvites(items => items.some(item => normalizeInviteCode(item.code) === code) ? items : [{ ...invite, code, is_personal: false, status: 'pending' }, ...items])
      return { code, requestContext, invite }
    } catch (cause) {
      if (mounted.current) setError(appErrorMessage(cause, t('Não foi possível criar o convite.')))
      throw cause
    } finally {
      savingRef.current = false
      if (mounted.current) setSaving(false)
    }
  }

  const created = async ({ code, requestContext, invite }) => {
    if (!mounted.current) return
    await refresh()
    if (!mounted.current) return
    setInvites(items => items.some(item => normalizeInviteCode(item.code) === code) ? items : [{ ...invite, code, is_personal: false, status: 'pending' }, ...items])
    if (currentContext.current === requestContext) setParams({ section: 'result', code })
  }

  const savePersonal = async () => {
    if (savingPersonal) return false
    setSavingPersonal(true); setError(''); setMessage('')
    try {
      const saved = await repo.savePersonalInviteCode(personalDraft)
      if (!mounted.current) return false
      const normalized = normalizeInviteCode(saved?.code)
      if (!normalized) throw new Error('missing-personal-code')
      setInvites(items => items.map(item => item.is_personal ? { ...item, ...saved, code: normalized, is_personal: true, is_custom: true } : item))
      setPersonalDraft(normalized)
      setEditingPersonal(false)
      setMessage(t('Código pessoal atualizado.'))
      return true
    } catch (cause) {
      if (mounted.current) setError(cause.message === 'professional-invite-code-taken'
        ? t('Esse código já está em uso. Escolha outro.')
        : appErrorMessage(cause, 'Não foi possível salvar o código pessoal. Tente novamente.'))
      return false
    } finally {
      if (mounted.current) setSavingPersonal(false)
    }
  }

  const cancelPersonalEdit = () => {
    setPersonalDraft(personal?.code || '')
    setEditingPersonal(false)
    setError('')
  }

  const revoke = async id => {
    if (savingRef.current) return false
    savingRef.current = true; setSaving(true); setError('')
    try {
      await repo.revokeInvite(id)
      if (!mounted.current) return false
      return true
    } catch (cause) {
      if (mounted.current) setError(appErrorMessage(cause, t('Não foi possível revogar este convite.')))
      throw cause
    } finally {
      savingRef.current = false
      if (mounted.current) setSaving(false)
    }
  }

  const revoked = async () => {
    if (!mounted.current) return
    setConfirmId(''); setMessage(t('Convite revogado.'))
    await refresh()
  }

  const deleteRevoked = async id => {
    if (savingRef.current) return false
    savingRef.current = true; setSaving(true); setError(''); setMessage('')
    try {
      await repo.deleteInvite(id)
      return { id }
    } catch (cause) {
      if (mounted.current) setError(appErrorMessage(cause, t('Não foi possível excluir este convite.')))
      throw cause
    } finally {
      savingRef.current = false
      if (mounted.current) setSaving(false)
    }
  }

  const deleted = result => {
    if (!mounted.current || !result) return
    setInvites(items => items.filter(item => item.id !== result.id))
    setDeleteId(''); setMessage(t('Convite excluído do histórico.'))
    if (selectedCode) setParams({})
  }

  const share = async (code, kind) => {
    setError(''); setMessage('')
    const link = inviteLink(window.location.origin, code)
    try {
      if (kind === 'share') await navigator.share({ title: t('Convite Fit Pro Player'), url: link })
      else {
        await copyText(kind === 'code' ? code : link)
        if (mounted.current) setMessage(t(kind === 'code' ? 'Código copiado.' : 'Link copiado.'))
      }
    } catch (err) {
      if (err?.name === 'AbortError') return false
      if (mounted.current) setError(appErrorMessage(err, t('Não foi possível compartilhar o convite. Tente novamente.')))
      throw err
    }
  }

  const personal = invites.find(item => item.is_personal)
  const generated = invites.filter(item => !item.is_personal)
  const pending = generated.filter(item => professionalInviteState(item) === 'active')
  const used = generated.filter(item => professionalInviteState(item) === 'used')
  const revokedInvites = generated.filter(item => professionalInviteState(item) === 'revoked')
  const selected = selectedCode ? generated.find(item => normalizeInviteCode(item.code) === normalizeInviteCode(selectedCode)) : null
  const visible = selectedCode ? selected ? [selected] : [] : generated

  return <ManagementLayout className="professional-page fpp-management-invites" title={creating ? t('Convidar aluno') : t('Convites')} subtitle={t('Convide alunos para criar um vínculo')} backTo={creating || selectedCode ? '/professional/invites' : '/professional'} action={!creating && !selectedCode && <Link className="management-button management-button-primary" to="/professional/invites?section=create">{t('Convidar aluno')}</Link>}>
    {error && <p role="alert" className="management-error">{error} <Button intent="quick" onClick={refresh}>{t('Tentar novamente')}</Button></p>}
    {message && <FppActionFeedback state="success" className="management-notice">{message}</FppActionFeedback>}
    {!userId ? <ManagementEmpty title={t('Entre na sua conta para continuar.')} />
      : creating ? <ManagementPanel title={t('Novo convite')}>
        <p className="muted">{t('Crie um único convite e compartilhe o mesmo código ou link. O vínculo só nasce depois que o aluno confirmar.')}</p>
        <div className="row-actions fpp-spaced-actions">
          <Button variant="primary" intent="primary" onAction={create} onSuccess={created} disabled={saving || busy} loadingLabel={t('Criando…')} successLabel={t('Convite criado.')} errorLabel={t('Tentar novamente')}>{t('Gerar convite')}</Button>
          <Link className="management-button" to="/professional/invites">{t('Cancelar')}</Link>
        </div>
      </ManagementPanel>
        : busy ? <FppSkeleton label={t('Carregando convites…')} />
          : <>
            {!selectedCode && <ManagementPanel className="management-personal-invite-panel" title={t('Código pessoal')}>
              {personal ? <div className="management-personal-invite">
                <div className="management-personal-invite-copy">
                  <strong className="invite-code">{normalizeInviteCode(personal.code)}</strong>
                  <ManagementStatus tone="success">{t('Reutilizável')}</ManagementStatus>
                  <p className="muted small">{personal.is_custom ? t('Código personalizado') : t('Acompanha seu nome profissional')}</p>
                </div>
                <InviteQrCode value={inviteLink(window.location.origin, personal.code)} />
                {editingPersonal ? <div className="management-personal-invite-edit">
                  <label htmlFor="professional-personal-code">{t('Código pessoal')}</label>
                  <TextField id="professional-personal-code" aria-label={t('Código pessoal')} autoComplete="off" maxLength={120} value={personalDraft} onChange={event => setPersonalDraft(event.target.value)} />
                  <p className="muted small">{t('Espaços e pontuação serão removidos ao salvar.')}</p>
                  <div className="row-actions fpp-spaced-actions">
                    <Button variant="primary" intent="primary" disabled={savingPersonal || !normalizeInviteCode(personalDraft)} onClick={savePersonal}>{savingPersonal ? t('Salvando…') : t('Salvar código')}</Button>
                    <Button disabled={savingPersonal} onClick={cancelPersonalEdit}>{t('Cancelar')}</Button>
                  </div>
                </div> : <div className="management-personal-invite-actions">
                  <div className="row-actions fpp-spaced-actions">
                    <Button intent="quick" onAction={() => share(normalizeInviteCode(personal.code), 'code')} successLabel={t('Código copiado.')} errorLabel={t('Tentar novamente')}>{t('Copiar código')}</Button>
                    <Button variant="primary" icon="link" intent="quick" onAction={() => share(normalizeInviteCode(personal.code), 'link')} successLabel={t('Link copiado.')} errorLabel={t('Tentar novamente')}>{t('Copiar link')}</Button>
                    {navigator.share && <Button intent="quick" onAction={() => share(normalizeInviteCode(personal.code), 'share')} errorLabel={t('Tentar novamente')}>{t('Compartilhar')}</Button>}
                    <Button variant="ghost" onClick={() => { setPersonalDraft(personal.code); setEditingPersonal(true); setError('') }}>{t('Editar código')}</Button>
                  </div>
                </div>}
              </div> : <p className="muted">{t('Seu código pessoal ainda não está disponível. Atualize a página para tentar novamente.')}</p>}
            </ManagementPanel>}

            <ManagementPanel title={selectedCode ? t('Compartilhar convite') : t('Convites gerados')}>
              {!selectedCode && <div className="management-invite-counts" aria-label={t('Resumo dos convites')}>
                <span>{t('Ativos')} ({pending.length})</span><span>{t('Utilizados')} ({used.length})</span><span>{t('Revogados')} ({revokedInvites.length})</span>
              </div>}
              {!visible.length && <ManagementEmpty title={t(selectedCode ? 'Convite não encontrado.' : 'Nenhum convite gerado.')} description={t('Crie um convite individual para começar.')} action={<Link className="management-button" to="/professional/invites?section=create">{t('Convidar aluno')}</Link>} />}
              <div className="management-invite-list">{visible.map(item => {
                const code = normalizeInviteCode(item.code)
                const state = professionalInviteState(item)
                const isPending = state === 'active'
                const isUsed = state === 'used'
                return <article className="management-invite" key={item.id || code}>
                  <details className="management-invite-options" open={Boolean(selectedCode)} onToggle={event => { if (!event.currentTarget.open) { if (confirmId === item.id) setConfirmId(''); if (deleteId === item.id) setDeleteId('') } }}>
                    <summary>
                      <span className="management-record-heading"><strong className="invite-code">{code}</strong><ManagementStatus tone={isUsed ? 'used' : 'neutral'}>{isUsed && <Icon name="check" />}{statusLabel(state)}</ManagementStatus></span>
                      <span className="muted small management-invite-date">{t('Criado em {0}', professionalDate(item.created_at))}</span>
                    </summary>
                    <div className="management-invite-options-body">
                      {isUsed && <div className="management-invite-recipient"><strong>{t('Utilizado por')}: {item.used_by_name || t('Usuário indisponível')}</strong>{(item.used_at || item.accepted_at) && <p className="muted small">{t('Aceito em {0}', professionalDate(item.used_at || item.accepted_at))}</p>}</div>}
                      {isPending && <>
                        <InviteQrCode value={inviteLink(window.location.origin, code)} />
                        <div className="row-actions fpp-spaced-actions">
                          <Button intent="quick" onAction={() => share(code, 'code')} successLabel={t('Código copiado.')} errorLabel={t('Tentar novamente')}>{t('Copiar código')}</Button>
                          <Button variant="primary" icon="link" intent="quick" onAction={() => share(code, 'link')} successLabel={t('Link copiado.')} errorLabel={t('Tentar novamente')}>{t('Copiar link')}</Button>
                          {navigator.share && <Button intent="quick" onAction={() => share(code, 'share')} errorLabel={t('Tentar novamente')}>{t('Compartilhar')}</Button>}
                        </div>
                        {confirmId === item.id ? <div className="danger-confirm"><span>{t('Revogar este convite?')}</span><Button variant="danger" intent="critical" disabled={saving} onAction={() => revoke(item.id)} onSuccess={revoked} successLabel={t('Convite revogado.')} errorLabel={t('Tentar novamente')}>{t('Confirmar')}</Button><Button activation="immediate" disabled={saving} onClick={() => setConfirmId('')}>{t('Cancelar')}</Button></div>
                          : item.id && <Button variant="ghost" onClick={() => setConfirmId(item.id)}>{t('Revogar')}</Button>}
                      </>}
                      {state === 'revoked' && <>
                        <p className="muted small">{t('Convite revogado.')}</p>
                        {deleteId === item.id ? <div className="danger-confirm"><span>{t('Excluir este convite do histórico?')}</span><Button variant="danger" intent="critical" disabled={saving} onAction={() => deleteRevoked(item.id)} onSuccess={deleted} successLabel={t('Convite excluído.')} errorLabel={t('Tentar novamente')}>{t('Confirmar exclusão')}</Button><Button activation="immediate" disabled={saving} onClick={() => setDeleteId('')}>{t('Cancelar')}</Button></div>
                          : item.id && <Button variant="danger" disabled={saving} onClick={() => setDeleteId(item.id)}>{t('Excluir do histórico')}</Button>}
                      </>}
                    </div>
                  </details>
                </article>
              })}</div>
              {selectedCode && <Link className="management-button" to="/professional/invites">{t('Voltar para convites')}</Link>}
            </ManagementPanel>
          </>}
  </ManagementLayout>
}
