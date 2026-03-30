import { createExternalStore } from '../utils/create-external-store'
import {
  loadFavoriteItems,
  loadFavoriteTabs,
  saveFavoriteItems,
  saveFavoriteTabs
} from '../services/storage/favorite-repository'

const favoriteStore = createExternalStore({
  favoriteTabs: loadFavoriteTabs(),
  favoriteItems: decorateFavoriteItems(loadFavoriteItems())
})

function getTypeLabel (type) {
  switch (type) {
    case 'text':
      return 'Text'
    case 'html':
      return 'HTML'
    case 'image':
      return 'Image'
    case 'file':
      return 'File'
    case 'files':
      return 'Files'
    default:
      return 'Item'
  }
}

function formatRelativeTime (timestamp) {
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes <= 0) return 'now'
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

function buildFavoriteSearchText (item) {
  const fragments = [
    item.title || '',
    item.contentText || '',
    ...(item.filePaths || []),
    item.imagePath || ''
  ]

  return fragments
    .join(' ')
    .toLowerCase()
    .trim()
}

function buildFavoriteMeta (item) {
  const tabCount = item.tabIds?.length || 0
  const tabPart = `${tabCount} tab${tabCount === 1 ? '' : 's'}`

  if (item.type === 'file' || item.type === 'files') {
    const fileCount = item.filePaths?.length || 0
    return `Favorite item | ${fileCount} file${fileCount === 1 ? '' : 's'} | ${tabPart}`
  }

  if (item.type === 'image') {
    return `Favorite item | image | ${tabPart}`
  }

  return `Favorite item | ${tabPart}`
}

function stripDerivedFields (item) {
  const {
    typeLabel,
    relativeTime,
    meta,
    ...persistedFields
  } = item || {}

  return persistedFields
}

function decorateFavoriteItem (item) {
  const createdAt = item.createdAt || Date.now()
  const updatedAt = item.updatedAt || createdAt
  const normalizedItem = {
    ...item,
    createdAt,
    updatedAt,
    tabIds: Array.isArray(item.tabIds) ? item.tabIds : [],
    searchText: item.searchText || buildFavoriteSearchText(item)
  }

  return {
    ...normalizedItem,
    typeLabel: getTypeLabel(normalizedItem.type),
    relativeTime: formatRelativeTime(updatedAt),
    meta: buildFavoriteMeta(normalizedItem)
  }
}

function decorateFavoriteItems (items) {
  return items.map((item) => decorateFavoriteItem(item))
}

function persistFavoriteItems (items) {
  const normalizedItems = items.map((item) => {
    const rawItem = stripDerivedFields(item)
    return {
      ...rawItem,
      searchText: buildFavoriteSearchText(rawItem)
    }
  })

  saveFavoriteItems(normalizedItems)
  return decorateFavoriteItems(normalizedItems)
}

function createFavoriteItemFromClipboard (item, tabId, now = Date.now()) {
  return {
    id: `favorite-${now}`,
    sourceHistoryId: item.id,
    type: item.type,
    title: item.title,
    contentText: item.contentText,
    filePaths: item.filePaths,
    imagePath: item.imagePath,
    imageAssetId: item.imageAssetId,
    tabIds: [tabId],
    createdAt: now,
    updatedAt: now,
    searchText: buildFavoriteSearchText(item)
  }
}

function createTextFavoriteItem (draft, tabId, now = Date.now()) {
  const title = String(draft.title || '').trim() || 'Untitled favorite'
  const contentText = String(draft.contentText || '').trim() || title

  return {
    id: `favorite-${now}`,
    type: 'text',
    title,
    contentText,
    tabIds: [tabId],
    createdAt: now,
    updatedAt: now,
    searchText: buildFavoriteSearchText({ title, contentText })
  }
}

function updateFavoriteRecord (item, patch, now = Date.now()) {
  const nextItem = {
    ...stripDerivedFields(item),
    ...patch,
    updatedAt: now
  }

  return decorateFavoriteItem({
    ...nextItem,
    searchText: buildFavoriteSearchText(nextItem)
  })
}

