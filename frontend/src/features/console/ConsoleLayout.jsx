import { Link, useLocation } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import useManagementNavVisibility from '../../components/useManagementNavVisibility.js'
import ConsoleNotifications from './ConsoleNotifications.jsx'
import './console.css'

const navigation = [
  { to: '/console', label: 'Visão geral', description: 'Resumo da operação', icon: 'chartLine', group: 'Plataforma' },
  { to: '/console/system', label: 'Sistema & Banco', description: 'Monitoramento, queries e logs de erro', icon: 'server', group: 'Plataforma' },
  { to: '/console/users', label: 'Usuários', description: 'Contas e permissões', icon: 'person', group: 'Plataforma' },
  { to: '/console/professionals', label: 'Profissionais', description: 'Perfis e verificações', icon: 'personCircle', group: 'Plataforma' },
  { to: '/console/support', label: 'Mensagens', description: 'Caixa de entrada da equipe', icon: 'list', group: 'Atendimento' },
  { to: '/console/faq', label: 'FAQ', description: 'Perguntas e respostas', icon: 'clipboard', group: 'Atendimento' },
  { to: '/console/laboratory', label: 'Laboratório de testes', description: 'Páginas experimentais e testes de interface', icon: 'sparkles', group: 'Testes' },
]

export default function ConsoleShell({ children, back, backLabel = 'Voltar', userId, allowed = false }) {
  const { pathname } = useLocation()
  const navRef = useManagementNavVisibility()
  return <div className="cx-shell console-workspace">
    <header className="console-topbar">
      <Link to="/console" className="console-brand"><span className="console-brand-mark"><Icon name="shield" /></span><span>Central da plataforma<small>Fit Pro Player</small></span></Link>
      <div className="console-topbar-actions"><ConsoleNotifications userId={userId} allowed={allowed} /><Link className="console-return" to="/more" aria-label="Voltar ao aplicativo"><Icon name="chevronLeft" /><span>Voltar ao aplicativo</span></Link></div>
    </header>
    <div className="console-frame">
      <aside className="console-sidebar">
        <nav ref={navRef} className="console-navigation" aria-label="Navegação da Central">
          {['Plataforma', 'Atendimento', 'Testes'].map(group => <div className="console-navigation-group" key={group}>
            <p>{group}</p>
            {navigation.filter(item => item.group === group).map(item => {
              const active = item.to === '/console' ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/')
              return <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}<small>{item.description}</small></span></Link>
            })}
          </div>)}
        </nav>
      </aside>
      <main className="console-main">
        {back && <Link className="console-back" to={back}><Icon name="chevronLeft" />{backLabel}</Link>}
        {children}
      </main>
    </div>
  </div>
}
