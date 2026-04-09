import { useEffect, useRef } from 'react'
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
  const queryRef = useRef(query)
  const {
    pruneHistory,
    recordCapturedText,
    recordCapturedImage,
    recordCapturedFiles
  } = useHistoryStore()

  useEffect(() => {
    queryRef.current = query
  }, [query])

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

    const restoreSubInput = () => {
      window.utools.setSubInput?.(({ text }) => {
        setQuery(text || '')
      }, '输入关键字或文件名', true)

      if (typeof window.utools?.setSubInputValue === 'function') {
        window.utools.setSubInputValue(queryRef.current || '')
      }
    }

    restoreSubInput()

    const handleRestore = () => {
      if (route !== 'clipboard') return
      restoreSubInput()
    }

    window.addEventListener('focus', handleRestore)
    document.addEventListener('visibilitychange', handleRestore)

    return () => {
      window.removeEventListener('focus', handleRestore)
      document.removeEventListener('visibilitychange', handleRestore)
      window.utools.removeSubInput?.()
    }
  }, [enterAction, route, setQuery])

  useEffect(() => {
    if (route !== 'clipboard') return
    if (typeof window.utools?.setSubInputValue !== 'function') return
    window.utools.setSubInputValue(query || '')
  }, [enterAction, query, route])

  return (
    <div className={`app-shell ${themeClassName}`}>
      {route === 'settings'
        ? <SettingsPage enterAction={enterAction} onBack={() => navigateToRoute('clipboard')} />
        : <ClipboardPage enterAction={enterAction} onOpenSettings={() => navigateToRoute('settings')} />}
    </div>
  )
}
