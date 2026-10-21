import { useRef, useState } from 'react'
import Icon from '../../components/Icon.jsx'
import ConsoleShell from '../../features/console/ConsoleLayout.jsx'
import { AccessGate, useConsoleAccess } from '../../features/console/ConsoleAccess.jsx'
import './alternative-menus.css'
import './themes-materials.css'
import './themes-expression.css'

const themes = [
  { id: 'glass', title: 'Vidro refrativo', detail: 'A base atual, com placas de vidro unidas e bordas que distorcem o fundo.', material: 'Transparência e refração', icon: 'house', colors: ['#0f8b8d', '#98ddd4', '#edfaff'] },
  { id: 'carbon', title: 'Carbono', detail: 'Textura de equipamento, teclas elevadas e um recorte de cor.', material: 'Carbono e borracha', icon: 'dumbbell', colors: ['#20242b', '#b9fa43', '#797e8c'] },
  { id: 'track', title: 'Na pista', detail: 'Faixas de velocidade e peças angulares inspiradas no atletismo.', material: 'Pista e velocidade', icon: 'figureRun', colors: ['#e94c3a', '#f4efe2', '#272a2e'] },
  { id: 'court', title: 'Dentro da quadra', detail: 'Verde profundo, marcações de jogo e uma abertura em coluna.', material: 'Quadra e precisão', icon: 'target', colors: ['#1b6549', '#d0ef89', '#f6f2d8'] },
  { id: 'scoreboard', title: 'Placar', detail: 'Contraste de arena, detalhes digitais e sinais luminosos.', material: 'Luz e competição', icon: 'chart', colors: ['#161d1a', '#d9fa5c', '#ffc15a'] },
  { id: 'alloy', title: 'Liga metálica', detail: 'Metal escovado, encaixes mecânicos e um toque de dourado.', material: 'Metal e resistência', icon: 'shield', colors: ['#c3cbd0', '#303b45', '#dbb76a'] },
  { id: 'energy', title: 'Carga máxima', detail: 'Um arco elétrico de botões, com violeta e azul intenso.', material: 'Energia e expansão', icon: 'bolt', colors: ['#8c63ff', '#63b6ff', '#201641'] },
  { id: 'porcelain', title: 'Respira', detail: 'Superfícies claras e botões soltos para um ritmo mais leve.', material: 'Cerâmica e equilíbrio', icon: 'heart', colors: ['#f3f5ed', '#788d73', '#324e43'] },
  { id: 'tide', title: 'Maré atlética', detail: 'Camadas azuis, curvas aquáticas e ícones que sobem em sequência.', material: 'Água e movimento', icon: 'swim', colors: ['#123c56', '#4edacb', '#a2e8f0'] },
  { id: 'ignite', title: 'Modo competição', detail: 'Laranja de corrida, cortes diagonais e blocos prontos para a largada.', material: 'Impacto e atitude', icon: 'flame', colors: ['#ff752e', '#2b3035', '#f6dab4'] },
]

const items = [
  { id: 'plan', label: 'Plano', icon: 'calendar' },
  { id: 'start', label: 'Treinar', icon: 'dumbbell' },
  { id: 'stats', label: 'Evolução', icon: 'chart' },
  { id: 'more', label: 'Mais', icon: 'more' },
]

// Only the thin, masked rim uses displacement. The centre stays transparent and
// readable, and browsers without SVG backdrop filters retain the bevel + blur.
function GlassRefraction() {
  return <svg className="am-filter-defs" aria-hidden="true" focusable="false">
    <defs>
      <filter id="am-glass-refraction" x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.022 0.065" numOctaves="2" seed="8" result="texture" />
        <feGaussianBlur in="texture" stdDeviation="1.2" result="softTexture" />
        <feDisplacementMap in="SourceGraphic" in2="softTexture" scale="16" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  </svg>
}

