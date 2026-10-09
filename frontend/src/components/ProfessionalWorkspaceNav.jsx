import { Link, useLocation } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

const LINKS = [
  ['Gestão', '/professional', 'house'],
  ['Alunos', '/professional/students', 'person'],
  ['Programas', '/professional/programs', 'calendar'],
  ['Convites', '/professional/invites', 'link'],
]

export default function ProfessionalWorkspaceNav() {
  const { pathname } = useLocation()
  const selected = LINKS.slice(1).find(([, to]) => pathname === to || pathname.startsWith(`${to}/`))?.[1] || '/professional'
  return <nav className="professional-workspace-nav" aria-label={t('Navegação da área profissional')}>
    {LINKS.map(([label, to, icon]) => <Link key={to} to={to} aria-current={selected === to ? 'page' : undefined}><Icon name={icon} /><span>{t(label)}</span></Link>)}
  </nav>
}
