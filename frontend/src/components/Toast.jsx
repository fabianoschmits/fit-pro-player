import { useUI } from '../store/useUI.js'
import { FppToast } from './FppFeedback.jsx'
export default function Toast() {
  const msg = useUI(s => s.toastMsg)
  const tone = useUI(s => s.toastTone || 'neutral')
  return <FppToast message={msg} tone={tone} />
}
