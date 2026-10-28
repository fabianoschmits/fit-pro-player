import Icon from './Icon.jsx'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import useManagementNavVisibility from './useManagementNavVisibility.js'

const LINKS = [
  ['Visão geral', '/professional', 'house'],
  ['Alunos', '/professional/students', 'person2'],
  ['Modelos', '/professional/templates', 'clipboard'],
  ['Convites', '/professional/invites', 'envelope'],
  ['Perfil', '/professional/profile', 'personCircle'],
]

export default function ProfessionalWorkspaceNav() {
  const { pathname } = useLocation()
  const navRef = useManagementNavVisibility()
  return <nav ref={navRef} className="professional-workspace-nav management-nav" aria-label={t('Navegação da área profissional')}>
    {LINKS.map(([label, to, icon]) => to === '/professional/profile' && pathname === '/professional-profile'
      ? <Link key={to} to={to} aria-current="page"><Icon name={icon} /><span>{t(label)}</span></Link>
      : <NavLink key={to} to={to} end={to === '/professional'}><Icon name={icon} /><span>{t(label)}</span></NavLink>)}
  </nav>
}
