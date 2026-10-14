import { Link } from 'react-router-dom'
import { getPrivacyConfig, isPrivacyConfigComplete, PRIVACY_DOCUMENT_VERSION } from '../lib/privacy-config.js'

const links = <p className="privacy-page-links"><Link to="/privacy">Aviso de Privacidade</Link><Link to="/terms">Termos de Uso</Link><Link to="/data-rights">Direitos dos titulares</Link></p>

function Shell({ title, children }) {
  const config = getPrivacyConfig()
  return <main className="privacy-page narrow">
    <header className="privacy-page-header"><a href="#/" aria-label="Voltar para o início">←</a><div><span>FIT PRO PLAYER</span><small>Documento v{PRIVACY_DOCUMENT_VERSION}</small></div></header>
    <h1>{title}</h1>
    {!isPrivacyConfigComplete(config) && <div className="privacy-config-warning" role="note">A configuração jurídica do controlador ainda precisa ser preenchida antes da publicação.</div>}
    {children}
    {links}
  </main>
}

function PrivacyNotice() {
  const c = getPrivacyConfig()
  return <Shell title="Aviso de Privacidade">
    <p>Este aviso explica como o Fit Pro Player coleta, utiliza, armazena e compartilha dados pessoais para oferecer planejamento, execução e acompanhamento de treinos.</p>
    <h2>Quem trata os dados</h2><p><strong>Controlador:</strong> {c.controllerName}<br /><strong>Canal de privacidade:</strong> {c.dpoEmail}<br /><strong>Endereço:</strong> {c.controllerAddress}</p>
    <h2>Dados tratados</h2><p>Podemos tratar nome, e-mail, autenticação, perfil, idade, altura, peso, objetivos, medidas corporais, histórico de treinos, convites, vínculos com profissionais, preferências, notificações, registros de suporte e dados técnicos necessários para segurança e funcionamento.</p>
    <p>Dados de saúde, medidas e objetivos podem ser dados pessoais sensíveis. O sistema aplica minimização, controle de acesso e separação entre a conta do aluno e as projeções autorizadas ao profissional.</p>
    <h2>Finalidades e bases</h2><p>As finalidades incluem criar e proteger a conta, sincronizar dados, executar treinos, manter histórico, permitir vínculos autorizados, responder solicitações, prevenir fraude e cumprir obrigações legais. A base legal aplicável deve ser confirmada pelo controlador para cada finalidade.</p>
    <h2>Compartilhamento e operadores</h2><p>{c.operators}</p><p>{c.transferSummary}</p>
    <h2>Privacidade e cookies</h2><p>Usamos armazenamento local e tecnologias necessárias para manter a sessão, proteger a conta e guardar preferências. No primeiro acesso, você pode aceitar ou personalizar as categorias opcionais de preferências, medição de uso e comunicações. A escolha fica salva no dispositivo e, quando houver conta, também na conta para sincronização entre dispositivos.</p>
    <h2>Retenção e segurança</h2><p>{c.retentionSummary}</p><p>Adotamos autenticação, RLS, isolamento por conta, cópias de conflito, exclusão autenticada e controles de acesso. Nenhuma medida técnica substitui a gestão contínua de incidentes e acessos.</p>
    <h2>Seus direitos</h2><p>Você pode solicitar confirmação, acesso, correção, informação sobre compartilhamento, portabilidade quando aplicável, eliminação, revogação de consentimentos e revisão de decisões automatizadas quando aplicável.</p>
  </Shell>
}

function Terms() {
  return <Shell title="Termos de Uso">
    <p>O Fit Pro Player é uma ferramenta de organização e acompanhamento de treinos. Ele não substitui avaliação, diagnóstico ou orientação de profissional habilitado.</p>
    <h2>Uso responsável</h2><p>Use cargas, exercícios e metas de acordo com sua condição. O usuário é responsável por manter credenciais seguras e por fornecer informações corretas.</p>
    <h2>Profissionais</h2><p>Profissionais devem acessar somente alunos vinculados e usar dados para as finalidades autorizadas. O compartilhamento não transforma o aplicativo em prontuário médico.</p>
    <h2>Conta e encerramento</h2><p>Você pode exportar seus dados e solicitar a exclusão da conta em Configurações. Alguns registros podem ser mantidos quando houver obrigação legal ou necessidade comprovada de defesa.</p>
  </Shell>
}

function Rights() {
  const { dpoEmail } = getPrivacyConfig()
  const href = dpoEmail.startsWith('PREENCHER') ? undefined : `mailto:${dpoEmail}?subject=Solicitação%20LGPD`
  return <Shell title="Direitos dos titulares">
    <p>Use este canal para solicitar confirmação, acesso, correção, portabilidade, eliminação, informação sobre compartilhamento ou revogação de consentimento.</p>
    <h2>Como solicitar</h2><ol><li>Informe o e-mail da conta e o direito solicitado.</li><li>Descreva os dados ou finalidade envolvidos.</li><li>Não envie senha, token ou dados de terceiros.</li></ol>
    {href ? <a className="btn" href={href}>Enviar solicitação por e-mail</a> : <p className="privacy-config-warning">O canal LGPD ainda não foi configurado pelo controlador.</p>}
    <h2>Segurança da solicitação</h2><p>Podemos confirmar sua identidade antes de fornecer dados ou alterar a conta. O pedido é gratuito e será tratado dentro dos prazos aplicáveis.</p>
  </Shell>
}

export default function PrivacyPages({ kind = 'privacy' }) {
  if (kind === 'terms') return <Terms />
  if (kind === 'rights') return <Rights />
  return <PrivacyNotice />
}
