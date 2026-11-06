export const MAX_PHOTO_BYTES = 20 * 1024 * 1024

export function imageSignature(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if ([137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)) return 'image/png'
  const text = String.fromCharCode(...bytes.slice(0, 32))
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') return 'image/webp'
  if (text.slice(4, 8) === 'ftyp' && /hei[cfx]|mif1|msf1/.test(text.slice(8))) return 'image/heic'
  return null
}

export function fittedDimensions(width, height) {
  if (!Number.isFinite(width * height) || width < 1 || height < 1 || width * height > 60_000_000) throw new Error('Dimensões inválidas ou imagem muito grande. Use uma foto de até 60 megapixels.')
  const ratio = Math.min(1, 1920 / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}

export async function processProgressPhoto(file) {
  if (!file?.size || file.size > MAX_PHOTO_BYTES) throw new Error('Escolha uma imagem de até 20 MB.')
  const type = imageSignature(new Uint8Array(await file.slice(0, 32).arrayBuffer()))
  if (!type) throw new Error('Formato inválido. Escolha uma foto JPEG, PNG ou WebP.')
  const url = URL.createObjectURL(file)
  let image
  let canvas
  try {
    // Modern supported browsers apply EXIF orientation when decoding HTML images.
    image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = () => reject(new Error(type === 'image/heic'
        ? 'Este navegador não abre HEIC/HEIF. Exporte a foto como JPEG na galeria e tente novamente.'
        : 'Não foi possível abrir a imagem. Escolha outra foto.'))
      image.src = url
    })
    const { width, height } = fittedDimensions(image.naturalWidth, image.naturalHeight)
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Processamento de imagens indisponível neste dispositivo.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, 0, 0, width, height)
    // Re-encoding pixels strips all EXIF/GPS and never changes local anatomy.
    let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .9))
    if (!blob || !['image/webp', 'image/jpeg'].includes(blob.type)) blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92))
    if (!blob || blob.size > 6 * 1024 * 1024) throw new Error('Não foi possível comprimir a foto. Tente outra imagem.')
    return { blob, width, height, mime_type: blob.type, file_size: blob.size }
  } finally {
    URL.revokeObjectURL(url)
    if (image) { image.onload = null; image.onerror = null; image.src = '' }
    if (canvas) { canvas.width = 0; canvas.height = 0 }
  }
}
