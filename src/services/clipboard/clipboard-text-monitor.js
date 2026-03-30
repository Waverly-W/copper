export function startClipboardTextMonitor ({ enabled, intervalMs = 800, onTextCapture }) {
  if (!enabled || !window.services?.readClipboardText) {
    return () => {}
  }

  let lastCapturedText = ''

  const captureClipboardText = () => {
    const clipboardText = window.services.readClipboardText()?.trim()
    if (!clipboardText) return
    if (clipboardText === lastCapturedText) return

    lastCapturedText = clipboardText
    onTextCapture(clipboardText)
  }

  captureClipboardText()
  const timer = window.setInterval(captureClipboardText, intervalMs)
  return () => window.clearInterval(timer)
}
