import { useState } from 'react'
import { clearDiagnostics, readDiagnostics } from '../lib/diagnostics.js'
import { Button } from './ui.jsx'
import { t } from '../lib/i18n.js'
export default function DiagnosticsControls() {
  const [count,setCount]=useState(()=>readDiagnostics().length)
  const download=()=>{
    const blob=new Blob([JSON.stringify({app:'Fit Pro Player',events:readDiagnostics()},null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='fitproplayer-diagnostics.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <div className="offline-controls"><p className="muted small">{t('Diagnostics stay on this device and contain only error categories and timing measurements.')}</p><Button onClick={download}>{t('Export diagnostics')} ({count})</Button><Button onClick={()=>{clearDiagnostics();setCount(0)}}>{t('Clear diagnostics')}</Button></div>
}
