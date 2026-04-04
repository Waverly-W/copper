import { useEffect, useMemo, useState } from 'react'
import { CloseSmall, ConnectionBox, Delete, Plus } from '@icon-park/react'
import './index.css'

function buildDraftMap (tabs) {
  return tabs.reduce((map, tab) => {
    map[tab.id] = tab.name
    return map
  }, {})
}

export default function FavoriteTabManager ({
  tabs,
  favoriteItems,
  activeTabId,
  onClose,
  onCreateTab,
  onRenameTab,
  onRemoveTab,
  onActivateTab
}) {
  const [draftNames, setDraftNames] = useState(() => buildDraftMap(tabs))
  const [newTabName, setNewTabName] = useState('')

  useEffect(() => {
    setDraftNames(buildDraftMap(tabs))
  }, [tabs])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const tabUsageMap = useMemo(() => {
    return favoriteItems.reduce((map, item) => {
      item.tabIds?.forEach((tabId) => {
        map[tabId] = (map[tabId] || 0) + 1
      })
      return map
    }, {})
  }, [favoriteItems])

  return (
    <div className='favorite-tab-manager-backdrop'>
      <div className='favorite-tab-manager'>
        <header className='favorite-tab-manager-header'>
          <div className='favorite-tab-manager-header-copy'>
            <h3>管理分组</h3>
            <p>新增、切换、重命名或删除收藏分组。</p>
          </div>
          <button
            type='button'
            className='favorite-tab-manager-icon-button'
            onClick={onClose}
            aria-label='关闭分组管理'
            title='关闭'
          >
            <CloseSmall theme='outline' size={18} fill='currentColor' />
          </button>
        </header>

        <section className='favorite-tab-manager-create'>
          <span className='favorite-tab-manager-section-label'>新增分组</span>
          <div className='favorite-tab-manager-create-field'>
            <ConnectionBox theme='outline' size={16} fill='currentColor' />
            <input
              value={newTabName}
              onChange={(event) => setNewTabName(event.target.value)}
              placeholder='输入新的分组名称'
            />
          </div>
          <button
            type='button'
            className='favorite-tab-manager-primary'
            onClick={() => {
              const createdTab = onCreateTab?.(newTabName)
              if (createdTab) {
                setNewTabName('')
              }
            }}
          >
            <Plus theme='outline' size={16} fill='currentColor' />
            <span>新增分组</span>
          </button>
        </section>

        <div className='favorite-tab-manager-list'>
          {tabs.map((tab) => (
            <article
              key={tab.id}
              className={`favorite-tab-manager-item ${tab.id === activeTabId ? 'is-active' : ''}`}
            >
              <div className='favorite-tab-manager-item-main'>
                <button
                  type='button'
                  className='favorite-tab-manager-tab-chip'
                  onClick={() => onActivateTab?.(tab.id)}
                >
                  {tab.name}
                </button>
                <input
                  value={draftNames[tab.id] || ''}
                  onChange={(event) => {
                    setDraftNames((current) => ({
                      ...current,
                      [tab.id]: event.target.value
                    }))
                  }}
                  aria-label={`${tab.name} 分组名称`}
                />
              </div>
              <div className='favorite-tab-manager-item-actions'>
                <span className='favorite-tab-manager-count'>
                  {tabUsageMap[tab.id] || 0}
                </span>
                <button
                  type='button'
                  className='favorite-tab-manager-secondary'
                  onClick={() => onRenameTab?.(tab.id, draftNames[tab.id])}
                >
                  保存
                </button>
                <button
                  type='button'
                  className='favorite-tab-manager-icon-button danger'
                  onClick={() => onRemoveTab?.(tab.id)}
                  aria-label={`删除分组 ${tab.name}`}
                  title='删除分组'
                >
                  <Delete theme='outline' size={16} fill='currentColor' />
                </button>
              </div>
            </article>
          ))}
        </div>

        <footer className='favorite-tab-manager-footer'>
          <span>删除分组时，会同步移除该分组下的收藏引用；若收藏只属于这个分组，则会一并删除。</span>
          <button
            type='button'
            className='favorite-tab-manager-secondary'
            onClick={onClose}
          >
            完成
          </button>
        </footer>
      </div>
    </div>
  )
}
