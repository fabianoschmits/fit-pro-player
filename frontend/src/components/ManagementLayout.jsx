import { Link, useLocation } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import AppHeader from './AppHeader.jsx'
import ProfessionalWorkspaceNav from './ProfessionalWorkspaceNav.jsx'

function StudentWorkspaceNav() {
  const { pathname } = useLocation()
  const materials = pathname === '/student/professionals/materials'
  const adding = pathname === '/student/professionals/add'
  return <nav className="management-nav" aria-label={t('Navegação dos meus profissionais')}>
    <Link to="/student/professionals" aria-current={!materials && !adding ? 'page' : undefined}>{t('Meus profissionais')}</Link>
    <Link to="/student/professionals/materials" aria-current={materials ? 'page' : undefined}>{t('Materiais')}</Link>
    <Link to="/student/professionals/add" aria-current={adding ? 'page' : undefined}>{t('Adicionar profissional')}</Link>
  </nav>
}

export default function ManagementLayout({ title, subtitle, backTo, action, audience = 'professional', children, className = '', nav }) {
  const navigation = nav === undefined ? (audience === 'student' ? <StudentWorkspaceNav /> : <ProfessionalWorkspaceNav />) : nav
  return <div className={`management-layout ${className}`.trim()}>
    <AppHeader title={title} subtitle={subtitle} backTo={backTo} action={action} className="management-header" />
    <div className={`management-workspace${navigation ? '' : ' management-workspace-solo'}`}>
      {navigation && <aside className="management-sidebar">{navigation}</aside>}
      <div className="management-content">{children}</div>
    </div>
  </div>
}
