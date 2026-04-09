import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '../../stores/settings-store'
import './index.css'

function getClipboardListenerStatusSnapshot () {
  return window.services?.getClipboardListenerStatus?.() || {
    mode: 'polling',
    protocol: 'polling',
    available: false,
    listening: false,
    reason: 'unavailable',
    targetPath: ''
  }
}

function getListenerStatusTone (listenerStatus) {
  if (listenerStatus?.listening) return 'success'
  if (listenerStatus?.available) return 'info'
  return 'muted'
}

function getListenerStatusLabel (listenerStatus) {
  if (listenerStatus?.listening) {
    return '原生监听已启用'
  }

  if (listenerStatus?.available) {
    return '原生监听可用'
  }

  return '当前使用轮询监听'
}

function getListenerModeText (listenerStatus) {
  if (listenerStatus?.listening && listenerStatus?.protocol === 'native-capture') return '原生快照模式'
  if (listenerStatus?.listening) return '原生事件模式'
  if (listenerStatus?.mode === 'native') return '原生监听待启动'
  return '轮询回退模式'
}

function getListenerStatusDescription (listenerStatus) {
  if (listenerStatus?.listening && listenerStatus?.targetPath) {
    const protocolText = listenerStatus?.protocol === 'native-capture'
      ? '原生进程直接抓取剪贴板快照'
      : '原生进程发送剪贴板变更信号'
    return `${protocolText}；监听程序路径：${listenerStatus.targetPath}`
  }

  if (listenerStatus?.reason === 'missing-binary') {
    return '插件包内没有可执行监听器时，会自动回退到轮询；Windows 当前仍优先尝试 PowerShell 监听脚本。'
  }

  if (listenerStatus?.reason === 'unsupported-platform') {
    return '当前平台没有可用的原生监听实现，系统会继续使用轮询监听。'
  }

  if (listenerStatus?.reason === 'listener-error' || listenerStatus?.reason === 'listener-start-failed') {
    return '原生监听启动失败，系统已自动回退到轮询监听。'
  }

  if (listenerStatus?.reason === 'listener-exit') {
    return '原生监听进程已退出，系统已自动回退到轮询监听。'
  }

  return '插件运行期间会持续采集剪贴板内容；彻底关闭插件后，自动记录也会停止。'
}

function useClipboardListenerStatus () {
  const [listenerStatus, setListenerStatus] = useState(() => getClipboardListenerStatusSnapshot())

  useEffect(() => {
    const refresh = () => {
      setListenerStatus(getClipboardListenerStatusSnapshot())
    }

    refresh()
    const timer = window.setInterval(refresh, 1000)
    return () => window.clearInterval(timer)
  }, [])

  return listenerStatus
}

export default function SettingsPage ({ onBack }) {
  const { settings, updateSettings } = useSettingsStore()
  const listenerStatus = useClipboardListenerStatus()

  const historyPolicySummary = useMemo(() => {
    return `至少保留 ${settings.minRetentionDays} 天内的记录；超过保留窗口后，再按最近 ${settings.maxHistoryCount} 条截断。`
  }, [settings.maxHistoryCount, settings.minRetentionDays])

  return (
    <div className='settings-page'>
      <header className='settings-header'>
        <div>
          <p className='settings-eyebrow'>Settings</p>
          <h1>插件设置</h1>
          <p className='settings-description'>主题、历史容量、展示参数与监听状态。</p>
        </div>
        {onBack
          ? (
            <button
              type='button'
              className='settings-back-button'
              onClick={onBack}
            >
              返回剪贴板
            </button>
            )
          : null}
      </header>

      <section className='settings-grid'>
        <label className='settings-field'>
          <div className='settings-field-copy'>
            <span>主题模式</span>
            <small>浅色 / 深色 / 跟随系统</small>
          </div>
          <div className='settings-field-control'>
            <select
              value={settings.themeMode}
              onChange={(event) => updateSettings({ themeMode: event.target.value })}
            >
              <option value='system'>跟随系统</option>
              <option value='dark'>深色</option>
              <option value='light'>浅色</option>
            </select>
          </div>
        </label>

        <label className='settings-field'>
          <div className='settings-field-copy'>
            <span>历史记录上限</span>
            <small>超出后按数量截断</small>
          </div>
          <div className='settings-field-control'>
            <input
              type='number'
              min='1000'
              max='20000'
              step='500'
              value={settings.maxHistoryCount}
              onChange={(event) => updateSettings({ maxHistoryCount: Number(event.target.value) })}
            />
          </div>
        </label>

        <label className='settings-field'>
          <div className='settings-field-copy'>
            <span>最短保留天数</span>
            <small>窗口内不自动清理</small>
          </div>
          <div className='settings-field-control'>
            <input
              type='number'
              min='30'
              max='365'
              step='1'
              value={settings.minRetentionDays}
              onChange={(event) => updateSettings({ minRetentionDays: Number(event.target.value) })}
            />
          </div>
        </label>

        <label className='settings-field'>
          <div className='settings-field-copy'>
            <span>图片最大高度</span>
            <small>列表缩略图上限</small>
          </div>
          <div className='settings-field-control'>
            <input
              type='number'
              min='80'
              max='480'
              step='10'
              value={settings.imagePreviewMaxHeight}
              onChange={(event) => updateSettings({ imagePreviewMaxHeight: Number(event.target.value) })}
            />
          </div>
        </label>

        <label className='settings-field'>
          <div className='settings-field-copy'>
            <span>长文本折叠行数</span>
            <small>超出时折叠显示</small>
          </div>
          <div className='settings-field-control'>
            <input
              type='number'
              min='3'
              max='12'
              step='1'
              value={settings.textCollapsedLines}
              onChange={(event) => updateSettings({ textCollapsedLines: Number(event.target.value) })}
            />
          </div>
        </label>

        <label className='settings-toggle'>
          <div className='settings-field-copy'>
            <span>启用监听</span>
            <small>{getListenerStatusLabel(listenerStatus)}</small>
          </div>
          <input
            type='checkbox'
            checked={settings.listenInBackground}
            onChange={(event) => updateSettings({ listenInBackground: event.target.checked })}
          />
        </label>

        <div className='settings-field settings-status-card'>
          <div className='settings-field-copy'>
            <span>监听模式</span>
            <small>{getListenerStatusDescription(listenerStatus)}</small>
          </div>
          <div className='settings-field-control'>
            <div className={`settings-status-badge settings-status-badge-${getListenerStatusTone(listenerStatus)}`}>
              {getListenerModeText(listenerStatus)}
            </div>
          </div>
        </div>

        <div className='settings-field settings-status-card'>
          <div className='settings-field-copy'>
            <span>历史清理策略</span>
            <small>{historyPolicySummary}</small>
          </div>
          <div className='settings-field-control'>
            <div className='settings-status-badge settings-status-badge-muted'>
              自动生效
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
