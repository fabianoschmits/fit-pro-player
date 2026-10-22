import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { detectInstallTarget, pwaInstaller } from '../lib/pwa-install.js'
import Icon from './Icon.jsx'
import { Button, Segmented } from './ui.jsx'
import './pwa-install-guide.css'

const PLATFORMS = [
  { value: 'ios', label: 'iPhone / iPad' },
  { value: 'android', label: 'Android' },
  { value: 'desktop', label: 'Computador' },
]

const DEFAULT_BROWSER = { ios: 'safari', android: 'chrome', desktop: 'chrome' }
const CHROME_HELP = 'https://support.google.com/chrome/answer/9658361?hl=pt-BR&co=GENIE.Platform%3D'

export const PLATFORM_LABELS = {
  ios: 'iPhone / iPad',
  android: 'Android',
  desktop: 'Computador',
}

export const GUIDES = {
  ios: [
    {
      id: 'safari', title: 'Safari', subtitle: 'Instale pela opção de compartilhar',
      steps: [
        <>Abra o Fit Pro Player no <strong>Safari</strong>.</>,
        <>Toque em <strong>Compartilhar</strong> (quadrado com uma seta para cima). Se necessário, abra <strong>Mais (…)</strong> primeiro.</>,
        <>Role as opções e toque em <strong>Adicionar à Tela de Início</strong>. Se a opção não estiver visível, procure em <strong>Editar Ações</strong>.</>,
        <>Se aparecer <strong>Abrir como App da Web</strong>, mantenha essa opção ativada. Toque em <strong>Adicionar</strong> e abra pelo novo ícone.</>,
      ],
      note: 'No iOS e iPadOS 26, o controle de compartilhar pode ficar dentro de Mais (…). Em versões anteriores, ele pode aparecer direto na barra do Safari.',
    },
    {
      id: 'chrome', title: 'Chrome', subtitle: 'Disponível em versões recentes do iOS e iPadOS',
      steps: [
        <>Abra o Fit Pro Player no <strong>Chrome</strong>.</>,
        <>Toque no botão <strong>Compartilhar</strong>, perto da barra de endereço.</>,
        <>Escolha <strong>Adicionar à tela inicial</strong>, confira o nome e toque em <strong>Adicionar</strong>.</>,
        <>Abra o Fit Pro Player pelo ícone na tela inicial.</>,
      ],
      note: 'Essa opção depende da versão do Chrome e do iOS/iPadOS (16.4 ou posterior). Se ela não aparecer, abra o mesmo endereço no Safari e siga os passos acima.',
      source: CHROME_HELP + 'iOS',
    },
    {
      id: 'other', title: 'Edge, Firefox, Brave, Opera e outros', subtitle: 'Use Compartilhar ou continue pelo Safari',
      steps: [
        <>Abra o menu do navegador e procure <strong>Compartilhar</strong>.</>,
        <>Se houver <strong>Adicionar à Tela de Início</strong>, selecione essa opção e confirme em <strong>Adicionar</strong>.</>,
        <>Se a opção não existir, copie o endereço, abra no <strong>Safari</strong> e siga o guia do Safari.</>,
      ],
      note: 'A instalação pelo botão desta página não está disponível no iPhone ou iPad. O recurso de adicionar à tela inicial depende do navegador e da versão do sistema.',
    },
  ],
  android: [
    {
      id: 'chrome', title: 'Chrome e Brave', subtitle: 'Instale pelo botão desta página ou pelo menu',
      steps: [
        <>Abra o Fit Pro Player no navegador e toque no menu <strong>⋮</strong>.</>,
        <>No Chrome, procure <strong>Instalar e criar atalho</strong> e depois <strong>Instalar</strong>. Em outras versões ou no Brave, pode aparecer <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</>,
        <>Confirme a instalação. Abra o Fit Pro Player pelo ícone na tela inicial ou na lista de aplicativos.</>,
      ],
      note: 'Se o navegador oferecer apenas Criar atalho, ele pode criar um ícone que abre em uma aba, sem instalar o app em uma janela própria.',
      source: CHROME_HELP + 'Android',
    },
    {
      id: 'samsung', title: 'Samsung Internet', subtitle: 'Adicione pela barra ou pelo menu',
      steps: [
        <>Abra o Fit Pro Player no <strong>Samsung Internet</strong>.</>,
        <>Toque no ícone <strong>+</strong> da barra, se aparecer. Ou abra o menu <strong>☰</strong> e escolha <strong>Adicionar página a</strong> e <strong>Tela inicial</strong>.</>,
        <>Confirme em <strong>Adicionar</strong> ou <strong>Instalar</strong>, conforme a opção exibida, e abra pelo novo ícone.</>,
      ],
      note: 'As opções variam entre versões. Se a confirmação mencionar apenas um atalho, o ícone poderá abrir o site no navegador.',
    },
    {
      id: 'edge', title: 'Microsoft Edge', subtitle: 'Procure a opção de adicionar ao telefone',
      steps: [
        <>Abra o Fit Pro Player no <strong>Edge</strong> e toque no menu <strong>…</strong> ou <strong>☰</strong>.</>,
        <>Procure <strong>Adicionar ao telefone</strong>, <strong>Adicionar à tela inicial</strong> ou <strong>Instalar</strong>.</>,
        <>Confirme a opção oferecida pelo navegador e abra pelo ícone criado.</>,
      ],
      note: 'O nome e o resultado variam pela versão: pode ser um app ou um atalho que abre no navegador. Se não houver essa opção, use o Chrome.',
    },
    {
      id: 'firefox', title: 'Firefox', subtitle: 'Use a opção Instalar do menu',
      steps: [
        <>Abra o Fit Pro Player no <strong>Firefox</strong> e toque no menu <strong>⋮</strong>.</>,
        <>Toque em <strong>Instalar</strong>. Dependendo da versão, a opção pode se chamar <strong>Adicionar à tela inicial</strong>.</>,
        <>Confirme em <strong>Adicionar à tela inicial</strong> ou <strong>Adicionar automaticamente</strong>, se solicitado.</>,
        <>Abra o Fit Pro Player pelo ícone na tela inicial.</>,
      ],
      source: 'https://support.mozilla.org/en-US/kb/use-web-apps-firefox-android',
    },
    {
      id: 'opera', title: 'Opera', subtitle: 'Adicione um ícone à tela inicial',
      steps: [
        <>Abra o Fit Pro Player no <strong>Opera</strong> e toque no menu à direita da barra de endereço.</>,
        <>Escolha <strong>Adicionar a</strong> e depois <strong>Tela inicial</strong>.</>,
        <>Confirme em <strong>Adicionar</strong> e abra pelo ícone criado.</>,
      ],
      note: 'Essa opção pode criar apenas um atalho que abre no navegador. Para instalar como app, use o Chrome ou outro navegador que ofereça Instalar.',
    },
    {
      id: 'other', title: 'Outro navegador no Android', subtitle: 'Confira as opções do menu',
      steps: [
        <>Abra o menu do navegador e procure <strong>Instalar</strong>, <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</>,
        <>Siga a confirmação exibida e abra pelo novo ícone.</>,
        <>Se a opção não aparecer, abra o endereço no <strong>Chrome</strong> e siga o guia dele.</>,
      ],
      note: 'Adicionar um favorito ou criar um atalho nem sempre instala um app. Alguns ícones apenas abrem uma aba do navegador.',
    },
  ],
  desktop: [
    {
      id: 'chrome', title: 'Chrome e Brave', subtitle: 'Windows, macOS e Linux',
      steps: [
        <>Abra o Fit Pro Player e procure o ícone de <strong>Instalar</strong> na barra de endereço.</>,
        <>Se ele não aparecer, no Chrome abra <strong>⋮</strong>, <strong>Transmitir, salvar e compartilhar</strong> e <strong>Instalar esta página como um app</strong>. No Brave, procure a opção <strong>Instalar</strong> no menu.</>,
        <>Confirme em <strong>Instalar</strong> e abra o Fit Pro Player pela lista de aplicativos do sistema.</>,
      ],
      note: 'No Linux, o Chrome é uma opção para instalar o app. Criar um marcador ou um atalho comum não equivale a instalar em uma janela de app.',
      source: CHROME_HELP + 'Desktop',
    },
    {
      id: 'edge', title: 'Microsoft Edge', subtitle: 'Windows, macOS e Linux',
      steps: [
        <>Abra o Fit Pro Player no <strong>Edge</strong>. Se houver um ícone de instalação na barra de endereço, clique nele.</>,
        <>Ou abra <strong>…</strong>, <strong>Mais ferramentas</strong>, <strong>Aplicativos</strong> e <strong>Instalar este site como um aplicativo</strong>. Em algumas versões, <strong>Aplicativos</strong> aparece direto no menu.</>,
        <>Confirme em <strong>Instalar</strong> e escolha as opções de acesso oferecidas pelo sistema.</>,
      ],
      note: 'O Edge também permite instalar no Linux. Os nomes e a posição das opções podem variar conforme a versão.',
    },
    {
      id: 'safari', title: 'Safari no Mac', subtitle: 'Requer macOS Sonoma 14 ou posterior',
      steps: [
        <>Abra o Fit Pro Player no <strong>Safari</strong>.</>,
        <>Na barra de menus do Mac, escolha <strong>Arquivo</strong> e <strong>Adicionar ao Dock</strong>. A opção também pode aparecer no menu <strong>Compartilhar</strong>.</>,
        <>Confira o nome, clique em <strong>Adicionar</strong> e abra pelo ícone no Dock ou na pasta Aplicativos.</>,
      ],
      note: 'Em versões anteriores do macOS, use o Chrome ou o Edge para instalar. Salvar um favorito no Safari não cria um app.',
      source: 'https://support.apple.com/pt-br/104996',
    },
    {
      id: 'firefox', title: 'Firefox', subtitle: 'Apps web no Windows, com restrições por versão',
      steps: [
        <>No <strong>Windows</strong>, use o Firefox <strong>143 ou posterior</strong>. Se foi instalado pela <strong>Microsoft Store</strong>, use a versão <strong>150 ou posterior</strong>.</>,
        <>Abra o Fit Pro Player e clique no botão de <strong>apps web</strong> na barra de endereço.</>,
        <>Confira o nome e confirme a criação do app. Abra pelo atalho criado no Windows.</>,
      ],
      note: 'No macOS e no Linux, o Firefox não oferece esse recurso. Use o Chrome ou o Edge; no Mac, também é possível usar o Safari no macOS 14 ou posterior. Um favorito do Firefox continua abrindo no navegador.',
      source: 'https://support.mozilla.org/en-US/kb/web-apps-firefox-windows',
    },
    {
      id: 'opera', title: 'Opera', subtitle: 'As opções dependem da versão',
      steps: [
        <>Abra o Fit Pro Player e procure <strong>Instalar</strong> na barra de endereço ou no menu do navegador.</>,
        <>Se a opção estiver disponível, confirme a instalação e abra pelo ícone criado.</>,
        <>Se aparecer apenas a opção de criar atalho, ou nenhuma opção, use o <strong>Chrome</strong> ou o <strong>Edge</strong> para instalar como app.</>,
      ],
      note: 'Um atalho comum pode abrir o site em uma aba do navegador, sem uma janela própria de app.',
    },
    {
      id: 'other', title: 'Outro navegador no computador', subtitle: 'Procure a opção de instalar o site',
      steps: [
        <>Procure um ícone de instalação na barra de endereço ou <strong>Instalar app</strong> no menu do navegador.</>,
        <>Se o navegador oferecer a instalação, confirme e abra pelo ícone criado.</>,
        <>Se não houver suporte, use o <strong>Chrome</strong> ou o <strong>Edge</strong>. No Mac com macOS 14 ou posterior, você também pode usar o <strong>Safari</strong>.</>,
      ],
      note: 'Criar um favorito ou atalho pode facilitar o acesso, mas nem sempre cria um app com janela própria.',
    },
  ],
}