const favoriteActions = {
  updateFavoriteItem (favoriteId, patch) {
    let updatedItem = null

    favoriteStore.setState((currentState) => {
      const nextItems = currentState.favoriteItems.map((item) => {
        if (item.id !== favoriteId) return item
        updatedItem = updateFavoriteRecord(item, patch)
        return updatedItem
      })

      return {
        ...currentState,
        favoriteItems: persistFavoriteItems(nextItems)
      }
    })

    return updatedItem
  },
  addFavoriteTab (name) {
    const trimmedName = String(name || '').trim()
    if (!trimmedName) return null

    const nextTab = {
      id: `favorite-tab-${Date.now()}`,
      name: trimmedName
    }

    favoriteStore.setState((currentState) => {
      const nextTabs = [...currentState.favoriteTabs, nextTab]
      saveFavoriteTabs(nextTabs)
      return {
        ...currentState,
        favoriteTabs: nextTabs
      }
    })

    return nextTab
  },
  renameFavoriteTab (tabId, name) {
    const trimmedName = String(name || '').trim()
    if (!tabId || !trimmedName) return null

    let updatedTab = null

    favoriteStore.setState((currentState) => {
      const nextTabs = currentState.favoriteTabs.map((tab) => {
        if (tab.id !== tabId) return tab
        updatedTab = {
          ...tab,
          name: trimmedName
        }
        return updatedTab
      })

      if (!updatedTab) return currentState

      saveFavoriteTabs(nextTabs)
      return {
        ...currentState,
        favoriteTabs: nextTabs
      }
    })

    return updatedTab
  },
  removeFavoriteTab (tabId) {
    if (!tabId) return { status: 'noop' }

    let result = { status: 'noop' }

    favoriteStore.setState((currentState) => {
      const targetTab = currentState.favoriteTabs.find((tab) => tab.id === tabId)
      if (!targetTab) return currentState
      if (currentState.favoriteTabs.length <= 1) {
        result = { status: 'blocked-last-tab' }
        return currentState
      }

      const nextTabs = currentState.favoriteTabs.filter((tab) => tab.id !== tabId)
      const nextItems = currentState.favoriteItems
        .map((item) => {
          if (!item.tabIds?.includes(tabId)) return item
          return updateFavoriteRecord(item, {
            tabIds: item.tabIds.filter((currentTabId) => currentTabId !== tabId)
          })
        })
        .filter((item) => item.tabIds?.length)

      saveFavoriteTabs(nextTabs)
      result = {
        status: 'removed',
        tab: targetTab,
        fallbackTabId: nextTabs[0]?.id || null
      }

      return {
        ...currentState,
        favoriteTabs: nextTabs,
        favoriteItems: persistFavoriteItems(nextItems)
      }
    })

    return result
  },
  createFavoriteItem (draft, activeTabId) {
    if (!activeTabId) return null

    const createdItem = createTextFavoriteItem(draft, activeTabId)

    favoriteStore.setState((currentState) => {
      const nextItems = [createdItem, ...currentState.favoriteItems]
      return {
        ...currentState,
        favoriteItems: persistFavoriteItems(nextItems)
      }
    })

    return decorateFavoriteItem(createdItem)
  },
  toggleFavoriteItem (item, activeTabId) {
    if (!item || !activeTabId) return { status: 'noop' }

    let result = { status: 'noop' }

    favoriteStore.setState((currentState) => {
      const currentItems = currentState.favoriteItems
      const sourceFavorite = item.tabIds
        ? currentItems.find((favoriteItem) => favoriteItem.id === item.id)
        : currentItems.find((favoriteItem) => favoriteItem.sourceHistoryId === item.id)

      if (!sourceFavorite) {
        const createdItem = createFavoriteItemFromClipboard(item, activeTabId)
        result = {
          status: 'added',
          item: decorateFavoriteItem(createdItem)
        }
        return {
          ...currentState,
          favoriteItems: persistFavoriteItems([createdItem, ...currentItems])
        }
      }

      const hasCurrentTab = sourceFavorite.tabIds.includes(activeTabId)
      let nextItems = currentItems

      if (hasCurrentTab) {
        if (sourceFavorite.tabIds.length <= 1) {
          nextItems = currentItems.filter((favoriteItem) => favoriteItem.id !== sourceFavorite.id)
          result = {
            status: 'removed',
            item: decorateFavoriteItem(sourceFavorite)
          }
        } else {
          nextItems = currentItems.map((favoriteItem) => {
            if (favoriteItem.id !== sourceFavorite.id) return favoriteItem
            return updateFavoriteRecord(favoriteItem, {
              tabIds: favoriteItem.tabIds.filter((tabId) => tabId !== activeTabId)
            })
          })
          result = {
            status: 'removed',
            item: decorateFavoriteItem(sourceFavorite)
          }
        }
      } else {
        nextItems = currentItems.map((favoriteItem) => {
          if (favoriteItem.id !== sourceFavorite.id) return favoriteItem
          return updateFavoriteRecord(favoriteItem, {
            tabIds: [...favoriteItem.tabIds, activeTabId]
          })
        })
        result = {
          status: 'added',
          item: decorateFavoriteItem(sourceFavorite)
        }
      }

      return {
        ...currentState,
        favoriteItems: persistFavoriteItems(nextItems)
      }
    })

    return result
  },
  removeFavoriteItem (favoriteId, activeTabId) {
    let result = { status: 'noop' }

    favoriteStore.setState((currentState) => {
      const targetItem = currentState.favoriteItems.find((item) => item.id === favoriteId)
      if (!targetItem) return currentState

      if (activeTabId && targetItem.tabIds?.includes(activeTabId) && targetItem.tabIds.length > 1) {
        const nextItems = currentState.favoriteItems.map((item) => {
          if (item.id !== favoriteId) return item
          return updateFavoriteRecord(item, {
            tabIds: item.tabIds.filter((tabId) => tabId !== activeTabId)
          })
        })
        result = { status: 'detached', item: decorateFavoriteItem(targetItem) }
        return {
          ...currentState,
          favoriteItems: persistFavoriteItems(nextItems)
        }
      }

      const nextItems = currentState.favoriteItems.filter((item) => item.id !== favoriteId)
      result = { status: 'deleted', item: decorateFavoriteItem(targetItem) }
      return {
        ...currentState,
        favoriteItems: persistFavoriteItems(nextItems)
      }
    })

    return result
  }
}

export function useFavoriteStore () {
  const state = favoriteStore.useStore()

  return {
    favoriteTabs: state.favoriteTabs,
    favoriteItems: state.favoriteItems,
    ...favoriteActions
  }
}
