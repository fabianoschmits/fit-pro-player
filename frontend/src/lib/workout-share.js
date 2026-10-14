export async function dataUrlToPngFile(dataUrl, filename = `treino-fpp-${Date.now()}.png`, fetchImpl = globalThis.fetch) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png')) {
    throw new Error('invalid-image')
  }
  const response = await fetchImpl(dataUrl)
  if (!response?.ok && response?.ok !== undefined) throw new Error('image-read-failed')
  const blob = await response.blob()
  return new File([blob], filename, { type: 'image/png' })
}

export async function shareWorkoutImage(dataUrl, {
  title = 'Meu treino no Fit Pro Player 💪',
  dialogTitle = 'Compartilhar treino',
  fileName = `treino-fpp-${Date.now()}.png`,
  capacitor,
  filesystem,
  directory,
  share,
  navigatorObject = globalThis.navigator,
  fetchImpl = globalThis.fetch,
  documentObject = globalThis.document,
} = {}) {
  const file = await dataUrlToPngFile(dataUrl, fileName, fetchImpl)

  if (capacitor?.isNativePlatform?.()) {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    const saved = await filesystem.writeFile({ path: fileName, data: base64, directory })
    await share.share({ title, url: saved.uri, dialogTitle })
    return { method: 'native' }
  }

  if (navigatorObject?.share && navigatorObject?.canShare?.({ files: [file] })) {
    await navigatorObject.share({ title, files: [file] })
    return { method: 'web' }
  }

  const anchor = documentObject.createElement('a')
  anchor.href = dataUrl
  anchor.download = fileName
  documentObject.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  return { method: 'download' }
}
