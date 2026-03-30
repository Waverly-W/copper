import { useEffect } from 'react'
import ClipboardPage from './pages/clipboard'
import SettingsPage from './pages/settings'
import { usePluginLifecycle } from './app/plugin-lifecycle'
import { startClipboardMonitor } from './services/clipboard/clipboard-monitor'
import { useHistoryStore } from './stores/history-store'
import { useSettingsStore } from './stores/settings-store'
import { useUIStore } from './stores/ui-store'

export default function App () {
  const { route, enterAction, navigateToRoute } = usePluginLifecycle()
  const { settings } = useSettingsStore()
  const { query, setQuery } = useUIStore()
  const {
    pruneHistory,
    recordCapturedText,
    recordCapturedImage,
    recordCapturedFiles
  } = useHistoryStore()

  const themeClassName = settings.themeMode === 'system'
    ? 'theme-system'
    : `theme-${settings.themeMode}`

  useEffect(() => {
    return startClipboardMonitor({
      enabled: settings.listenInBackground,
      intervalMs: 800,
      onTextCapture: recordCapturedText,
      onImageCapture: recordCapturedImage,
      onFileCapture: recordCapturedFiles
    })
  }, [
    recordCapturedFiles,
    recordCapturedImage,
    recordCapturedText,
    settings.listenInBackground
  ])

  useEffect(() => {
    pruneHistory(settings)
  }, [
    pruneHistory,
    settings.maxHistoryCount,
    settings.minRetentionDays
  ])

  useEffect(() => {
    if (!window.utools) return

    if (route !== 'clipboard') {
      window.utools.removeSubInput?.()
      return
    }

    window.utools.setSubInput?.(({ text }) => {
      setQuery(text || '')
    }, '输入关键字、拼音或文件名', true)

    return () => {
      window.utools.removeSubInput?.()
    }
  }, [route, setQuery])

  useEffect(() => {
    if (route !== 'clipboard') return
    if (typeof window.utools?.setSubInputValue !== 'function') return
    window.utools.setSubInputValue(query || '')
  }, [query, route])

  return (
    <div className={`app-shell ${themeClassName}`}>
      {route === 'settings'
        ? <SettingsPage enterAction={enterAction} onBack={() => navigateToRoute('clipboard')} />
        : <ClipboardPage enterAction={enterAction} onOpenSettings={() => navigateToRoute('settings')} />}
    </div>
  )
}
