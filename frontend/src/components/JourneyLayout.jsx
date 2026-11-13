import { useEffect, useRef } from 'react';
import BodyMap from './BodyMap.jsx';
import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';
import '../account-journey.css';

export default function JourneyLayout({ children = undefined, title = undefined, description = undefined, step = undefined, total = undefined, onBack = undefined, aside = undefined, variant = 'default' }) {
  const heading = useRef(null);
  useEffect(() => {
    if (!heading.current) return;
    heading.current.focus({ preventScroll: true });
    const sheet = heading.current.closest('.sheet');
    if (sheet) sheet.scrollTo({ top: 0, behavior: 'instant' });
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [title]);
  const hasProgress = Number.isFinite(step) && Number.isFinite(total) && total > 0;
  return <section className={`fpp-journey fpp-journey--${variant}`}>
    <div className="fpp-journey__frame">
      <header className="fpp-journey__header">
        <img src="/fpp-wordmark.svg" alt="Fit Pro Player" className="auth-brand-logo fpp-journey__logo" width="150" height="48" />
        {onBack && <button type="button" className="fpp-journey__back" onClick={onBack}><Icon name="chevronLeft" />{t('Voltar')}</button>}
      </header>
      <div className={`fpp-journey__body${aside === false ? ' fpp-journey__body--single' : ''}`}>
        {aside !== false && <aside className="fpp-journey__aside">{aside || <>
          <div className="fpp-journey__brand-copy"><p className="journey-eyebrow">Fit Pro Player</p><p className="fpp-journey__brand-title">{t('Treino com direção. Evolução com você.')}</p><p>{t('Seu plano, seu histórico e quem acompanha sua evolução. Tudo no mesmo lugar.')}</p></div>
          <div className="fpp-journey__anatomy" aria-hidden="true"><BodyMap decorative view="front" load={{ chest: 12, quadriceps: 12, deltoids: 8, biceps: 6 }} /><span className="fpp-journey__anatomy-caption">{t('Cada treino conta.')}</span></div>
        </>}</aside>}
        <div className="fpp-journey__content">
          {hasProgress && <div className="fpp-journey__progress"><span>{t('Etapa')} {step} / {total}</span><progress aria-label={t('Progresso da configuração')} max={total} value={Math.min(total, Math.max(0, step))} /></div>}
          {(title || description) && <div className="fpp-journey__heading">{title && <h1 ref={heading} tabIndex={-1}>{title}</h1>}{description && <p>{description}</p>}</div>}
          {children}
        </div>
      </div>
      <footer className="fpp-journey__footer"><span>Fit Pro Player</span><nav aria-label={t('Informações legais')}><a href="#/privacy" target="_blank" rel="noreferrer">{t('Privacidade')}</a><a href="#/terms" target="_blank" rel="noreferrer">{t('Termos')}</a><a href="#/data-rights" target="_blank" rel="noreferrer">{t('Seus direitos')}</a></nav></footer>
    </div>
  </section>;
}
