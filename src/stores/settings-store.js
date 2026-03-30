import { createExternalStore } from '../utils/create-external-store'
import { loadSettings, saveSettings } from '../services/storage/settings-repository'

export const DEFAULT_SETTINGS = {
  themeMode: 'system',
  maxHistoryCount: 10000,
  minRetentionDays: 30,
  imagePreviewMaxHeight: 160,
  textCollapsedLines: 6,
  listenInBackground: true,
  defaultFocusTarget: 'search'
}

const settingsStore = createExternalStore(loadSettings(DEFAULT_SETTINGS))

const settingsActions = {
  updateSettings (partialSettings) {
    settingsStore.setState((currentSettings) => {
      const nextSettings = {
        ...currentSettings,
        ...partialSettings
      }

      saveSettings(nextSettings)
      return nextSettings
    })
  }
}

export function useSettingsStore () {
  const settings = settingsStore.useStore()

  return {
    settings,
    ...settingsActions
  }
}

export function getSettingsState () {
  return settingsStore.getState()
}
