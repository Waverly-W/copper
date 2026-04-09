const NATIVE_CAPTURE_PROTOCOL = 'native-capture'

export function startClipboardMonitor ({
  enabled,
  intervalMs = 800,
  onTextCapture,
  onImageCapture,
  onFileCapture
}) {
  if (!enabled || !window.services) {
    return () => {}
  }

  const fallbackIntervalMs = Math.min(intervalMs, 220)
  const burstSampleCount = 8
  const burstSampleIntervalMs = 60
  let intervalTimer = null
  let burstTimer = null
  let remainingBurstSamples = 0

  const flushPendingClipboardCaptures = () => {
    try {
      const captures = window.services.consumePendingClipboardCaptures?.() || []
      captures.forEach((capture) => {
        if (capture.kind === 'file') {
          onFileCapture?.(capture.filePaths || [])
          return
        }

        if (capture.kind === 'image') {
          onImageCapture?.(capture.imageAsset || null)
          return
        }

        if (capture.kind === 'text') {
          onTextCapture?.(capture.text || '')
        }
      })
    } catch (error) {
      console.error('[copper] clipboard monitor error', error)
    }
  }

  const captureClipboardSnapshot = () => {
    window.services.captureClipboardToQueue?.()
    flushPendingClipboardCaptures()
  }

  const flushClipboardSnapshot = () => {
    flushPendingClipboardCaptures()
  }

  const runBurstSample = () => {
    burstTimer = null
    if (remainingBurstSamples <= 0) return

    remainingBurstSamples -= 1
    captureClipboardSnapshot()

    if (remainingBurstSamples > 0) {
      burstTimer = window.setTimeout(runBurstSample, burstSampleIntervalMs)
    }
  }

  const scheduleBurstSampling = () => {
    remainingBurstSamples = burstSampleCount
    if (burstTimer) return

    burstTimer = window.setTimeout(runBurstSample, burstSampleIntervalMs)
  }

  const handleClipboardChangeSignal = () => {
    flushPendingClipboardCaptures()
    if (window.services.getClipboardListenerStatus?.()?.protocol !== NATIVE_CAPTURE_PROTOCOL) {
      scheduleBurstSampling()
    }
  }

  const unsubscribeClipboardChanges =
    window.services.subscribeClipboardChanges?.(handleClipboardChangeSignal) ||
    (() => {})

  const listenerStatus = window.services.getClipboardListenerStatus?.()
  const heartbeatHandler = listenerStatus?.protocol === NATIVE_CAPTURE_PROTOCOL
    ? flushClipboardSnapshot
    : captureClipboardSnapshot

  const heartbeatIntervalMs = listenerStatus?.listening
    ? Math.max(intervalMs * 4, 3000)
    : fallbackIntervalMs

  heartbeatHandler()
  intervalTimer = window.setInterval(
    heartbeatHandler,
    heartbeatIntervalMs
  )

  return () => {
    unsubscribeClipboardChanges()
    if (intervalTimer) {
      window.clearInterval(intervalTimer)
    }
    if (burstTimer) {
      window.clearTimeout(burstTimer)
    }
  }
}
