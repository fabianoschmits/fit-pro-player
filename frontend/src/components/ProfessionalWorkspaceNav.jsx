import { NavLink } from 'react-router-dom'

const LINKS = [
  ['Visão geral', '/professional'],
  ['Alunos', '/professional/students'],
  ['Convites', '/professional/invites'],
  ['Programas', '/professional/programs'],
]

export default function ProfessionalWorkspaceNav() {
  return <nav className="professional-workspace-nav" aria-label="Navegação da área profissional">
    {LINKS.map(([label, to]) => <NavLink key={to} to={to} end={to === '/professional'}>{label}</NavLink>)}
  </nav>
}
