import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

self.onmessage = async event => {
  let detector
  let bitmap
  try {
    const { blob, base } = event.data
    const runtime = await FilesetResolver.forVisionTasks(`${base}wasm`, true)
    detector = await PoseLandmarker.createFromOptions(runtime, {
      baseOptions: { modelAssetPath: `${base}pose_landmarker_lite.task`, delegate: 'CPU' },
      runningMode: 'IMAGE', numPoses: 1, outputSegmentationMasks: false,
      minPoseDetectionConfidence: .65, minPosePresenceConfidence: .65,
    })
    bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    canvas.getContext('2d').drawImage(bitmap, 0, 0)
    const result = detector.detect(canvas)
    self.postMessage({ points: result.landmarks[0] || [] })
  } catch {
    self.postMessage({ points: [], unavailable: true })
  } finally {
    bitmap?.close()
    detector?.close()
  }
}
