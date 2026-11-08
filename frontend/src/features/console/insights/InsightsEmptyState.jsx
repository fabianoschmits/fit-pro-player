export default function InsightsEmptyState({ restricted = false }) {
  return <div className="fi-empty" role="status"><strong>{restricted ? 'Informações indisponíveis' : 'Dados insuficientes'}</strong><p>{restricted ? 'A experiência individual exige consentimento válido e acesso autorizado.' : 'Ainda não há uma amostra suficiente para este período e estes filtros. Isso não comprova ausência de dificuldades.'}</p></div>
}
