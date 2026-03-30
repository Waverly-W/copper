import { SEED_FAVORITE_ITEMS, SEED_FAVORITE_TABS } from '../../data/seed'
import { readStorageItem, writeStorageItem } from './key-value-store'

const FAVORITE_ITEMS_STORAGE_KEY = 'clipboard-plugin:favorites'
const FAVORITE_TABS_STORAGE_KEY = 'clipboard-plugin:favorite-tabs'

export function loadFavoriteTabs () {
  const tabs = readStorageItem(FAVORITE_TABS_STORAGE_KEY, [])
  if (tabs.length) return tabs
  writeStorageItem(FAVORITE_TABS_STORAGE_KEY, SEED_FAVORITE_TABS)
  return SEED_FAVORITE_TABS
}

export function saveFavoriteTabs (tabs) {
  writeStorageItem(FAVORITE_TABS_STORAGE_KEY, tabs)
}

export function loadFavoriteItems () {
  const items = readStorageItem(FAVORITE_ITEMS_STORAGE_KEY, [])
  if (items.length) return items
  writeStorageItem(FAVORITE_ITEMS_STORAGE_KEY, SEED_FAVORITE_ITEMS)
  return SEED_FAVORITE_ITEMS
}

export function saveFavoriteItems (items) {
  writeStorageItem(FAVORITE_ITEMS_STORAGE_KEY, items)
}
