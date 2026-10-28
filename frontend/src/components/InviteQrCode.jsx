import { useMemo } from 'react'
import QRCode from 'qrcode'

// Generate locally: invitation URLs never leave the browser for image generation.
export default function InviteQrCode({ value }) {
  const qr = useMemo(() => {
    try { return QRCode.create(value, { errorCorrectionLevel: 'M' }).modules }
    catch { return null }
  }, [value])
  if (!qr) return null
  const path = []
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
    if (qr.get(y, x)) path.push(`M${x + 4} ${y + 4}h1v1h-1z`)
  }
  return <svg className="management-invite-qr" role="img" aria-label="QR code do convite" viewBox={`0 0 ${qr.size + 8} ${qr.size + 8}`} shapeRendering="crispEdges">
    <rect width="100%" height="100%" fill="#fff" /><path d={path.join('')} fill="#000" />
  </svg>
}
