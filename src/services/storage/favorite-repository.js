import { SEED_FAVORITE_ITEMS, SEED_FAVORITE_TABS } from '../../data/seed'
import { readStorageItem, writeStorageItem } from './key-value-store'

const FAVORITE_ITEMS_STORAGE_KEY = 'clipboard-plugin:favorites'
const FAVORITE_TABS_STORAGE_KEY = 'clipboard-plugin:favorite-tabs'

function cloneSeedRecords (records) {
  return records.map((record) => ({ ...record }))
}

export function loadFavoriteTabs () {
  const tabs = readStorageItem(FAVORITE_TABS_STORAGE_KEY, null)
  if (Array.isArray(tabs)) return tabs

  const seededTabs = cloneSeedRecords(SEED_FAVORITE_TABS)
  writeStorageItem(FAVORITE_TABS_STORAGE_KEY, seededTabs)
  return seededTabs
}

export function saveFavoriteTabs (tabs) {
  writeStorageItem(FAVORITE_TABS_STORAGE_KEY, tabs)
}

export function loadFavoriteItems () {
  const items = readStorageItem(FAVORITE_ITEMS_STORAGE_KEY, null)
  if (Array.isArray(items)) return items

  const seededItems = cloneSeedRecords(SEED_FAVORITE_ITEMS)
  writeStorageItem(FAVORITE_ITEMS_STORAGE_KEY, seededItems)
  return seededItems
}

export function saveFavoriteItems (items) {
  writeStorageItem(FAVORITE_ITEMS_STORAGE_KEY, items)
}
