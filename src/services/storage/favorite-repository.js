import { readStorageItem, removeStorageItem, writeStorageItem } from './key-value-store'

const FAVORITE_ITEMS_STORAGE_KEY = 'clipboard-plugin:favorites'
const FAVORITE_TABS_STORAGE_KEY = 'clipboard-plugin:favorite-tabs'
const FAVORITE_ITEMS_INITIALIZED_STORAGE_KEY = 'clipboard-plugin:favorites:initialized'
const FAVORITE_TABS_INITIALIZED_STORAGE_KEY = 'clipboard-plugin:favorite-tabs:initialized'

const FAVORITE_ITEM_DOC_PREFIX = 'clipboard-plugin:favorite-item/'
const FAVORITE_TAB_DOC_PREFIX = 'clipboard-plugin:favorite-tab/'
const DEFAULT_FAVORITE_TAB_ID = 'favorite-tab-default'
const DEFAULT_FAVORITE_TAB_NAME = 'Favorites'

function getFavoriteDb () {
  return window.utools?.db || null
}

function toFavoriteDocId (prefix, recordId) {
  return `${prefix}${recordId}`
}

function fromFavoriteDocId (prefix, docId) {
  return String(docId || '').replace(prefix, '')
}

function readFavoriteDocs (prefix) {
  const db = getFavoriteDb()
  if (!db?.allDocs) return []
  return db.allDocs(prefix) || []
}

function deserializeFavoriteDoc (prefix, doc) {
  if (!doc?._id) return null

  const {
    _id,
    _rev,
    ...record
  } = doc

  return {
    ...record,
    id: record.id || fromFavoriteDocId(prefix, _id),
    _rev
  }
}

function createDefaultFavoriteTab (now = Date.now()) {
  return {
    id: DEFAULT_FAVORITE_TAB_ID,
    name: DEFAULT_FAVORITE_TAB_NAME,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now
  }
}

function normalizeFavoriteTab (tab, index = 0, now = Date.now()) {
  const createdAt = Number(tab?.createdAt) || now
  const updatedAt = Number(tab?.updatedAt) || createdAt
  const sortOrder = Number.isFinite(tab?.sortOrder) ? tab.sortOrder : index

  return {
    id: String(tab?.id || `favorite-tab-${createdAt}-${index}`),
    name: String(tab?.name || '').trim() || `Tab ${index + 1}`,
    sortOrder,
    createdAt,
    updatedAt
  }
}

function stripFavoriteItemDerivedFields (item) {
  const {
    typeLabel,
    relativeTime,
    meta,
    _rev,
    ...persistedFields
  } = item || {}

  return persistedFields
}

function normalizeFavoriteItem (item, index = 0, now = Date.now()) {
  const rawItem = stripFavoriteItemDerivedFields(item)
  const createdAt = Number(rawItem.createdAt) || now
  const updatedAt = Number(rawItem.updatedAt) || createdAt

  return {
    ...rawItem,
    id: String(rawItem.id || `favorite-${createdAt}-${index}`),
    createdAt,
    updatedAt,
    tabIds: Array.isArray(rawItem.tabIds) ? rawItem.tabIds.filter(Boolean) : []
  }
}

function serializeFavoriteTab (tab, index) {
  const normalizedTab = normalizeFavoriteTab(tab, index)
  return {
    _id: toFavoriteDocId(FAVORITE_TAB_DOC_PREFIX, normalizedTab.id),
    ...normalizedTab
  }
}

function serializeFavoriteItem (item, index) {
  const normalizedItem = normalizeFavoriteItem(item, index)
  return {
    _id: toFavoriteDocId(FAVORITE_ITEM_DOC_PREFIX, normalizedItem.id),
    ...normalizedItem
  }
}

function sortFavoriteTabs (tabs) {
  return [...tabs].sort((left, right) => {
    const leftSortOrder = Number.isFinite(left.sortOrder) ? left.sortOrder : Number.MAX_SAFE_INTEGER
    const rightSortOrder = Number.isFinite(right.sortOrder) ? right.sortOrder : Number.MAX_SAFE_INTEGER
    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder
    }

    const leftTimestamp = left.updatedAt || left.createdAt || 0
    const rightTimestamp = right.updatedAt || right.createdAt || 0
    return leftTimestamp - rightTimestamp
  })
}

function sortFavoriteItems (items) {
  return [...items].sort((left, right) => {
    const rightTimestamp = right.updatedAt || right.createdAt || 0
    const leftTimestamp = left.updatedAt || left.createdAt || 0
    return rightTimestamp - leftTimestamp
  })
}

function saveFavoriteDoc (serializedDoc) {
  const db = getFavoriteDb()
  if (!db?.put) return

  const previousDoc = db.get(serializedDoc._id)
  const nextDoc = {
    ...serializedDoc
  }

  if (previousDoc?._rev) {
    nextDoc._rev = previousDoc._rev
  }

  db.put(nextDoc)
}

function replaceFavoriteDocs ({ prefix, records, serializer, sorter }) {
  const db = getFavoriteDb()
  if (!db?.allDocs || !db?.put || !db?.remove) return false

  const existingDocs = readFavoriteDocs(prefix)
  const nextDocIds = new Set()

  sorter(records).forEach((record, index) => {
    const serializedDoc = serializer(record, index)
    nextDocIds.add(serializedDoc._id)
    saveFavoriteDoc(serializedDoc)
  })

  existingDocs.forEach((doc) => {
    if (!nextDocIds.has(doc._id)) {
      db.remove(doc)
    }
  })

  return true
}

