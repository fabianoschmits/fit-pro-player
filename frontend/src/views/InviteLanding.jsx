import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { normalizeInviteCode, statusLabel } from '../lib/professional-ux.js'
import { Button, Section } from '../components/ui.jsx'
import AppHeader from '../components/AppHeader.jsx'

export default function InviteLanding() {
  const auth = useAuth(); const navigate = useNavigate(); const { code: rawCode } = useParams(); const code = normalizeInviteCode(rawCode)
  const repo = useMemo(() => createProfessionalWorkflowRepository({ client: getBrowserSupabaseClient() }), [])
  const [preview, setPreview] = useState(null); const [busy, setBusy] = useState(true); const [error, setError] = useState(''); const [message, setMessage] = useState('')
  useEffect(() => { if (!auth.user?.id) return; repo.previewInvite(code).then(rows => { setPreview(rows?.[0] || null); if (!rows?.length) setError('Convite inválido ou expirado.') }).catch(() => setError('Não foi possível consultar este convite.')).finally(() => setBusy(false)) }, [auth.user?.id, code])
  const accept = async () => { setError(''); try { await repo.acceptInvite(code); setMessage('Vínculo criado.'); navigate('/student/professionals', { replace: true }) } catch { setError('Não foi possível aceitar este convite. Ele pode ter expirado ou já ter sido utilizado.') } }
  return <div className="narrow invite-landing"><AppHeader title="Convite profissional" backTo="/student/professionals" />{error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}{busy ? <p role="status">Consultando convite…</p> : preview ? <Section title="Confira antes de vincular"><div className="card invite-preview-card"><h2>{preview.professional_name}</h2><p>{preview.bio || 'Perfil profissional'}</p>{preview.specialties?.length > 0 && <p className="muted">{preview.specialties.join(' · ')}</p>}<small className="muted">Verificação: {statusLabel(preview.verification_status)}</small><Button variant="primary" onClick={accept}>Vincular a este profissional</Button></div></Section> : <Section title="Convite indisponível"><p className="muted">Peça um novo código ao profissional.</p></Section>}</div>
}
