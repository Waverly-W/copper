import { createExternalStore } from '../utils/create-external-store'

const initialState = {
  query: '',
  activePane: 'history',
  activeFavoriteTabId: 'favorite-tab-snippets',
  selectedHistoryIndex: 0,
  selectedFavoriteIndex: 0
}

const uiStore = createExternalStore(initialState)

const uiActions = {
  setQuery (nextQuery) {
    uiStore.setState((currentState) => ({
      ...currentState,
      query: nextQuery,
      selectedHistoryIndex: 0,
      selectedFavoriteIndex: 0
    }))
  },
  setActivePane (nextPane) {
    uiStore.setState((currentState) => ({
      ...currentState,
      activePane: nextPane
    }))
  },
  setActiveFavoriteTabId (tabId) {
    uiStore.setState((currentState) => ({
      ...currentState,
      activeFavoriteTabId: tabId,
      selectedFavoriteIndex: 0
    }))
  },
  setSelectedIndex (pane, index) {
    uiStore.setState((currentState) => {
      if (pane === 'history') {
        return {
          ...currentState,
          activePane: 'history',
          selectedHistoryIndex: index
        }
      }

      return {
        ...currentState,
        activePane: 'favorite',
        selectedFavoriteIndex: index
      }
    })
  },
  moveSelection (direction, counts) {
    const delta = direction === 'down' ? 1 : -1
    const currentState = uiStore.getState()

    if (currentState.activePane === 'history') {
      const lastIndex = Math.max(counts.historyCount - 1, 0)
      uiStore.setState({
        ...currentState,
        selectedHistoryIndex: clampIndex(currentState.selectedHistoryIndex + delta, lastIndex)
      })
      return
    }

    const lastIndex = Math.max(counts.favoriteCount - 1, 0)
    uiStore.setState({
      ...currentState,
      selectedFavoriteIndex: clampIndex(currentState.selectedFavoriteIndex + delta, lastIndex)
    })
  },
  triggerAction (actionType) {
    if (!window.utools?.showNotification) return
    const actionLabel = actionType === 'copy' ? 'Copy' : 'Paste'
    const paneLabel = uiStore.getState().activePane === 'history' ? 'History' : 'Favorites'
    window.utools.showNotification(`${actionLabel} action is not available for the current selection in ${paneLabel}.`)
  }
}

export function useUIStore () {
  const state = uiStore.useStore()

  return {
    ...state,
    ...uiActions
  }
}

function clampIndex (value, maxIndex) {
  if (maxIndex <= 0) return 0
  if (value < 0) return 0
  if (value > maxIndex) return maxIndex
  return value
}
