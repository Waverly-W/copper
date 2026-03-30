import { useEffect, useMemo, useState } from 'react'
import { ConnectionBox, FileEditing, Newlybuild, SettingTwo, Star } from '@icon-park/react'
import SplitLayout from '../../components/split-layout'
import PaneHeader from '../../components/pane-header'
import HistoryList from '../../components/history-list'
import FavoriteList from '../../components/favorite-list'
import FavoriteEditor from '../../components/favorite-editor'
import FavoriteTabManager from '../../components/favorite-tab-manager'
import TabBar from '../../components/tab-bar'
import { copyClipboardItem, notifyActionResult, pasteClipboardItem } from '../../services/clipboard/item-actions'
import { useSearchResults } from '../../services/search/use-search-results'
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

export default function ClipboardPage ({ onOpenSettings }) {
  const [favoriteDraft, setFavoriteDraft] = useState(null)
  const [isManagingTabs, setIsManagingTabs] = useState(false)
  const [activeHistoryTypeTabId, setActiveHistoryTypeTabId] = useState('all')
  const {
    query,
    activePane,
    activeFavoriteTabId,
    selectedHistoryIndex,
    selectedFavoriteIndex,
    setActivePane,
    setActiveFavoriteTabId,
    setSelectedIndex,
    moveSelection,
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

  const handleCreateFavorite = () => {
    setActivePane('favorite')
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
        setActivePane('favorite')
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
    setActivePane('favorite')
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

  useEffect(() => {
    if (!filteredHistoryItems.length) return
    if (selectedHistoryIndex < filteredHistoryItems.length) return
    setSelectedIndex('history', filteredHistoryItems.length - 1)
  }, [filteredHistoryItems.length, selectedHistoryIndex, setSelectedIndex])

  useEffect(() => {
    if (!filteredFavoriteItems.length) return
    if (selectedFavoriteIndex < filteredFavoriteItems.length) return
    setSelectedIndex('favorite', filteredFavoriteItems.length - 1)
  }, [filteredFavoriteItems.length, selectedFavoriteIndex, setSelectedIndex])

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
        setActivePane('favorite')
        setActiveFavoriteTabId(nextTabId)
        return
      }

      if (event.key === 'ArrowRight' && activePane === 'history') {
        event.preventDefault()
        setActivePane('favorite')
        return
      }

      if (event.key === 'ArrowLeft' && activePane === 'favorite') {
        event.preventDefault()
        setActivePane('history')
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelection('down', {
          historyCount: filteredHistoryItems.length,
          favoriteCount: filteredFavoriteItems.length
        })
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveSelection('up', {
          historyCount: filteredHistoryItems.length,
          favoriteCount: filteredFavoriteItems.length
        })
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        if (activeItem) {
          handleCopyItem(activeItem, activePane === 'history' ? selectedHistoryIndex : selectedFavoriteIndex)
        } else {
          triggerAction('copy')
        }
        return
      }

      if (event.key === ' ') {
        const activeElement = document.activeElement
        const isTyping = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'
        if (isTyping) return
        event.preventDefault()
        if (activeItem) {
          handlePasteItem(activeItem, activePane === 'history' ? selectedHistoryIndex : selectedFavoriteIndex)
        } else {
          triggerAction('paste')
        }
      }

      if (metaPressed && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        handleDeleteCurrentItem()
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
    moveSelection,
    onOpenSettings,
    selectedFavoriteIndex,
    selectedHistoryIndex,
    setActiveFavoriteTabId,
    setActivePane,
    setSelectedIndex,
    triggerAction
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
                setActivePane('history')
                setActiveHistoryTypeTabId(tabId)
                setSelectedIndex('history', 0)
              }}
            />
            <HistoryList
              items={filteredHistoryItems}
              query={query}
              selectedIndex={selectedHistoryIndex}
              isActive={activePane === 'history'}
              onFocus={() => setActivePane('history')}
              onCopyItem={(item, index) => handleCopyItem(item, index, 'history')}
              onPasteItem={(item, index) => handlePasteItem(item, index, 'history')}
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
                setActivePane('favorite')
                setActiveFavoriteTabId(tabId)
              }}
            />
            <FavoriteList
              items={filteredFavoriteItems}
              query={query}
              selectedIndex={selectedFavoriteIndex}
              isActive={activePane === 'favorite'}
              onFocus={() => setActivePane('favorite')}
              onCopyItem={(item, index) => handleCopyItem(item, index, 'favorite')}
              onPasteItem={(item, index) => handlePasteItem(item, index, 'favorite')}
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
              setActivePane('favorite')
              setActiveFavoriteTabId(tabId)
            }}
          />
          )
        : null}
    </div>
  )
}
