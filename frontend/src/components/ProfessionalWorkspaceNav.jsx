import { NavLink } from 'react-router-dom'
import { t } from '../lib/i18n.js'

const LINKS = [
  ['Visão geral', '/professional'],
  ['Alunos', '/professional/students'],
  ['Convites', '/professional/invites'],
  ['Programas', '/professional/programs'],
  ['Perfil', '/professional/profile'],
]

export default function ProfessionalWorkspaceNav() {
  return <nav className="professional-workspace-nav" aria-label={t('Navegação da área profissional')}>
    {LINKS.map(([label, to]) => <NavLink key={to} to={to} end={to === '/professional'}>{t(label)}</NavLink>)}
  </nav>
}