function MenuDemo({ theme, index, open, onToggle, onClose, backdrop }) {
  const toggle = useRef(null)
  const [selection, setSelection] = useState({ id: null, count: 0, keyboard: false })
  const [keyboardToggle, setKeyboardToggle] = useState(false)
  const selected = items.find(item => item.id === selection.id)
  const panelId = `am-options-${theme.id}`
  const select = (event, id) => setSelection(current => ({ id, count: current.count + 1, keyboard: event.detail === 0 }))
  const escape = event => {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    onClose()
    toggle.current?.focus()
  }

  return <article className="am-demo" data-theme={theme.id} aria-labelledby={`am-heading-${theme.id}`} onKeyDown={escape}>
    <header className="am-demo-header">
      <div className="am-demo-heading">
        <span className="am-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        <div><h2 id={`am-heading-${theme.id}`}>{theme.title}</h2><p>{theme.detail}</p></div>
      </div>
      <span className="am-swatches" aria-label={theme.material} title={theme.material}>
        {theme.colors.map(color => <i key={color} style={{ background: color }} />)}
      </span>
    </header>
    <div className="am-stage" data-backdrop={backdrop}>
      <div className="am-scenery" aria-hidden="true" />
      <span className="am-stage-brand" aria-hidden="true"><img src="/brand-symbol.svg" alt="" /><span>Fit Pro<br /><b>Player</b></span></span>
      <span className="am-material" aria-hidden="true">{theme.material}</span>
      <div className={`am-menu${open ? ' is-open' : ''}${selection.keyboard || keyboardToggle ? ' is-keyboard' : ''}`} data-selected={selection.id || ''}>
        <button ref={toggle} type="button" className="am-toggle am-button" aria-expanded={open} aria-controls={panelId}
          aria-label={`${open ? 'Fechar' : 'Abrir'} menu ${theme.title}`} onClick={event => { setKeyboardToggle(event.detail === 0); onToggle() }}>
          <span className="am-glass-edge" aria-hidden="true" />
          <span className="am-icon" aria-hidden="true"><Icon name={theme.icon} /></span>
          <span className="am-label">{open ? 'Fechar' : 'Menu'}</span>
        </button>
        <div className="am-options" id={panelId} role="group" aria-label={`Ícones de ${theme.title}`} aria-hidden={!open} inert={!open}>
          {items.map((item, itemIndex) => <div className="am-slot" key={item.id} style={{ '--i': itemIndex + 1 }}>
            <button type="button" className="am-item am-button" data-item={item.id} aria-label={item.label} aria-pressed={selection.id === item.id}
              tabIndex={open ? 0 : -1} onClick={event => { setKeyboardToggle(false); select(event, item.id) }}>
              <span className="am-glass-edge" aria-hidden="true" />
              <span key={selection.id === item.id ? `icon-${selection.count}` : 'idle'} className={`am-icon${selection.id === item.id ? ' is-clicked' : ''}`} aria-hidden="true"><Icon name={item.icon} /></span>
              <span className="am-label">{item.label}</span>
              {selection.id === item.id && <span key={`wave-${selection.count}`} className="am-click-wave" aria-hidden="true" />}
            </button>
          </div>)}
        </div>
      </div>
      {!open && <span className="am-open-hint" aria-hidden="true"><Icon name="chevronLeft" />Toque para abrir</span>}
    </div>
    <footer className="am-demo-footer"><span className={`am-state${open ? ' is-open' : ''}`}><i />{open ? 'Aberto' : 'Fechado'}</span><span role="status" aria-live="polite">{open ? selected ? `${selected.label} selecionado` : 'Experimente os ícones' : 'Abra para experimentar'}</span></footer>
  </article>
}

export default function AlternativeMenus() {
  const { userId, allowed } = useConsoleAccess()
  const [expanded, setExpanded] = useState({})
  const [backdrop, setBackdrop] = useState('brand')
  const setAll = value => setExpanded(Object.fromEntries(themes.map(theme => [theme.id, value])))

  return <AccessGate allowed={allowed}>
    <ConsoleShell userId={userId} allowed={allowed} back="/console/laboratory" backLabel="Laboratório de testes">
      <div className="cx-page-body am-page">
        <GlassRefraction />
        <div className="am-intro"><div><h1 className="cx-page-title">Menus alternativos</h1><p className="cx-page-sub">Dez jeitos de dar movimento ao Fit Pro Player. Abra os menus e toque nos ícones para sentir cada versão, sem sair desta tela.</p></div><span className="am-count">10 <small>versões</small></span></div>
        <div className="am-toolbar" role="group" aria-label="Controles dos menus">
          <div className="am-toolbar-actions"><button type="button" onClick={() => setAll(true)}><Icon name="plus" />Abrir todos</button><button type="button" onClick={() => setAll(false)}><Icon name="minus" />Fechar todos</button></div>
          <div className="am-backdrops" role="group" aria-label="Fundo dos testes"><span>Fundo</span>{[{ id: 'brand', label: 'Original' }, { id: 'contrast', label: 'Colorido' }, { id: 'neutral', label: 'Neutro' }].map(option => <button key={option.id} type="button" aria-pressed={backdrop === option.id} onClick={() => setBackdrop(option.id)}>{option.label}</button>)}</div>
        </div>
        <div className="am-gallery">{themes.map((theme, index) => <MenuDemo key={theme.id} theme={theme} index={index} open={!!expanded[theme.id]} backdrop={backdrop}
          onToggle={() => setExpanded(current => ({ ...current, [theme.id]: !current[theme.id] }))}
          onClose={() => setExpanded(current => ({ ...current, [theme.id]: false }))} />)}</div>
      </div>
    </ConsoleShell>
  </AccessGate>
}
