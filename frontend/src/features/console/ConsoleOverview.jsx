import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import { createSupportRepository } from '../../lib/support.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { useConsoleAccess, AccessGate } from './ConsoleAccess.jsx'
import useConsoleResource from './useConsoleResource.js'
import { Alert, SectionBody, Loading, MetricCard, SectionTitle } from './ConsoleUI.jsx'

function WorkspaceLink({ to, icon, title, description, count }) {
  return <Link className="console-workspace-link" to={to}><span className="console-link-icon"><Icon name={icon} /></span><span><strong>{title}</strong><small>{description}</small></span>{count != null && <span className="console-link-count">{count}</span>}<Icon name="chevronRight" /></Link>
}

export default function ConsoleOverview() {
  const { userId, repo, allowed } = useConsoleAccess()
  const support = useMemo(() => createSupportRepository({ client: getBrowserSupabaseClient() }), [])
  const { data, error, busy, refresh } = useConsoleResource({ userId, allowed, resourceKey: 'overview', load: async () => {
    const [accounts, messages] = await Promise.allSettled([repo.overview(), support.overview()])
    return { accounts: accounts.status === 'fulfilled' ? accounts.value : null, messages: messages.status === 'fulfilled' ? messages.value : null }
  } })
  const accounts = data?.accounts, messages = data?.messages
  return <AccessGate allowed={allowed}><ConsoleShell userId={userId} allowed={allowed}><div className="cx-page-body">
    <div className="cx-page-head"><h1 className="cx-page-title">Central da plataforma</h1><p className="cx-page-sub">Acompanhe a operação e escolha o que precisa de atenção.</p></div>
    {error && <Alert onRetry={refresh}>{error}</Alert>}
    {busy ? <Loading label="Carregando visão geral…" /> : <>
      <section aria-label="Atendimento"><SectionTitle>Atendimento</SectionTitle>
        {!messages && <Alert onRetry={refresh}>Não foi possível carregar o resumo de mensagens.</Alert>}
        <SectionBody className="console-attention"><WorkspaceLink to="/console/support" icon="list" title="Mensagens dos usuários" description="Leia, responda e organize os chamados enviados à equipe." count={messages?.pendingCount} />
          {messages && <div className="console-summary-strip"><Link to="/console/support?status=unread"><strong>{messages.unreadCount}</strong> Não lidas</Link><Link to="/console/support?status=pending"><strong>{messages.pendingCount}</strong> Pendentes</Link><Link to="/console/support?status=answered"><strong>{messages.answeredCount}</strong> Respondidas</Link></div>}
        </SectionBody>
        <SectionBody><WorkspaceLink to="/console/faq" icon="clipboard" title="Perguntas frequentes" description="Organize as respostas disponíveis em Ajuda e suporte." /></SectionBody>
      </section>
      <section aria-label="Gestão da plataforma"><SectionTitle>Gestão da plataforma</SectionTitle>
        {!accounts ? <Alert onRetry={refresh}>Não foi possível carregar o resumo de contas.</Alert> : <div className="console-metrics"><MetricCard label="Usuários" value={accounts.userCount} sub={`+${accounts.newUsers7d || 0} nos últimos 7 dias`} /><MetricCard label="Profissionais" value={accounts.professionalCount} /><MetricCard label="Verificações pendentes" value={accounts.pendingVerificationCount || 0} /><MetricCard label="Contas suspensas" value={accounts.suspendedCount || 0} /></div>}
        <SectionBody><WorkspaceLink to="/console/users" icon="person" title="Usuários e contas" description="Consulte perfis, treinos, permissões e acesso." />
          <WorkspaceLink to="/console/professionals" icon="personCircle" title="Profissionais" description="Revise cadastros e gerencie verificações profissionais." />
          <WorkspaceLink to="/console/professionals?status=pending" icon="shield" title="Aguardando verificação" description="Confira os perfis que precisam de análise." count={accounts?.pendingVerificationCount} />
        </SectionBody>
      </section>
      <section aria-label="Laboratório de testes"><SectionTitle>Laboratório de testes</SectionTitle>
        <SectionBody><WorkspaceLink to="/console/laboratory" icon="sparkles" title="Laboratório de testes" description="Acesse as páginas experimentais e os testes de interface." /></SectionBody>
      </section>
    </>}
  </div></ConsoleShell></AccessGate>
}