export function installStatus({ installed, canInstall, status }) {
  if (installed) return ['Fit Pro Player instalado', 'Use o ícone na tela inicial, no Dock ou na lista de aplicativos para abrir.', 'checkCircle']
  if (status === 'prompting') return ['Confirme no navegador', 'A janela de instalação está aberta. Confirme ou cancele para continuar.', 'info']
  if (status === 'accepted') return ['Instalação autorizada', 'Aguarde o navegador concluir. Depois, procure o ícone do Fit Pro Player.', 'info']
  if (status === 'dismissed') return ['Instalação cancelada', 'Você pode seguir os passos abaixo ou tentar novamente quando o navegador oferecer a instalação.', 'info']
  if (status === 'error') return ['Não foi possível iniciar a instalação', 'Use o menu do navegador e siga o passo a passo abaixo.', 'info']
  if (canInstall) return ['Instalação disponível', 'Use o botão abaixo ou siga os passos do seu navegador.', 'download']
  return ['Instale pelo menu do navegador', 'O botão de instalação aparece quando o navegador oferece esse recurso. Você também pode seguir o guia abaixo.', 'info']
}

export function BrowserGuide({ guide, suggested }) {
  const [open, setOpen] = useState(suggested)
  return <details className="pwa-browser-guide" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>
      <span className="pwa-browser-copy"><strong>{guide.title}</strong><span>{guide.subtitle}</span></span>
      {suggested && <span className="pwa-browser-suggested">Sugerido</span>}
      <Icon name="chevronDown" className="pwa-browser-chevron" />
    </summary>
    <div className="pwa-browser-content">
      <ol>{guide.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
      {guide.note && <p className="pwa-browser-note">{guide.note}</p>}
      {guide.source && <a className="pwa-browser-source" href={guide.source} target="_blank" rel="noreferrer">Ajuda oficial do navegador <span className="pwa-link-context">(abre em outra aba)</span></a>}
    </div>
  </details>
}

export default function PwaInstallGuide() {
  const [target] = useState(() => detectInstallTarget())
  const [platform, setPlatform] = useState(target.platform)
  const snapshot = useSyncExternalStore(pwaInstaller.subscribe, pwaInstaller.getSnapshot, pwaInstaller.getSnapshot)
  const deviceLabelId = useId()
  const [statusTitle, statusDescription, statusIcon] = installStatus(snapshot)
  const browsers = GUIDES[platform]
  const detectedBrowser = browsers.some(guide => guide.id === target.browser) ? target.browser : 'other'
  const suggestedBrowser = platform === target.platform ? detectedBrowser : DEFAULT_BROWSER[platform]
  const prompting = snapshot.status === 'prompting'

  useEffect(() => { pwaInstaller.start() }, [])

  return <div className="pwa-install-guide">
    <header className="pwa-install-heading">
      <span className="pwa-install-icon"><Icon name="download" /></span>
      <div><h3>Instale o Fit Pro Player</h3><p>Acesse pelo ícone da tela inicial ou do computador. Nos navegadores compatíveis, o Fit Pro Player abre em uma janela de app.</p></div>
    </header>

    <div className="pwa-install-status" role="status" aria-live="polite" aria-atomic="true" data-installed={snapshot.installed ? 'true' : 'false'}>
      <Icon name={statusIcon} />
      <div><strong>{statusTitle}</strong><p>{statusDescription}</p></div>
    </div>
    {!snapshot.installed && (snapshot.canInstall || prompting) && <Button
      variant="primary" icon="download" className="pwa-install-button" activation="immediate"
      disabled={prompting} aria-busy={prompting || undefined}
      onClick={() => { void pwaInstaller.install() }}
    >{prompting ? 'Confirme no navegador…' : 'Instalar Fit Pro Player'}</Button>}

    <div className="pwa-platform-picker" role="group" aria-labelledby={deviceLabelId}>
      <p id={deviceLabelId}>Escolha seu dispositivo</p>
      <Segmented className="pwa-platform-segmented" options={PLATFORMS} value={platform} onChange={setPlatform} />
    </div>
    <p className="pwa-platform-hint">Selecionamos um guia pelo dispositivo e navegador. Você pode consultar as outras opções.</p>

    <div className="pwa-browser-list">
      {browsers.map(guide => <BrowserGuide key={`${platform}-${guide.id}`} guide={guide} suggested={guide.id === suggestedBrowser} />)}
    </div>

    <aside className="pwa-install-tips" aria-label="Dicas de instalação">
      <div><Icon name="lightbulb" /><strong>Não encontrou a opção?</strong></div>
      <ul>
        <li>Se abriu pelo Instagram, WhatsApp ou outro app, use o menu para <strong>abrir no navegador</strong> ou copie o endereço para o Safari, Chrome ou Edge.</li>
        <li>Use uma janela normal. A instalação pode não aparecer no modo anônimo ou privado.</li>
        <li>Atualize o navegador. Os nomes e a posição dos menus variam conforme o dispositivo e a versão.</li>
        <li>Se já instalou, procure o ícone na tela inicial ou na lista de aplicativos. Ao abrir pelo navegador, o botão pode não aparecer.</li>
      </ul>
    </aside>
  </div>
}
