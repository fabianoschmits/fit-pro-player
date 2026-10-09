import { useState } from 'react'
import Dialog from '../../../components/Dialog.jsx'
import Icon from '../../../components/Icon.jsx'

export default function ContextActions({ label, items = [] }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="iconbtn professional-context-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="more" /></button>
    {open && <Dialog title={label} onClose={() => setOpen(false)} className="professional-context-sheet">
      <div className="professional-context-items">{items.map(item => <button type="button" key={item.id} disabled={item.disabled} data-destructive={!!item.destructive} onClick={() => { setOpen(false); item.onSelect?.() }}>{item.label}</button>)}</div>
    </Dialog>}
  </>
}
