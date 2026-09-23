import { useState } from 'react'
import { useUI } from '../store/useUI.js'
import { ASSOCIATION_CHOICE } from '../lib/account-association.js'

export function openAccountAssociation({ conflict = false, onChoice }) {
  return useUI.getState().openSheet(close => <AccountAssociationSheet close={close} conflict={conflict} onChoice={onChoice} />, { locked: true })
}

export function AccountAssociationSheet({ close, conflict, onChoice }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const choose = async choice => {
    setBusy(true); setError('')
    try {
      await onChoice(choice)
      close()
    } catch (cause) {
      setError(cause.message || 'Não foi possível concluir a associação.')
      setBusy(false)
    }
  }
  return <>
    <h3>{conflict ? 'Escolha qual cópia manter' : 'Encontramos dados para associar'}</h3>
    <p className="muted">Nada será sobrescrito sem sua escolha. Seus dados anônimos continuam neste dispositivo.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <button type="button" className="lrow tap" disabled={busy} onClick={() => choose(ASSOCIATION_CHOICE.USE_DEVICE)}>
      <span className="lrow-m"><span className="lrow-t">Usar dados deste dispositivo</span><span className="lrow-s">Enviar esta cópia para a conta após sua confirmação.</span></span>
    </button>
    <button type="button" className="lrow tap" disabled={busy} onClick={() => choose(ASSOCIATION_CHOICE.USE_CLOUD)}>
      <span className="lrow-m"><span className="lrow-t">Usar dados da nuvem</span><span className="lrow-s">Preservar a cópia remota e manter o cache anônimo separado.</span></span>
    </button>
    <button type="button" className="lrow tap" disabled={busy} onClick={() => choose(ASSOCIATION_CHOICE.KEEP_SEPARATE)}>
      <span className="lrow-m"><span className="lrow-t">Manter separados</span><span className="lrow-s">Não importar nem sobrescrever nenhuma cópia.</span></span>
    </button>
  </>
}
