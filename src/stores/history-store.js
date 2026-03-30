import { createExternalStore } from '../utils/create-external-store'
import {
  createFileHistoryItem,
  createImageHistoryItem,
  createTextHistoryItem,
  decorateHistoryItems,
  isSameFileHistoryItem,
  isSameImageHistoryItem,
  isSameTextHistoryItem,
  mergeFileHistoryItem,
  mergeImageHistoryItem,
  mergeTextHistoryItem
} from '../services/history/history-item'
import {
  applyHistoryRetentionPolicy,
  loadHistoryItems,
  pruneStoredHistory,
  removeHistoryItemById,
  saveHistoryItems
} from '../services/storage/history-repository'
import { getSettingsState } from './settings-store'

const historyStore = createExternalStore({
  historyItems: loadHistoryItems()
})

function applyCurrentHistoryPolicy (items, policy = getSettingsState()) {
  return applyHistoryRetentionPolicy(items, policy)
}

function reorderUpdatedHistoryItem (items, existingIndex, updatedItem) {
  const nextItems = [...items]
  nextItems[existingIndex] = updatedItem
  const [reorderedItem] = nextItems.splice(existingIndex, 1)
  return [reorderedItem, ...nextItems]
}

const historyActions = {
  removeHistoryItem (id) {
    historyStore.setState((currentState) => {
      const nextItems = currentState.historyItems.filter((item) => item.id !== id)
      removeHistoryItemById(id)
      return {
        ...currentState,
        historyItems: decorateHistoryItems(nextItems)
      }
    })
  },
  upsertHistoryItems (items) {
    historyStore.setState((currentState) => {
      const nextItems = applyCurrentHistoryPolicy(items)
      saveHistoryItems(nextItems)
      return {
        ...currentState,
        historyItems: decorateHistoryItems(nextItems)
      }
    })
  },
  pruneHistory (policy = getSettingsState()) {
    const nextItems = pruneStoredHistory(policy)
    historyStore.setState((currentState) => {
      return {
        ...currentState,
        historyItems: nextItems
      }
    })
  },
  recordCapturedText (text) {
    const normalizedText = String(text || '').trim()
    if (!normalizedText) return

    historyStore.setState((currentState) => {
      const existingIndex = currentState.historyItems.findIndex((item) => {
        return isSameTextHistoryItem(item, normalizedText)
      })

      if (existingIndex >= 0) {
        const updatedItem = mergeTextHistoryItem(currentState.historyItems[existingIndex], normalizedText)
        const reorderedItems = applyCurrentHistoryPolicy(
          reorderUpdatedHistoryItem(currentState.historyItems, existingIndex, updatedItem)
        )
        saveHistoryItems(reorderedItems)
        return {
          ...currentState,
          historyItems: decorateHistoryItems(reorderedItems)
        }
      }

      const createdItem = createTextHistoryItem(normalizedText)
      const nextItems = applyCurrentHistoryPolicy([createdItem, ...currentState.historyItems])
      saveHistoryItems(nextItems)
      return {
        ...currentState,
        historyItems: decorateHistoryItems(nextItems)
      }
    })
  },
  recordCapturedImage (imageAsset) {
    if (!imageAsset?.imagePath) return

    historyStore.setState((currentState) => {
      const existingIndex = currentState.historyItems.findIndex((item) => {
        return isSameImageHistoryItem(item, imageAsset)
      })

      if (existingIndex >= 0) {
        const updatedItem = mergeImageHistoryItem(currentState.historyItems[existingIndex], imageAsset)
        const reorderedItems = applyCurrentHistoryPolicy(
          reorderUpdatedHistoryItem(currentState.historyItems, existingIndex, updatedItem)
        )
        saveHistoryItems(reorderedItems)
        return {
          ...currentState,
          historyItems: decorateHistoryItems(reorderedItems)
        }
      }

      const createdItem = createImageHistoryItem(imageAsset)
      const nextItems = applyCurrentHistoryPolicy([createdItem, ...currentState.historyItems])
      saveHistoryItems(nextItems)
      return {
        ...currentState,
        historyItems: decorateHistoryItems(nextItems)
      }
    })
  },
  recordCapturedFiles (filePaths) {
    if (!filePaths?.length) return

    historyStore.setState((currentState) => {
      const existingIndex = currentState.historyItems.findIndex((item) => {
        return isSameFileHistoryItem(item, filePaths)
      })

      if (existingIndex >= 0) {
        const updatedItem = mergeFileHistoryItem(currentState.historyItems[existingIndex], filePaths)
        const reorderedItems = applyCurrentHistoryPolicy(
          reorderUpdatedHistoryItem(currentState.historyItems, existingIndex, updatedItem)
        )
        saveHistoryItems(reorderedItems)
        return {
          ...currentState,
          historyItems: decorateHistoryItems(reorderedItems)
        }
      }

      const createdItem = createFileHistoryItem(filePaths)
      const nextItems = applyCurrentHistoryPolicy([createdItem, ...currentState.historyItems])
      saveHistoryItems(nextItems)
      return {
        ...currentState,
        historyItems: decorateHistoryItems(nextItems)
      }
    })
  }
}

export function useHistoryStore () {
  const state = historyStore.useStore()

  return {
    historyItems: state.historyItems,
    ...historyActions
  }
}
