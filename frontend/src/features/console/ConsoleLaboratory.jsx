import { Link } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import ConsoleShell from './ConsoleLayout.jsx'
import { AccessGate, useConsoleAccess } from './ConsoleAccess.jsx'
import { SectionBody, SectionTitle } from './ConsoleUI.jsx'

// Keep the test catalogue together so future experiments have one place to enter.
const experiments = [
  {
    to: '/motion-feedback',
    title: 'Laboratório de interações',
    description: 'Teste botões, fluxos, estados de feedback e recuperação do PWA.',
    icon: 'sparkles',
  },
  {
    to: '/tests/home-glass',
    title: 'Home Glass',
    description: 'Explore a home com transparência, desfoque e reflexos de vidro.',
    icon: 'house',
  },
]

export default function ConsoleLaboratory() {
  const { userId, allowed } = useConsoleAccess()
  return <AccessGate allowed={allowed}>
    <ConsoleShell userId={userId} allowed={allowed} back="/console" backLabel="Visão geral">
      <div className="cx-page-body">
        <div className="cx-page-head">
          <h1 className="cx-page-title">Laboratório de testes</h1>
          <p className="cx-page-sub">Um lugar para explorar as páginas experimentais e os próximos testes da plataforma.</p>
        </div>
        <section aria-label="Páginas de testes">
          <SectionTitle>Páginas disponíveis</SectionTitle>
          <SectionBody>
            {experiments.map(experiment => <Link key={experiment.to} to={experiment.to} className="console-workspace-link">
              <span className="console-link-icon"><Icon name={experiment.icon} /></span>
              <span><strong>{experiment.title}</strong><small>{experiment.description}</small></span>
              <Icon name="chevronRight" />
            </Link>)}
          </SectionBody>
        </section>
      </div>
    </ConsoleShell>
  </AccessGate>
}
