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

  let lastSignature = ''
  let lastDebugSignature = ''

  const hasFileishFormats = (formats) => {
    return (formats || []).some((format) => {
      const loweredFormat = String(format || '').toLowerCase()
      return loweredFormat.includes('file') ||
        loweredFormat.includes('uri') ||
        loweredFormat.includes('drop') ||
        loweredFormat.includes('shell')
    })
  }

  const captureClipboardSnapshot = () => {
    try {
      const debugSnapshot = window.services.getClipboardDebugSnapshot?.()
      const debugSignature = JSON.stringify(debugSnapshot || {})

      const shouldLogFileDebug = hasFileishFormats(debugSnapshot?.formats) && !debugSnapshot?.fileSignature

      if (shouldLogFileDebug && debugSignature && debugSignature !== lastDebugSignature) {
        lastDebugSignature = debugSignature
        console.warn('[copper] clipboard snapshot json\n' + JSON.stringify(debugSnapshot, null, 2))
      }

      const fileSignature = window.services.getClipboardFileSignature?.()
      if (fileSignature) {
        const nextSignature = `files:${fileSignature}`
        if (nextSignature === lastSignature) return

        const filePaths = window.services.readClipboardFilePaths?.()
        if (!filePaths?.length) return

        lastSignature = nextSignature
        onFileCapture?.(filePaths)
        return
      }

      const imageSignature = window.services.getClipboardImageSignature?.()
      if (imageSignature) {
        const nextSignature = `image:${imageSignature}`
        if (nextSignature === lastSignature) return

        const imageAsset = window.services.persistClipboardImageAsset?.()
        if (!imageAsset) return

        lastSignature = nextSignature
        onImageCapture?.(imageAsset)
        return
      }

      const text = window.services.readClipboardText?.()?.trim()
      if (text) {
        const nextSignature = `text:${text}`
        if (nextSignature === lastSignature) return

        lastSignature = nextSignature
        onTextCapture?.(text)
        return
      }

      lastSignature = ''
    } catch (error) {
      console.error('[copper] clipboard monitor error', error)
    }
  }

  const unsubscribeClipboardChanges = window.services.subscribeClipboardChanges?.(captureClipboardSnapshot) || (() => {})
  const listenerStatus = window.services.getClipboardListenerStatus?.()
  const heartbeatIntervalMs = listenerStatus?.listening
    ? Math.max(intervalMs * 4, 3000)
    : intervalMs

  captureClipboardSnapshot()
  const timer = window.setInterval(captureClipboardSnapshot, heartbeatIntervalMs)
  return () => {
    unsubscribeClipboardChanges()
    window.clearInterval(timer)
  }
}
