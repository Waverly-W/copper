import { SEED_HISTORY_ITEMS } from '../../data/seed'
import { decorateHistoryItems } from '../history/history-item'
import { readStorageItem, removeStorageItem, writeStorageItem } from './key-value-store'

const HISTORY_STORAGE_KEY = 'clipboard-plugin:history'
const HISTORY_DOC_PREFIX = 'clipboard-plugin:history/'

function getHistoryDb () {
  return window.utools?.db || null
}

function toHistoryDocId (itemId) {
  return `${HISTORY_DOC_PREFIX}${itemId}`
}

function fromHistoryDocId (docId) {
  return String(docId || '').replace(HISTORY_DOC_PREFIX, '')
}

function stripDerivedFields (item) {
  const {
    typeLabel,
    meta,
    relativeTime,
    textMetrics,
    _rev,
    ...persistedFields
  } = item || {}

  return persistedFields
}

function serializeHistoryItem (item) {
  const normalizedItem = stripDerivedFields(item)
  return {
    _id: toHistoryDocId(normalizedItem.id),
    ...normalizedItem
  }
}

function deserializeHistoryDoc (doc) {
  if (!doc?._id) return null

  const {
    _id,
    _rev,
    ...item
  } = doc

  return {
    ...item,
    id: item.id || fromHistoryDocId(_id),
    _rev
  }
}

function sortHistoryItems (items) {
  return [...items].sort((left, right) => {
    const rightTimestamp = right.updatedAt || right.lastCopiedAt || right.createdAt || 0
    const leftTimestamp = left.updatedAt || left.lastCopiedAt || left.createdAt || 0
    return rightTimestamp - leftTimestamp
  })
}

function getHistoryItemTimestamp (item) {
  return item.updatedAt || item.lastCopiedAt || item.createdAt || 0
}

export function applyHistoryRetentionPolicy (items, policy = {}) {
  const sortedItems = sortHistoryItems(items)
  const maxHistoryCount = Number(policy.maxHistoryCount) || 0
  const minRetentionDays = Number(policy.minRetentionDays) || 0

  if (!maxHistoryCount && !minRetentionDays) {
    return sortedItems
  }

  const retentionCutoff = minRetentionDays > 0
    ? Date.now() - (minRetentionDays * 24 * 60 * 60 * 1000)
    : 0

  const nextItems = []

  sortedItems.forEach((item) => {
    const timestamp = getHistoryItemTimestamp(item)
    const withinRetentionWindow = retentionCutoff > 0 && timestamp >= retentionCutoff

    if (withinRetentionWindow) {
      nextItems.push(item)
      return
    }

    if (maxHistoryCount <= 0) return
    if (nextItems.length >= maxHistoryCount) return

    nextItems.push(item)
  })

  return nextItems
}

function readHistoryDocs () {
  const db = getHistoryDb()
  if (!db?.allDocs) return []
  return db.allDocs(HISTORY_DOC_PREFIX) || []
}

function writeHistoryDocs (docs) {
  const db = getHistoryDb()
  if (!db?.bulkDocs || !docs.length) return
  db.bulkDocs(docs)
}

function migrateLegacyHistoryIfNeeded () {
  const db = getHistoryDb()
  if (!db?.bulkDocs) return null

  const existingDocs = readHistoryDocs()
  if (existingDocs.length) {
    return existingDocs
      .map((doc) => deserializeHistoryDoc(doc))
      .filter(Boolean)
  }

  const legacyItems = readStorageItem(HISTORY_STORAGE_KEY, [])
  if (Array.isArray(legacyItems) && legacyItems.length) {
    writeHistoryDocs(legacyItems.map((item) => serializeHistoryItem(item)))
    removeStorageItem(HISTORY_STORAGE_KEY)
    return legacyItems.map((item) => stripDerivedFields(item))
  }

  return []
}

function loadHistoryItemsFromDb () {
  const items = migrateLegacyHistoryIfNeeded()
  return sortHistoryItems(items)
}

function saveHistoryItemToDb (item) {
  const db = getHistoryDb()
  if (!db?.put) return

  const nextDoc = serializeHistoryItem(item)
  const previousDoc = db.get(nextDoc._id)
  if (previousDoc?._rev) {
    nextDoc._rev = previousDoc._rev
  }

  db.put(nextDoc)
}

export function loadHistoryItems () {
  const db = getHistoryDb()
  if (db?.allDocs) {
    const items = loadHistoryItemsFromDb()
    return decorateHistoryItems(items)
  }

  const items = readStorageItem(HISTORY_STORAGE_KEY, [])
  if (items.length) return decorateHistoryItems(items)
  writeStorageItem(HISTORY_STORAGE_KEY, SEED_HISTORY_ITEMS)
  return SEED_HISTORY_ITEMS
}

export function saveHistoryItems (items) {
  const db = getHistoryDb()
  if (db?.allDocs && db?.put && db?.remove) {
    const sortedItems = sortHistoryItems(items).map((item) => stripDerivedFields(item))
    const existingDocs = readHistoryDocs()
    const existingDocIds = new Set(existingDocs.map((doc) => doc._id))
    const nextDocIds = new Set()

    sortedItems.forEach((item) => {
      const docId = toHistoryDocId(item.id)
      nextDocIds.add(docId)
      saveHistoryItemToDb(item)
    })

    existingDocs.forEach((doc) => {
      if (!nextDocIds.has(doc._id)) {
        db.remove(doc)
      }
    })

    return
  }

  writeStorageItem(HISTORY_STORAGE_KEY, decorateHistoryItems(items))
}

export function saveHistoryItem (item) {
  const db = getHistoryDb()
  if (db?.put) {
    saveHistoryItemToDb(stripDerivedFields(item))
    return
  }

  const currentItems = readStorageItem(HISTORY_STORAGE_KEY, [])
  const nextItems = sortHistoryItems([
    stripDerivedFields(item),
    ...currentItems.filter((currentItem) => currentItem.id !== item.id)
  ])
  writeStorageItem(HISTORY_STORAGE_KEY, nextItems)
}

export function removeHistoryItemById (itemId) {
  const db = getHistoryDb()
  if (db?.get && db?.remove) {
    const doc = db.get(toHistoryDocId(itemId))
    if (doc) {
      db.remove(doc)
    }
    return
  }

  const currentItems = readStorageItem(HISTORY_STORAGE_KEY, [])
  const nextItems = currentItems.filter((item) => item.id !== itemId)
  writeStorageItem(HISTORY_STORAGE_KEY, nextItems)
}

export function pruneStoredHistory (policy) {
  const currentItems = loadHistoryItems().map((item) => stripDerivedFields(item))
  const nextItems = applyHistoryRetentionPolicy(currentItems, policy)
  saveHistoryItems(nextItems)
  return decorateHistoryItems(nextItems)
}
