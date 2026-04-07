import { useEffect, useMemo, useRef, useState } from 'react'
import { Analysis, ConnectionBox, CopyOne, DeleteOne, FileEditing, Newlybuild, SendOne, SettingTwo, Star } from '@icon-park/react'
import SplitLayout from '../../components/split-layout'
import PaneHeader from '../../components/pane-header'
import HistoryList from '../../components/history-list'
import FavoriteList from '../../components/favorite-list'
import FavoriteEditor from '../../components/favorite-editor'
import FavoriteTabManager from '../../components/favorite-tab-manager'
import PreviewModal from '../../components/preview-modal'
import TextAnalysisModal from '../../components/text-analysis-modal'
import TabBar from '../../components/tab-bar'
import {
  copyClipboardItem,
  copyClipboardItems,
  notifyActionResult,
  pasteClipboardItem,
  pasteClipboardItems
} from '../../services/clipboard/item-actions'
import { useSearchResults } from '../../services/search/use-search-results'
import { analyzeClipboardText } from '../../services/text-analysis/analyze-clipboard-text'
import { useHistoryStore } from '../../stores/history-store'
import { useFavoriteStore } from '../../stores/favorite-store'
import { useUIStore } from '../../stores/ui-store'
import './index.css'

function buildFavoriteStatusMap (favoriteItems, activeFavoriteTabId) {
  return favoriteItems.reduce((map, favoriteItem) => {
    const sourceId = favoriteItem.sourceHistoryId
    if (!sourceId) return map

    const favoriteStatus = favoriteItem.tabIds?.includes(activeFavoriteTabId)
      ? 'current-tab'
      : 'other-tab'

    map[sourceId] = favoriteStatus
    return map
  }, {})
}

function getHistoryFavoriteActionLabel (favoriteStatus) {
  if (favoriteStatus === 'current-tab') return '移出当前 Tab'
  if (favoriteStatus === 'other-tab') return '加入当前 Tab'
  return '收藏'
}

function buildHeaderIcon (IconComponent) {
  return <IconComponent theme='outline' size={18} fill='currentColor' />
}

function buildToolbarIcon (IconComponent) {
  return (
    <span className='clipboard-toolbar-icon' aria-hidden='true'>
      <IconComponent theme='outline' size={18} strokeWidth={2.8} fill='currentColor' />
    </span>
  )
}

function buildHistoryTypeTabs (historyItems) {
  const counts = historyItems.reduce((result, item) => {
    if (item.type === 'text' || item.type === 'html') {
      result.text += 1
      return result
    }

    if (item.type === 'image') {
      result.image += 1
      return result
    }

    if (item.type === 'file' || item.type === 'files') {
      result.file += 1
    }

    return result
  }, {
    all: historyItems.length,
    text: 0,
    image: 0,
    file: 0
  })

  return [
    { id: 'all', name: '全部', badge: counts.all },
    { id: 'text', name: '文字', badge: counts.text },
    { id: 'image', name: '图片', badge: counts.image },
    { id: 'file', name: '文件', badge: counts.file }
  ]
}

function filterHistoryItemsByType (items, activeType) {
  if (activeType === 'all') return items

  return items.filter((item) => {
    if (activeType === 'text') {
      return item.type === 'text' || item.type === 'html'
    }

    if (activeType === 'image') {
      return item.type === 'image'
    }

    if (activeType === 'file') {
      return item.type === 'file' || item.type === 'files'
    }

    return true
  })
}

function getAdjacentFavoriteTabId (tabs, activeTabId, direction) {
  if (!tabs.length) return null

  const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId)
  const safeIndex = currentIndex >= 0 ? currentIndex : 0
  const delta = direction === 'previous' ? -1 : 1
  const nextIndex = (safeIndex + delta + tabs.length) % tabs.length

  return tabs[nextIndex]?.id || null
}

function clampIndex (value, maxIndex) {
  if (maxIndex <= 0) return 0
  if (value < 0) return 0
  if (value > maxIndex) return maxIndex
  return value
}

function buildRangeSelectionIds (items, startIndex, endIndex) {
  if (startIndex <= endIndex) {
    return items.slice(startIndex, endIndex + 1).map((item) => item.id)
  }

  return items.slice(endIndex, startIndex + 1).map((item) => item.id).reverse()
}

