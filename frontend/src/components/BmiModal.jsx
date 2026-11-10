import { useState } from 'react'
import Icon from './Icon.jsx'
import { BMI_CATEGORIES, calculateBmi, getBmiDetails } from '../lib/bmi.js'
import { toDisplayMass } from '../lib/mass.js'
import { fmtNum } from '../lib/format.js'
import './bmi-modal.css'

export default function BmiModal({ bmi, heightCm, weightKg, unit = 'kg', close }) {
  const details = getBmiDetails(bmi, heightCm)
  const displayWeight = weightKg ? fmtNum(toDisplayMass(weightKg, unit)) : '--'

  return (
    <div className="bmi-modal-sheet" role="dialog" aria-modal="true" aria-label="Informações sobre seu IMC">
      <div className="bmi-modal-header">
        <div className="bmi-modal-title-group">
          <span className="bmi-modal-kicker">Composição Corporal</span>
          <h2 className="bmi-modal-title">Índice de Massa Corporal (IMC)</h2>
        </div>
      </div>

      <div className="bmi-modal-hero">
        <div className="bmi-modal-hero-val-wrap">
          <span className="bmi-modal-hero-val">
            {bmi ? bmi.toFixed(1).replace('.', ',') : '--'}
          </span>
          <span className="bmi-modal-hero-unit">kg/m²</span>
        </div>
        <div className="bmi-modal-hero-status-pill" style={{ backgroundColor: details?.badgeBg, color: details?.color, borderColor: `color-mix(in srgb, ${details?.color || 'var(--label-2)'} 26%, transparent)` }}>
          <span className="bmi-modal-dot" style={{ backgroundColor: details?.color }} aria-hidden="true" />
          <span>{details?.label || 'Em análise'}</span>
        </div>
      </div>

      <div className="bmi-modal-summary-box">
        <p className="bmi-modal-summary-highlight">{details?.summary}</p>
        <p className="bmi-modal-summary-text">{details?.evaluation}</p>
      </div>

      {details?.idealWeightMin && details?.idealWeightMax && (
        <div className="bmi-modal-targets-card">
          <div className="bmi-modal-target-item">
            <span className="bmi-modal-target-label">Seu peso atual</span>
            <strong className="bmi-modal-target-value">{displayWeight} {unit}</strong>
          </div>
          <div className="bmi-modal-target-divider" />
          <div className="bmi-modal-target-item">
            <span className="bmi-modal-target-label">Faixa de peso ideal (IMC 18,5 - 24,9)</span>
            <strong className="bmi-modal-target-value highlight">
              {fmtNum(toDisplayMass(details.idealWeightMin, unit))} a {fmtNum(toDisplayMass(details.idealWeightMax, unit))} {unit}
            </strong>
          </div>
        </div>
      )}

      <div className="bmi-modal-section">
        <h4 className="bmi-modal-section-title">
          <Icon name="sparkles" className="bmi-modal-section-icon" />
          O que você pode fazer para evoluir:
        </h4>
        <p className="bmi-modal-section-desc">{details?.recommendation}</p>
      </div>

      <div className="bmi-modal-section">
        <h4 className="bmi-modal-section-title">
          <Icon name="info" className="bmi-modal-section-icon" />
          Entenda as faixas de IMC:
        </h4>
        <div className="bmi-modal-table">
          {BMI_CATEGORIES.map(cat => {
            const isCurrent = details?.category?.key === cat.key
            return (
              <div
                key={cat.key}
                className={`bmi-modal-table-row ${isCurrent ? 'is-current' : ''}`}
              >
                <div className="bmi-modal-table-cat">
                  <span className="bmi-modal-dot" style={{ backgroundColor: cat.color }} />
                  <span className="bmi-modal-cat-name">{cat.label}</span>
                  {isCurrent && <span className="bmi-modal-current-badge">Você</span>}
                </div>
                <div className="bmi-modal-table-range">
                  {cat.min === 0 ? `< ${cat.max}` : cat.max === Infinity ? `≥ ${cat.min}` : `${cat.min} - ${cat.max}`}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bmi-modal-disclaimer">
        <small>
          <strong>Importante para quem treina:</strong> O IMC é um indicador geral de saúde adotado pela Organização Mundial da Saúde (OMS). Praticantes de musculação com alto volume de massa muscular podem apresentar IMC classificado como &quot;sobrepeso&quot; mesmo tendo baixo percentual de gordura. Use sempre em conjunto com suas fotos e medidas corporais no Fit Pro Player.
        </small>
      </div>

      <div className="bmi-modal-actions">
        <button type="button" className="btn btn-primary tap" onClick={close}>
          Entendi, continuar
        </button>
      </div>
    </div>
  )
}

