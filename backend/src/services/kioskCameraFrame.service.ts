const FRAME_TTL_MS = 30000

let lastFrame: Buffer | null = null
let lastFrameAt = 0

export function storeCameraFrame(data: Buffer): void {
  if (!data.length) return
  lastFrame = data
  lastFrameAt = Date.now()
}

export function getCameraFrame(): Buffer | null {
  if (!lastFrame) return null
  if (Date.now() - lastFrameAt > FRAME_TTL_MS) {
    lastFrame = null
    return null
  }
  return lastFrame
}

export function clearCameraFrame(): void {
  lastFrame = null
  lastFrameAt = 0
}
