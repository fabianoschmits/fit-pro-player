import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { startTabShortLabel } from '../lib/ux.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { createProfessionalWorkflowRepository } from '../lib/professional-workflow.js'
import { createConsoleRepository } from '../lib/console.js'
import { confirmSheet } from '../sheets.jsx'
import Icon from './Icon.jsx'
import { useFppActivation } from './useFppActivation.js'

const MAIN = [
  { k: 'home', icon: 'house', to: '/home', label: () => t('Home') }, { k: 'plan', icon: 'calendar', to: '/plan', label: () => t('Plan') },
  { k: 'start', icon: s => s.active ? 'play' : 'dumbbell', action: true, label: s => startTabShortLabel(s) }, { k: 'stats', icon: 'chart', to: '/stats', label: () => t('Stats') },
]
const activeMain = path => { const root = path.split('/')[1] || 'home'; return root === 'body-progress' ? 'stats' : root === 'workout' ? 'start' : MAIN.some(x => x.k === root) ? root : null }

function MainButton({ item, active, state, onSelect }) {
  const trigger = useFppActivation({ onActivate: onSelect }); const icon = typeof item.icon === 'function' ? item.icon(state) : item.icon; const label = item.label(state)
  return <button type="button" data-tab-key={item.k} className={'corner-nav-tab' + (item.action ? ' corner-nav-tab--start' : '') + (active ? ' is-active' : '')} onClick={trigger.run} aria-current={active ? 'page' : undefined}><span className="corner-nav-icon"><Icon name={icon} /></span><span>{label}</span></button>
}

