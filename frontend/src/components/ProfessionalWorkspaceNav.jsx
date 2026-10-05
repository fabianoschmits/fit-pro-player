import { Link, NavLink, useLocation } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import useManagementNavVisibility from './useManagementNavVisibility.js'

const LINKS = [
  ['Visão geral', '/professional'],
  ['Alunos', '/professional/students'],
  ['Convites', '/professional/invites'],
  ['Programas', '/professional/programs'],
  ['Perfil', '/professional/profile'],
]

export default function ProfessionalWorkspaceNav() {
  const { pathname } = useLocation()
  const navRef = useManagementNavVisibility()
  return <nav ref={navRef} className="professional-workspace-nav management-nav" aria-label={t('Navegação da área profissional')}>
    {LINKS.map(([label, to]) => to === '/professional/profile' && pathname === '/professional-profile'
      ? <Link key={to} to={to} aria-current="page">{t(label)}</Link>
      : <NavLink key={to} to={to} end={to === '/professional'}>{t(label)}</NavLink>)}
  </nav>
}
