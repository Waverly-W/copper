import { SEED_FAVORITE_ITEMS, SEED_FAVORITE_TABS } from '../../data/seed'
import { readStorageItem, writeStorageItem } from './key-value-store'

const FAVORITE_ITEMS_STORAGE_KEY = 'clipboard-plugin:favorites'
const FAVORITE_TABS_STORAGE_KEY = 'clipboard-plugin:favorite-tabs'
const FAVORITE_ITEMS_INITIALIZED_STORAGE_KEY = 'clipboard-plugin:favorites:initialized'
const FAVORITE_TABS_INITIALIZED_STORAGE_KEY = 'clipboard-plugin:favorite-tabs:initialized'

function cloneSeedRecords (records) {
  return records.map((record) => ({ ...record }))
}

function isStorageInitialized (key) {
  return Boolean(readStorageItem(key, false))
}

function seedFavoriteRecords (storageKey, initializationKey, seedRecords) {
  const seededRecords = cloneSeedRecords(seedRecords)
  writeStorageItem(storageKey, seededRecords)
  writeStorageItem(initializationKey, true)
  return seededRecords
}

export function loadFavoriteTabs () {
  const tabs = readStorageItem(FAVORITE_TABS_STORAGE_KEY, null)
  if (Array.isArray(tabs)) return tabs

  if (isStorageInitialized(FAVORITE_TABS_INITIALIZED_STORAGE_KEY)) {
    return []
  }

  return seedFavoriteRecords(
    FAVORITE_TABS_STORAGE_KEY,
    FAVORITE_TABS_INITIALIZED_STORAGE_KEY,
    SEED_FAVORITE_TABS
  )
}

export function saveFavoriteTabs (tabs) {
  writeStorageItem(FAVORITE_TABS_STORAGE_KEY, tabs)
  writeStorageItem(FAVORITE_TABS_INITIALIZED_STORAGE_KEY, true)
}

export function loadFavoriteItems () {
  const items = readStorageItem(FAVORITE_ITEMS_STORAGE_KEY, null)
  if (Array.isArray(items)) return items

  if (isStorageInitialized(FAVORITE_ITEMS_INITIALIZED_STORAGE_KEY)) {
    return []
  }

  return seedFavoriteRecords(
    FAVORITE_ITEMS_STORAGE_KEY,
    FAVORITE_ITEMS_INITIALIZED_STORAGE_KEY,
    SEED_FAVORITE_ITEMS
  )
}

export function saveFavoriteItems (items) {
  writeStorageItem(FAVORITE_ITEMS_STORAGE_KEY, items)
  writeStorageItem(FAVORITE_ITEMS_INITIALIZED_STORAGE_KEY, true)
}
