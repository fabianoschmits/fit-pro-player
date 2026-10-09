import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AppHeader from '../../../components/AppHeader.jsx'
import ProfessionalWorkspaceNav from '../../../components/ProfessionalWorkspaceNav.jsx'
import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import ContextActions from './ContextActions.jsx'

export default function ProfessionalLayout({ title, subtitle, backTo, action, children, className = '', nav = true }) {
  const active = useStore(state => state.S.active)
  const navigate = useNavigate(), { pathname } = useLocation(), shell = useRef(null)
  const current = destination => pathname === destination || (destination === '/professional/profile' && pathname === '/professional-profile')
  const go = destination => { if (!current(destination)) navigate(destination) }
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const resize = () => {
      const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)
      if (shell.current) shell.current.dataset.keyboard = String(editing && window.innerHeight - viewport.height > 120)
    }
    viewport.addEventListener('resize', resize)
    document.addEventListener('focusout', resize)
    return () => { viewport.removeEventListener('resize', resize); document.removeEventListener('focusout', resize) }
  }, [])
  return <div ref={shell} className={`management-layout professional-native ${className}`.trim()} data-navigation={!!nav}>
    <AppHeader title={title} subtitle={subtitle} backTo={backTo} variant="compact" action={<>{action}<ContextActions label={t('Área profissional')} items={[
      { id: 'profile', label: t('Perfil'), disabled: current('/professional/profile'), onSelect: () => go('/professional/profile') },
      { id: 'exercises', label: t('Exercícios'), disabled: current('/professional/exercises'), onSelect: () => go('/professional/exercises') },
      { id: 'home', label: t('Voltar ao FPP'), disabled: current('/home'), onSelect: () => go('/home') },
    ]} /></>} />
    {nav && <ProfessionalWorkspaceNav />}
    <div className="management-content professional-native-content">
      {active && <Link className="professional-resume" to="/workout">{t('Retomar treino')}</Link>}
      {children}
    </div>
  </div>
}
