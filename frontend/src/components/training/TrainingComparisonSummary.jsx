import { t } from '../../lib/i18n.js'
import { fmtNum } from '../../lib/format.js'

const display = value => value == null ? '—' : fmtNum(value)

export default function TrainingComparisonSummary({ comparison }) {
  const { summary, hasAdjusted } = comparison
  const showExecution = hasAdjusted && summary.adjustedSets > 0 && Number.isFinite(summary.percent)
  return <section className="tc-summary" aria-label={t('Resumo do treino')}>
    <div className="tc-summary-heading"><h2>{t('Resumo do treino')}</h2>{comparison.flexApplied && <span className="tc-flex">{t('FPP Flex aplicado')}</span>}</div>
    <table>
      <caption className="sr-only">{t('Resumo do treino')}</caption>
      <thead><tr><th scope="col"><span className="sr-only">{t('Resumo do treino')}</span></th><th scope="col">{t('Original')}</th><th scope="col">{t('Ajustado')}</th><th scope="col">{t('Realizado')}</th></tr></thead>
      <tbody>
        <tr><th scope="row">{t('Exercícios')}</th><td>{display(summary.plannedExercises)}</td><td>{display(summary.adjustedExercises)}</td><td>{display(summary.actualExercises)}</td></tr>
        <tr><th scope="row">{t('Séries de trabalho')}</th><td>{display(summary.plannedSets)}</td><td>{display(summary.adjustedSets)}</td><td>{display(summary.actualSets)}</td></tr>
      </tbody>
    </table>
    {showExecution ? <>
      <p className="tc-execution" data-comparison-execution><span>{t('Execução das séries')}</span><strong>{fmtNum(summary.percent)}%</strong></p>
      <p className="tc-completion-context">{t('{0} de {1} séries ajustadas concluídas.', fmtNum(summary.actualSets), fmtNum(summary.adjustedSets))}</p>
    </> : <p className="tc-completion-context">{t('Sem referência planejada')}</p>}
  </section>
}
