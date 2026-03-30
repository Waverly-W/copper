import { readStorageItem, writeStorageItem } from './key-value-store'

const SETTINGS_STORAGE_KEY = 'clipboard-plugin:settings'

export function loadSettings (defaultSettings) {
  return {
    ...defaultSettings,
    ...readStorageItem(SETTINGS_STORAGE_KEY, {})
  }
}

export function saveSettings (settings) {
  writeStorageItem(SETTINGS_STORAGE_KEY, settings)
}
