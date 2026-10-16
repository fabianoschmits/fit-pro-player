import { useEffect, useRef, useState } from 'react'
import { useUI } from '../store/useUI.js'
import { ASSOCIATION_CHOICE } from '../lib/account-association.js'
import { Button } from './ui.jsx'

const choices = [
  { value: ASSOCIATION_CHOICE.USE_DEVICE, title: 'Usar dados deste dispositivo', subtitle: 'Enviar esta cópia para a conta após sua confirmação.' },
  { value: ASSOCIATION_CHOICE.USE_CLOUD, title: 'Usar dados da nuvem', subtitle: 'Preservar a cópia remota e manter o cache anônimo separado.' },
  { value: ASSOCIATION_CHOICE.KEEP_SEPARATE, title: 'Manter separados', subtitle: 'Não importar nem sobrescrever nenhuma cópia.' },
]
const choiceLabel = (title, subtitle) => <span className="lrow-m"><span className="lrow-t">{title}</span><span className="lrow-s">{subtitle}</span></span>

export function openAccountAssociation({ conflict = false, onChoice }) {
  return useUI.getState().openSheet(close => <AccountAssociationSheet close={close} conflict={conflict} onChoice={onChoice} />, { locked: true })
}

export function AccountAssociationSheet({ close, conflict, onChoice }) {
  const [pendingChoice, setPendingChoice] = useState(null)
  const [error, setError] = useState('')
  const operation = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const choose = async choice => {
    if (operation.current) return false
    operation.current = true
    setPendingChoice(choice); setError('')
    try {
      const result = await onChoice(choice)
      if (!mounted.current) return false
      if (result === false) { operation.current = false; setPendingChoice(null); return false }
      return choice
    } catch (cause) {
      operation.current = false
      if (mounted.current) { setError(cause.message || 'Não foi possível concluir a associação.'); setPendingChoice(null) }
      throw cause
    }
  }
  return <>
    <h3>{conflict ? 'Escolha qual cópia manter' : 'Encontramos dados para associar'}</h3>
    <p className="muted">Nada será sobrescrito sem sua escolha. Seus dados anônimos continuam neste dispositivo.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {choices.map(choice => <Button key={choice.value} appearance="custom" className="lrow tap"
      disabled={pendingChoice != null && pendingChoice !== choice.value}
      onAction={() => choose(choice.value)} onSuccess={() => { if (mounted.current) close() }}
      loadingLabel={choiceLabel(choice.title, 'Associando…')}
      successLabel={choiceLabel(choice.title, 'Associação concluída')}
      errorLabel={choiceLabel(choice.title, 'Tentar novamente')}>
      {choiceLabel(choice.title, choice.subtitle)}
    </Button>)}
  </>
}