function getSelectedItems (items, selectedIds, fallbackIndex) {
  const itemMap = new Map(items.map((item) => [item.id, item]))
  const selectedItems = selectedIds
    .map((itemId) => itemMap.get(itemId))
    .filter(Boolean)
  if (selectedItems.length) return selectedItems
  const fallbackItem = items[fallbackIndex]
  return fallbackItem ? [fallbackItem] : []
}

export default function ClipboardPage ({ onOpenSettings }) {
  const [favoriteDraft, setFavoriteDraft] = useState(null)
  const [isManagingTabs, setIsManagingTabs] = useState(false)
  const [isAnalyzingText, setIsAnalyzingText] = useState(false)
  const [previewDraft, setPreviewDraft] = useState(null)
  const [textAnalysisDraft, setTextAnalysisDraft] = useState(null)
  const [activeHistoryTypeTabId, setActiveHistoryTypeTabId] = useState('all')
  const [selectedIdsByPane, setSelectedIdsByPane] = useState({ history: [], favorite: [] })
  const lastEnterAtRef = useRef(0)
  const selectionAnchorRef = useRef({ history: null, favorite: null })
  const {
    query,
    activePane,
    activeFavoriteTabId,
    selectedHistoryIndex,
    selectedFavoriteIndex,
    setActivePane,
    setActiveFavoriteTabId,
    setSelectedIndex,
    triggerAction
  } = useUIStore()

  const { historyItems, removeHistoryItem } = useHistoryStore()
  const {
    favoriteTabs,
    favoriteItems,
    addFavoriteTab,
    createFavoriteItem,
    renameFavoriteTab,
    updateFavoriteItem,
    toggleFavoriteItem,
    removeFavoriteTab,
    removeFavoriteItem
  } = useFavoriteStore()

  const historyFavoriteStatusMap = useMemo(() => {
    return buildFavoriteStatusMap(favoriteItems, activeFavoriteTabId)
  }, [activeFavoriteTabId, favoriteItems])

  const historySearchItems = useMemo(() => {
    return historyItems.map((item) => ({
      ...item,
      favoriteStatus: historyFavoriteStatusMap[item.id] || ''
    }))
  }, [historyFavoriteStatusMap, historyItems])
  const historyTypeTabs = useMemo(() => buildHistoryTypeTabs(historySearchItems), [historySearchItems])
  const historyTypeFilteredItems = useMemo(() => {
    return filterHistoryItemsByType(historySearchItems, activeHistoryTypeTabId)
  }, [activeHistoryTypeTabId, historySearchItems])

  const favoriteSearchItems = useMemo(() => {
    return favoriteItems.filter((item) => item.tabIds.includes(activeFavoriteTabId))
  }, [activeFavoriteTabId, favoriteItems])

  const filteredHistoryItems = useSearchResults(historyTypeFilteredItems, query, 'lastCopiedAt')
  const filteredFavoriteItems = useSearchResults(favoriteSearchItems, query, 'updatedAt')

  const activeHistoryItem = filteredHistoryItems[selectedHistoryIndex] || null
  const activeFavoriteItem = filteredFavoriteItems[selectedFavoriteIndex] || null
  const activeItem = activePane === 'history' ? activeHistoryItem : activeFavoriteItem
  const activeItemIndex = activePane === 'history' ? selectedHistoryIndex : selectedFavoriteIndex
  const selectedHistoryItems = useMemo(() => {
    return getSelectedItems(filteredHistoryItems, selectedIdsByPane.history, selectedHistoryIndex)
  }, [filteredHistoryItems, selectedHistoryIndex, selectedIdsByPane.history])
  const selectedFavoriteItems = useMemo(() => {
    return getSelectedItems(filteredFavoriteItems, selectedIdsByPane.favorite, selectedFavoriteIndex)
  }, [filteredFavoriteItems, selectedFavoriteIndex, selectedIdsByPane.favorite])
  const activeSelectedItems = activePane === 'history' ? selectedHistoryItems : selectedFavoriteItems
  const activeAnalyzableItem = activeSelectedItems.length === 1 &&
    (activeSelectedItems[0]?.type === 'text' || activeSelectedItems[0]?.type === 'html')
    ? activeSelectedItems[0]
    : null

  const resetMultiSelection = () => {
    setSelectedIdsByPane({ history: [], favorite: [] })
    selectionAnchorRef.current = { history: null, favorite: null }
  }

  const handleActivatePane = (pane) => {
    if (pane !== activePane) {
      resetMultiSelection()
    }
    setActivePane(pane)
  }

  const handleCopyItem = (item, index, pane = activePane) => {
    if (pane === 'history') {
      setSelectedIndex('history', index)
    } else {
      setSelectedIndex('favorite', index)
    }

    if (copyClipboardItem(item)) {
      notifyActionResult('已复制到系统剪贴板。')
    }
  }

  const handlePasteItem = (item, index, pane = activePane) => {
    if (pane === 'history') {
      setSelectedIndex('history', index)
    } else {
      setSelectedIndex('favorite', index)
    }

    if (pasteClipboardItem(item)) {
      notifyActionResult('已粘贴回上一个窗口。')
    }
  }

  const handlePreviewItem = (item, index, pane = activePane, event) => {
    event?.preventDefault?.()
    if (!item || (item.type !== 'text' && item.type !== 'html' && item.type !== 'image')) return

    resetMultiSelection()

    if (pane === 'history') {
      setActivePane('history')
      setSelectedIndex('history', index)
    } else {
      setActivePane('favorite')
      setSelectedIndex('favorite', index)
    }

    setPreviewDraft(item)
  }

  const handleDeleteCurrentItem = () => {
    if (!activeItem) return

    if (activePane === 'history') {
      removeHistoryItem(activeItem.id)
      notifyActionResult('已删除当前历史项。')
      return
    }

    const removeResult = removeFavoriteItem(activeItem.id, activeFavoriteTabId)
    if (removeResult.status === 'detached') {
      notifyActionResult('已从当前 Tab 移除该收藏。')
      return
    }

    if (removeResult.status === 'deleted') {
      notifyActionResult('已删除当前收藏项。')
    }
  }

  const handleDeleteSelectedItems = () => {
    if (!activeSelectedItems.length) return

    if (activePane === 'history') {
      activeSelectedItems.forEach((item) => {
        removeHistoryItem(item.id)
      })
      notifyActionResult(`已删除 ${activeSelectedItems.length} 条历史记录。`)
      resetMultiSelection()
      return
    }

    let detachedCount = 0
    let deletedCount = 0

    activeSelectedItems.forEach((item) => {
      const removeResult = removeFavoriteItem(item.id, activeFavoriteTabId)
      if (removeResult.status === 'detached') detachedCount += 1
      if (removeResult.status === 'deleted') deletedCount += 1
    })

    if (detachedCount && deletedCount) {
      notifyActionResult(`已移除 ${detachedCount} 项并删除 ${deletedCount} 项收藏。`)
    } else if (detachedCount) {
      notifyActionResult(`已从当前 Tab 移除 ${detachedCount} 项收藏。`)
    } else if (deletedCount) {
      notifyActionResult(`已删除 ${deletedCount} 项收藏。`)
    }

    resetMultiSelection()
  }

  const handleToggleFavoriteCurrentItem = () => {
    if (!activeItem) return

    const toggleResult = toggleFavoriteItem(activeItem, activeFavoriteTabId)
    if (toggleResult.status === 'added') {
      notifyActionResult('已加入当前收藏 Tab。')
      return
    }

    if (toggleResult.status === 'removed') {
      notifyActionResult('已从当前收藏 Tab 移除。')
    }
  }

  const handleOpenTextAnalysis = async () => {
    if (!activeAnalyzableItem) return

    const sourceText = activeAnalyzableItem.contentText || activeAnalyzableItem.title || ''
    setIsAnalyzingText(true)

    try {
      const analysisResult = await analyzeClipboardText(sourceText)

      setTextAnalysisDraft({
        itemId: activeAnalyzableItem.id,
        title: activeAnalyzableItem.title || activeAnalyzableItem.contentText || '当前文本项',
        ...analysisResult
      })
    } catch {
      notifyActionResult('文本分析暂时不可用，请稍后重试。')
    } finally {
      setIsAnalyzingText(false)
    }
  }

  const handleCopyAnalysisItems = (items) => {
    if (!items?.length || !window.utools?.copyText) return false
    const text = items
      .slice()
      .sort((left, right) => left.start - right.start)
      .map((item) => item.text)
      .join('')

    if (window.utools.copyText(text)) {
      notifyActionResult(`已复制 ${items.length} 个分词项。`)
      return true
    }

    return false
  }

  const handleCreateFavorite = () => {
    handleActivatePane('favorite')
    setFavoriteDraft({
      mode: 'create',
      type: 'text',
      title: '',
      contentText: ''
    })
  }

  const handleEditFavorite = () => {
    if (!activeFavoriteItem) return

    setFavoriteDraft({
      mode: 'edit',
      favoriteId: activeFavoriteItem.id,
      type: activeFavoriteItem.type,
      title: activeFavoriteItem.title || '',
      contentText: activeFavoriteItem.contentText || '',
      filePaths: activeFavoriteItem.filePaths || []
    })
  }

  const handleSaveFavoriteDraft = (draftValues) => {
    if (!favoriteDraft) return

    if (favoriteDraft.mode === 'create-tab') {
      const createdTab = addFavoriteTab(draftValues.title)
      if (createdTab) {
        handleActivatePane('favorite')
        setActiveFavoriteTabId(createdTab.id)
        notifyActionResult('已创建新的收藏分组。')
      }
      setFavoriteDraft(null)
      return
    }

    if (favoriteDraft.mode === 'create') {
      const createdFavorite = createFavoriteItem(draftValues, activeFavoriteTabId)
      if (createdFavorite) {
        notifyActionResult('已创建新的收藏项。')
      }
      setFavoriteDraft(null)
      return
    }

    const updatedFavorite = updateFavoriteItem(favoriteDraft.favoriteId, draftValues)
    if (updatedFavorite) {
      notifyActionResult('已更新当前收藏项。')
    }
    setFavoriteDraft(null)
  }

  const handleManageFavoriteTabs = () => {
    setIsManagingTabs(true)
  }

  const handleCreateFavoriteTab = (name) => {
    const createdTab = addFavoriteTab(name)
    if (!createdTab) return null

    notifyActionResult('已创建新的收藏分组。')
    handleActivatePane('favorite')
    setActiveFavoriteTabId(createdTab.id)
    return createdTab
  }

  const handleRenameFavoriteTab = (tabId, name) => {
    const updatedTab = renameFavoriteTab(tabId, name)
    if (updatedTab) {
      notifyActionResult('已更新收藏分组名称。')
    }
    return updatedTab
  }

  const handleRemoveFavoriteTab = (tabId) => {
    const removeResult = removeFavoriteTab(tabId)
    if (removeResult.status === 'blocked-last-tab') {
      notifyActionResult('至少保留一个收藏分组。')
      return removeResult
    }

    if (removeResult.status === 'removed') {
      if (activeFavoriteTabId === tabId && removeResult.fallbackTabId) {
        setActiveFavoriteTabId(removeResult.fallbackTabId)
      }
      notifyActionResult('已删除收藏分组，并同步清理分组引用。')
    }

    return removeResult
  }

  const updatePaneSelection = (pane, selectedIds) => {
    setSelectedIdsByPane((currentState) => ({
      ...currentState,
      [pane]: selectedIds
    }))
  }

  const handleSelectItem = (item, index, pane = activePane, event = null) => {
    const visibleItems = pane === 'history' ? filteredHistoryItems : filteredFavoriteItems
    const metaPressed = event?.ctrlKey || event?.metaKey
    const shiftPressed = event?.shiftKey
    const currentSelectedIds = selectedIdsByPane[pane]
    const currentIndex = pane === 'history' ? selectedHistoryIndex : selectedFavoriteIndex

    setSelectedIndex(pane, index)

    if (shiftPressed && visibleItems.length) {
      const anchorIndex = selectionAnchorRef.current[pane] ?? currentIndex
      updatePaneSelection(pane, buildRangeSelectionIds(visibleItems, anchorIndex, index))
      return
    }

    selectionAnchorRef.current[pane] = index

    if (metaPressed) {
      if (currentSelectedIds.includes(item.id)) {
        if (currentSelectedIds.length <= 1) {
          updatePaneSelection(pane, currentSelectedIds)
          return
        }

        const removedIndex = currentSelectedIds.indexOf(item.id)
        const nextSelectedIds = currentSelectedIds.filter((selectedId) => selectedId !== item.id)
        const nextActiveId = nextSelectedIds[Math.min(removedIndex, nextSelectedIds.length - 1)]
        const nextActiveIndex = visibleItems.findIndex((visibleItem) => visibleItem.id === nextActiveId)

        if (nextActiveIndex >= 0) {
          setSelectedIndex(pane, nextActiveIndex)
          selectionAnchorRef.current[pane] = nextActiveIndex
        }

        updatePaneSelection(pane, nextSelectedIds)
        return
      }

      const nextSelectedIds = [...currentSelectedIds, item.id]
      updatePaneSelection(pane, nextSelectedIds)
      return
    }

    updatePaneSelection(pane, [item.id])
  }

  const handleMoveSelection = (direction) => {
    const pane = activePane
    const items = pane === 'history' ? filteredHistoryItems : filteredFavoriteItems
    if (!items.length) return

    const currentIndex = pane === 'history' ? selectedHistoryIndex : selectedFavoriteIndex
    const delta = direction === 'down' ? 1 : -1
    const nextIndex = clampIndex(currentIndex + delta, items.length - 1)
    const nextItem = items[nextIndex]
    if (!nextItem) return

    selectionAnchorRef.current[pane] = nextIndex
    setSelectedIndex(pane, nextIndex)
    updatePaneSelection(pane, [nextItem.id])
  }

  const handleToolbarCopy = () => {
    if (activeSelectedItems.length > 1) {
      if (copyClipboardItems(activeSelectedItems)) {
        notifyActionResult(`已复制 ${activeSelectedItems.length} 项到系统剪贴板。`)
      }
      return
    }

    if (activeItem) {
      handleCopyItem(activeItem, activeItemIndex)
      return
    }

    triggerAction('copy')
  }

  const handleToolbarPaste = () => {
    if (activeSelectedItems.length > 1) {
      if (pasteClipboardItems(activeSelectedItems)) {
        notifyActionResult(`已合并粘贴 ${activeSelectedItems.length} 项内容。`)
      }
      return
    }

    if (activeItem) {
      handlePasteItem(activeItem, activeItemIndex)
      return
    }

    triggerAction('paste')
  }

  useEffect(() => {
    if (!filteredHistoryItems.length) return
    if (selectedHistoryIndex < filteredHistoryItems.length) return
    setSelectedIndex('history', filteredHistoryItems.length - 1)
  }, [filteredHistoryItems.length, selectedHistoryIndex, setSelectedIndex])

  useEffect(() => {
    const visibleIds = new Set(filteredHistoryItems.map((item) => item.id))
    setSelectedIdsByPane((currentState) => ({
      ...currentState,
      history: currentState.history.filter((itemId) => visibleIds.has(itemId))
    }))
  }, [filteredHistoryItems])

  useEffect(() => {
    if (!filteredFavoriteItems.length) return
    if (selectedFavoriteIndex < filteredFavoriteItems.length) return
    setSelectedIndex('favorite', filteredFavoriteItems.length - 1)
  }, [filteredFavoriteItems.length, selectedFavoriteIndex, setSelectedIndex])

  useEffect(() => {
    const visibleIds = new Set(filteredFavoriteItems.map((item) => item.id))
    setSelectedIdsByPane((currentState) => ({
      ...currentState,
      favorite: currentState.favorite.filter((itemId) => visibleIds.has(itemId))
    }))
  }, [filteredFavoriteItems])

  useEffect(() => {
    if (!favoriteTabs.length) return
    if (favoriteTabs.some((tab) => tab.id === activeFavoriteTabId)) return
    setActiveFavoriteTabId(favoriteTabs[0].id)
  }, [activeFavoriteTabId, favoriteTabs, setActiveFavoriteTabId])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const metaPressed = event.ctrlKey || event.metaKey

      if (metaPressed && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        window.utools?.subInputFocus?.()
        return
      }

      if (metaPressed && event.key === ',') {
        event.preventDefault()
        onOpenSettings?.()
        return
      }

      if (metaPressed && event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleToggleFavoriteCurrentItem()
        return
      }

      if (metaPressed && event.key.toLowerCase() === 'e') {
        if (activePane !== 'favorite' || !activeFavoriteItem) return
        event.preventDefault()
        handleEditFavorite()
        return
      }

      if (metaPressed && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleCreateFavorite()
        return
      }

      if (metaPressed && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault()
        handleManageFavoriteTabs()
        return
      }

      if (metaPressed && /^[1-9]$/.test(event.key)) {
        const tabIndex = Number(event.key) - 1
        const targetTab = favoriteTabs[tabIndex]
        if (!targetTab) return
        event.preventDefault()
        resetMultiSelection()
        setActivePane('favorite')
        setActiveFavoriteTabId(targetTab.id)
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        const nextTabId = getAdjacentFavoriteTabId(
          favoriteTabs,
          activeFavoriteTabId,
          event.shiftKey ? 'previous' : 'next'
        )
        if (!nextTabId) return
        resetMultiSelection()
        setActivePane('favorite')
        setActiveFavoriteTabId(nextTabId)
        return
      }

      if (event.key === 'ArrowRight' && activePane === 'history') {
        event.preventDefault()
        handleActivatePane('favorite')
        return
      }

      if (event.key === 'ArrowLeft' && activePane === 'favorite') {
        event.preventDefault()
        handleActivatePane('history')
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        handleMoveSelection('down')
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        handleMoveSelection('up')
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        if (!activeItem) return

        const now = Date.now()
        const isDoubleEnter = now - lastEnterAtRef.current <= 300
        lastEnterAtRef.current = now

        if (isDoubleEnter) {
          handleToolbarPaste()
        } else {
          handleSelectItem(activeItem, activeItemIndex, activePane)
        }
        return
      }

      if (event.key === ' ') {
        const activeElement = document.activeElement
        const isTyping = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
        if (isTyping) return
        event.preventDefault()
        handleToolbarPaste()
      }

      if (metaPressed && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        if (activeSelectedItems.length > 1) {
          handleDeleteSelectedItems()
        } else {
          handleDeleteCurrentItem()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    activeFavoriteItem,
    activeItem,
    activePane,
    activeFavoriteTabId,
    favoriteTabs,
    filteredFavoriteItems.length,
    filteredHistoryItems.length,
    onOpenSettings,
    selectedFavoriteIndex,
    selectedHistoryIndex,
    setActiveFavoriteTabId,
    setActivePane,
    setSelectedIndex,
    triggerAction,
    activeSelectedItems,
    handleDeleteSelectedItems,
    handleToolbarCopy,
    handleToolbarPaste
  ])

  return (
    <div className='clipboard-page'>
      <SplitLayout
        left={(
          <section className={`clipboard-pane ${activePane === 'history' ? 'is-active' : ''}`}>
            <PaneHeader
              title='History'
              count={filteredHistoryItems.length}
              isActive={activePane === 'history'}
              actions={[
                { key: 'settings', label: '设置', icon: buildHeaderIcon(SettingTwo), onClick: onOpenSettings },
                ...(activeHistoryItem
                  ? [{
                      key: 'favorite',
                      label: getHistoryFavoriteActionLabel(activeHistoryItem.favoriteStatus),
                      icon: buildHeaderIcon(Star),
                      onClick: handleToggleFavoriteCurrentItem
                    }]
                : [])
              ]}
            />
            <TabBar
              tabs={historyTypeTabs}
              activeTabId={activeHistoryTypeTabId}
              onChange={(tabId) => {
                resetMultiSelection()
                setActivePane('history')
                setActiveHistoryTypeTabId(tabId)
                setSelectedIndex('history', 0)
              }}
            />
            <HistoryList
              items={filteredHistoryItems}
              query={query}
              selectedIndex={selectedHistoryIndex}
              selectedIds={selectedIdsByPane.history}
              isActive={activePane === 'history'}
              onSelectItem={(item, index, event) => handleSelectItem(item, index, 'history', event)}
              onPasteItem={(item, index) => handlePasteItem(item, index, 'history')}
              onPreviewItem={(item, index, event) => handlePreviewItem(item, index, 'history', event)}
            />
          </section>
        )}
        right={(
          <section className={`clipboard-pane ${activePane === 'favorite' ? 'is-active' : ''}`}>
            <PaneHeader
              title='Favorites'
              count={filteredFavoriteItems.length}
              isActive={activePane === 'favorite'}
              actions={[
                { key: 'new', label: '新建', icon: buildHeaderIcon(Newlybuild), onClick: handleCreateFavorite },
                { key: 'tab', label: '管理分组', icon: buildHeaderIcon(ConnectionBox), onClick: handleManageFavoriteTabs },
                ...(activeFavoriteItem
                  ? [{ key: 'edit', label: '编辑', icon: buildHeaderIcon(FileEditing), onClick: handleEditFavorite }]
                  : [])
              ]}
            />
            <TabBar
              tabs={favoriteTabs}
              activeTabId={activeFavoriteTabId}
              showIndexBadge
              onChange={(tabId) => {
                resetMultiSelection()
                setActivePane('favorite')
                setActiveFavoriteTabId(tabId)
              }}
            />
            <FavoriteList
              items={filteredFavoriteItems}
              query={query}
              selectedIndex={selectedFavoriteIndex}
              selectedIds={selectedIdsByPane.favorite}
              isActive={activePane === 'favorite'}
              onSelectItem={(item, index, event) => handleSelectItem(item, index, 'favorite', event)}
              onPasteItem={(item, index) => handlePasteItem(item, index, 'favorite')}
              onPreviewItem={(item, index, event) => handlePreviewItem(item, index, 'favorite', event)}
            />
          </section>
        )}
      />
      {favoriteDraft
        ? (
          <FavoriteEditor
            draft={favoriteDraft}
            onCancel={() => setFavoriteDraft(null)}
            onSubmit={handleSaveFavoriteDraft}
          />
          )
        : null}
      {isManagingTabs
        ? (
          <FavoriteTabManager
            tabs={favoriteTabs}
            favoriteItems={favoriteItems}
            activeTabId={activeFavoriteTabId}
            onClose={() => setIsManagingTabs(false)}
            onCreateTab={handleCreateFavoriteTab}
            onRenameTab={handleRenameFavoriteTab}
            onRemoveTab={handleRemoveFavoriteTab}
            onActivateTab={(tabId) => {
              resetMultiSelection()
              setActivePane('favorite')
              setActiveFavoriteTabId(tabId)
            }}
          />
          )
        : null}
      {textAnalysisDraft
        ? (
          <TextAnalysisModal
            draft={textAnalysisDraft}
            onClose={() => setTextAnalysisDraft(null)}
            onCopyItems={handleCopyAnalysisItems}
          />
        )
        : null}
      {previewDraft
        ? (
          <PreviewModal
            item={previewDraft}
            onClose={() => setPreviewDraft(null)}
          />
        )
        : null}
      <div className='clipboard-floating-toolbar' aria-label='当前选中项操作'>
        <button
          type='button'
          className='clipboard-floating-toolbar-button'
          onClick={handleOpenTextAnalysis}
          disabled={!activeAnalyzableItem || isAnalyzingText}
          aria-label='分析当前文本项'
        >
          {buildToolbarIcon(Analysis)}
        </button>
        <button
          type='button'
          className='clipboard-floating-toolbar-button'
          onClick={activeSelectedItems.length > 1 ? handleDeleteSelectedItems : handleDeleteCurrentItem}
          disabled={!activeItem}
          aria-label='删除当前选中项'
        >
          {buildToolbarIcon(DeleteOne)}
        </button>
        <button
          type='button'
          className='clipboard-floating-toolbar-button'
          onClick={handleToolbarCopy}
          disabled={!activeItem}
          aria-label='复制当前选中项'
        >
          {buildToolbarIcon(CopyOne)}
        </button>
        <button
          type='button'
          className='clipboard-floating-toolbar-button clipboard-floating-toolbar-button-primary'
          onClick={handleToolbarPaste}
          disabled={!activeItem}
          aria-label='粘贴当前选中项'
        >
          {buildToolbarIcon(SendOne)}
        </button>
      </div>
    </div>
  )
}
