import Link from './ManagementLink.jsx'
import { useLocation } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import AppHeader from './AppHeader.jsx'
import Icon from './Icon.jsx'
import ProfessionalWorkspaceNav from './ProfessionalWorkspaceNav.jsx'
import useManagementNavVisibility from './useManagementNavVisibility.js'

function StudentWorkspaceNav() {
  const navRef = useManagementNavVisibility()
  const { pathname } = useLocation()
  const materials = pathname === '/student/professionals/materials'
  const adding = pathname === '/student/professionals/add' || pathname.startsWith('/invite/')
  return <nav ref={navRef} className="management-nav" aria-label={t('Navegação dos meus profissionais')}>
    <Link to="/student/professionals" aria-current={!materials && !adding ? 'page' : undefined}><Icon name="person2" /><span>{t('Meus profissionais')}</span></Link>
    <Link to="/student/professionals/materials" aria-current={materials ? 'page' : undefined}><Icon name="clipboard" /><span>{t('Materiais')}</span></Link>
    <Link to="/student/professionals/add" aria-current={adding ? 'page' : undefined}><Icon name="personPlus" /><span>{t('Adicionar profissional')}</span></Link>
  </nav>
}

function getSceneryClass(pathname) {
  if (pathname.startsWith('/professional/invites') || pathname.startsWith('/invite/')) return 'invites-scenery page-scenery'
  if (pathname.startsWith('/professional/students')) return 'students-scenery page-scenery'
  if (pathname.startsWith('/professional/templates') || pathname.startsWith('/professional/programs')) return 'templates-scenery page-scenery'
  if (pathname.startsWith('/professional/profile') || pathname === '/professional-profile') return 'professional-profile-scenery page-scenery'
  if (pathname.startsWith('/student/professionals/materials')) return 'library-view page-scenery'
  if (pathname.startsWith('/student/professionals')) return 'student-professionals-scenery page-scenery'
  return ''
}

export default function ManagementLayout({ title, subtitle, backTo, action, audience = 'professional', children, className = '', nav }) {
  const { pathname } = useLocation()
  const sceneryClass = getSceneryClass(pathname)
  const navigation = nav === undefined ? (audience === 'student' ? <StudentWorkspaceNav /> : <ProfessionalWorkspaceNav />) : nav
  const home = audience === 'student' ? '/student/professionals' : '/professional'
  return <div className={`management-layout ${sceneryClass} ${className}`.trim()}>
    <header className="management-topbar">
      <Link className="management-brand" to={home}><span className="management-brand-mark"><Icon name={audience === 'student' ? 'personCircle' : 'clipboard'} /></span><span>{t(audience === 'student' ? 'Meus profissionais' : 'Área profissional')}<small>Fit Pro Player</small></span></Link>
      <Link className="management-return" to="/home" aria-label={t('Back to app')}><Icon name="chevronLeft" /><span>{t('Back to app')}</span></Link>
    </header>
    <div className={`management-workspace${navigation ? '' : ' management-workspace-solo'}`}>
      {navigation && <aside className="management-sidebar">{navigation}</aside>}
      <main className="management-main">
        <AppHeader title={title} subtitle={subtitle} backTo={backTo} action={action} className="management-header" />
        <div className="management-content">{children}</div>
      </main>
    </div>
  </div>
}