export default function TabBar({ onStart }) {
  const nav = useNavigate(), loc = useLocation(), S = useStore(s => s.S), isGuest = useStore(s => s.isGuest()), auth = useAuth(), account = auth.status === 'authenticated' ? auth.user : null
  const [open, setOpen] = useState(true), [moreOpen, setMoreOpen] = useState(false), [moreBelow, setMoreBelow] = useState(false), [professional, setProfessional] = useState(false), [consoleAccess, setConsoleAccess] = useState(false), [free, setFree] = useState(false), [position, setPosition] = useState({ x: 0, y: 0 })
  const rootRef = useRef(null), moreTrigger = useRef(null), firstMore = useRef(null), drag = useRef(null), dragMoved = useRef(false)
  useEffect(() => { let alive = true; if (!account?.id) return () => { alive = false }; const client = getBrowserSupabaseClient(); createProfessionalWorkflowRepository({ client }).professionalRole(account.id).then(v => alive && setProfessional(v)).catch(() => {}); createConsoleRepository({ client }).adminRole(account.id).then(v => alive && setConsoleAccess(v)).catch(() => {}); return () => { alive = false } }, [account?.id])
  useEffect(() => { if (!moreOpen) return; firstMore.current?.focus(); const close = e => { if (e.key === 'Escape') { setMoreOpen(false); moreTrigger.current?.focus() } else if (e.type === 'pointerdown' && rootRef.current && !rootRef.current.contains(e.target)) setMoreOpen(false) }; document.addEventListener('keydown', close); document.addEventListener('pointerdown', close); return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close) } }, [moreOpen])
  if (!((auth.status === 'authenticated' || isGuest) && S.onboardingDone)) return null
  const start = () => { if (S.active) return nav('/workout'); if (!S.routines.length) return nav('/plan'); const routine = effectiveRoutine(S, todayISO()); if (routine?.ex.length) return onStart(routine.id); nav('/workout') }
  const go = to => { setMoreOpen(false); nav(to) }
  const signOut = () => confirmSheet({ title: 'Sair da conta?', message: 'Sua sessão será encerrada neste dispositivo.', confirmText: 'Sair', danger: true, onConfirm: async () => { const result = await auth.signOut(); if (result?.kind && result.kind !== 'success') throw new Error('sign_out_failed'); nav('/'); return true } })
  const beginDrag = event => { if (!free) return; drag.current = { x: event.clientX, y: event.clientY, position }; dragMoved.current = false; event.currentTarget.setPointerCapture(event.pointerId) }
  const moveDrag = event => { if (!drag.current) return; const x = drag.current.position.x + event.clientX - drag.current.x, y = drag.current.position.y + event.clientY - drag.current.y; if (Math.abs(x - position.x) + Math.abs(y - position.y) > 4) dragMoved.current = true; if (moreOpen) setMoreBelow((rootRef.current?.getBoundingClientRect().top || 0) + (y - position.y) < 350); setPosition({ x, y }) }
  const endDrag = () => { drag.current = null }
  const toggleMore = () => { if (!moreOpen) setMoreBelow((rootRef.current?.getBoundingClientRect().top || 0) < 350); setMoreOpen(v => !v) }
  const groups = [['Geral', [{ icon: 'person', title: 'Dados pessoais', sub: 'Seus dados e informações', to: '/personal-data' }, { icon: 'gear', title: t('Settings'), sub: t('Language, units, backup & preferences'), to: '/settings' }, ...(consoleAccess ? [{ icon: 'gear', title: 'Central da plataforma', sub: 'Operação da plataforma', to: '/console' }] : [])]], ['Treino', [{ icon: 'list', title: t('Exercises'), sub: 'Catálogo completo', to: '/library' }, { icon: 'history', title: t('History'), sub: t('All your past workouts'), to: '/history' }, { icon: 'chartLine', title: 'Evolução corporal', sub: 'Medidas semanais e evolução do corpo', to: '/body-progress' }]], ...((account || professional) ? [['Profissional', [...(account ? [{ icon: 'personCircle', title: 'Meus profissionais', sub: 'Programas e prescrições', to: '/student/professionals' }] : []), { icon: 'clipboard', title: professional ? 'Área profissional' : 'Tornar-se profissional', sub: professional ? 'Alunos, convites e programas' : t('Create your profile to coach students'), to: professional ? '/professional' : '/professional/profile' }]]] : []), ['Sobre', [{ icon: 'info', title: 'Ajuda e suporte', sub: 'Dúvidas, críticas e sugestões', to: '/support' }, { icon: 'info', title: 'Sobre o Fit Pro Player', sub: 'Informações do aplicativo', to: '/privacy' }, { icon: 'shield', title: 'Termos e privacidade', sub: 'Privacidade, cookies e direitos LGPD', to: '/privacy-settings' }, ...(account ? [{ icon: 'signOut', title: 'Sair da conta', sub: 'Encerrar a sessão neste dispositivo', action: signOut }] : []), { icon: 'expand', title: free ? 'Fixar menu aqui' : 'Mover menu livremente', sub: free ? 'Mantém esta posição na tela' : 'Arraste o pivô para posicionar', action: () => { dragMoved.current = false; setFree(v => !v) }, dragToggle: true }]]]
  const current = activeMain(loc.pathname), currentItem = MAIN.find(x => x.k === current) || MAIN[0]
  return <div id="tabbar" ref={rootRef} className={'corner-nav' + (open ? ' is-open' : '') + (free ? ' is-free' : '') + (moreBelow ? ' more-below' : '')} style={{ transform: `translate(${position.x}px, ${position.y}px)` }}><nav className="corner-nav-rail" aria-label={t('Main navigation')}><div className="corner-nav-pivot">{open && <button type="button" ref={moreTrigger} className="corner-nav-more-trigger" aria-label="Abrir mais opções" aria-expanded={moreOpen} onClick={toggleMore}><Icon name={moreBelow ? 'chevronDown' : 'chevronUp'} /></button>}<button type="button" className="corner-nav-toggle" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={() => { if (free && dragMoved.current) { dragMoved.current = false; return } setOpen(v => !v); setMoreOpen(false) }}><Icon name={open ? 'xmark' : (typeof currentItem.icon === 'function' ? currentItem.icon(S) : currentItem.icon)} /><span>{open ? 'Fechar' : currentItem.label(S)}</span></button></div><div className={'corner-nav-main' + (open ? '' : ' is-hidden')}>{MAIN.map(item => <MainButton key={item.k} item={item} state={S} active={current === item.k} onSelect={() => item.action ? start() : go(item.to)} />)}</div><div className={'corner-nav-more' + (moreOpen ? ' is-visible' : '')} role="menu">{groups.map(([group, links], groupIndex) => <section key={group}><h2>{group}</h2>{links.map((item, index) => <button tabIndex={moreOpen ? undefined : -1} ref={groupIndex === 0 && index === 0 ? firstMore : undefined} key={item.title} role="menuitem" type="button" className={'corner-nav-more-item' + (item.dragToggle ? ' corner-nav-drag-toggle' : '')} onClick={() => item.action ? item.action() : go(item.to)}><Icon name={item.icon} /><span><strong>{item.title}</strong><small>{item.sub}</small></span></button>)}</section>)}</div></nav></div>
}