function cleanupLegacyFavoriteItemStorage () {
  removeStorageItem(FAVORITE_ITEMS_STORAGE_KEY)
  removeStorageItem(FAVORITE_ITEMS_INITIALIZED_STORAGE_KEY)
}

function cleanupLegacyFavoriteTabStorage () {
  removeStorageItem(FAVORITE_TABS_STORAGE_KEY)
  removeStorageItem(FAVORITE_TABS_INITIALIZED_STORAGE_KEY)
}

function loadFavoriteTabsFromDb () {
  return sortFavoriteTabs(
    readFavoriteDocs(FAVORITE_TAB_DOC_PREFIX)
      .map((doc) => deserializeFavoriteDoc(FAVORITE_TAB_DOC_PREFIX, doc))
      .filter(Boolean)
      .map((tab, index) => normalizeFavoriteTab(tab, index))
  )
}

function loadFavoriteItemsFromDb () {
  return sortFavoriteItems(
    readFavoriteDocs(FAVORITE_ITEM_DOC_PREFIX)
      .map((doc) => deserializeFavoriteDoc(FAVORITE_ITEM_DOC_PREFIX, doc))
      .filter(Boolean)
      .map((item, index) => normalizeFavoriteItem(item, index))
  )
}

function migrateLegacyFavoriteTabsIfNeeded () {
  const db = getFavoriteDb()
  if (!db?.allDocs) return null

  const existingTabs = loadFavoriteTabsFromDb()
  if (existingTabs.length) return existingTabs

  const legacyTabs = readStorageItem(FAVORITE_TABS_STORAGE_KEY, null)
  if (Array.isArray(legacyTabs)) {
    const migratedTabs = legacyTabs.length
      ? legacyTabs.map((tab, index) => normalizeFavoriteTab(tab, index))
      : [createDefaultFavoriteTab()]

    replaceFavoriteDocs({
      prefix: FAVORITE_TAB_DOC_PREFIX,
      records: migratedTabs,
      serializer: serializeFavoriteTab,
      sorter: sortFavoriteTabs
    })
    cleanupLegacyFavoriteTabStorage()
    return migratedTabs
  }

  const initialTabs = [createDefaultFavoriteTab()]
  replaceFavoriteDocs({
    prefix: FAVORITE_TAB_DOC_PREFIX,
    records: initialTabs,
    serializer: serializeFavoriteTab,
    sorter: sortFavoriteTabs
  })
  return initialTabs
}

function migrateLegacyFavoriteItemsIfNeeded () {
  const db = getFavoriteDb()
  if (!db?.allDocs) return null

  const existingItems = loadFavoriteItemsFromDb()
  if (existingItems.length) return existingItems

  const legacyItems = readStorageItem(FAVORITE_ITEMS_STORAGE_KEY, null)
  if (Array.isArray(legacyItems)) {
    const migratedItems = legacyItems.map((item, index) => normalizeFavoriteItem(item, index))
    replaceFavoriteDocs({
      prefix: FAVORITE_ITEM_DOC_PREFIX,
      records: migratedItems,
      serializer: serializeFavoriteItem,
      sorter: sortFavoriteItems
    })
    cleanupLegacyFavoriteItemStorage()
    return migratedItems
  }

  cleanupLegacyFavoriteItemStorage()
  return []
}

export function loadFavoriteTabs () {
  const db = getFavoriteDb()
  if (db?.allDocs) {
    return migrateLegacyFavoriteTabsIfNeeded()
  }

  const tabs = readStorageItem(FAVORITE_TABS_STORAGE_KEY, null)
  if (Array.isArray(tabs) && tabs.length) {
    return sortFavoriteTabs(tabs.map((tab, index) => normalizeFavoriteTab(tab, index)))
  }

  const initialTabs = [createDefaultFavoriteTab()]
  writeStorageItem(FAVORITE_TABS_STORAGE_KEY, initialTabs)
  return initialTabs
}

export function saveFavoriteTabs (tabs) {
  const normalizedTabs = sortFavoriteTabs(tabs.map((tab, index) => normalizeFavoriteTab(tab, index)))
  const didPersistToDb = replaceFavoriteDocs({
    prefix: FAVORITE_TAB_DOC_PREFIX,
    records: normalizedTabs,
    serializer: serializeFavoriteTab,
    sorter: sortFavoriteTabs
  })

  if (didPersistToDb) {
    cleanupLegacyFavoriteTabStorage()
    return
  }

  writeStorageItem(FAVORITE_TABS_STORAGE_KEY, normalizedTabs)
}

export function loadFavoriteItems () {
  const db = getFavoriteDb()
  if (db?.allDocs) {
    return migrateLegacyFavoriteItemsIfNeeded()
  }

  const items = readStorageItem(FAVORITE_ITEMS_STORAGE_KEY, null)
  if (Array.isArray(items)) {
    return sortFavoriteItems(items.map((item, index) => normalizeFavoriteItem(item, index)))
  }

  writeStorageItem(FAVORITE_ITEMS_STORAGE_KEY, [])
  return []
}

export function saveFavoriteItems (items) {
  const normalizedItems = sortFavoriteItems(items.map((item, index) => normalizeFavoriteItem(item, index)))
  const didPersistToDb = replaceFavoriteDocs({
    prefix: FAVORITE_ITEM_DOC_PREFIX,
    records: normalizedItems,
    serializer: serializeFavoriteItem,
    sorter: sortFavoriteItems
  })

  if (didPersistToDb) {
    cleanupLegacyFavoriteItemStorage()
    return
  }

  writeStorageItem(FAVORITE_ITEMS_STORAGE_KEY, normalizedItems)
}
