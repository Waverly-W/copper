import { Clear, CloseOne, CopyOne } from '@icon-park/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './index.css'

function buildSelectableItems (draft) {
  return [...draft.tokens, ...draft.links].sort((left, right) => left.start - right.start)
}

function buildCopyText (items) {
  return items
    .slice()
    .sort((left, right) => left.start - right.start)
    .map((item) => item.text)
    .join('')
}

export default function TextAnalysisModal ({
  draft,
  onClose,
  onCopyItems
}) {
  const [selectedItemIds, setSelectedItemIds] = useState([])
  const dragSelectionRef = useRef({
    isActive: false,
    mode: 'add',
    startItemId: null,
    didDrag: false,
    visitedIds: new Set()
  })
  const suppressClickRef = useRef(false)

  useEffect(() => {
    setSelectedItemIds([])
  }, [draft])

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

  useEffect(() => {
    const handleMouseUp = () => {
      dragSelectionRef.current = {
        isActive: false,
        mode: 'add',
        startItemId: null,
        didDrag: false,
        visitedIds: new Set()
      }
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  const selectableItems = useMemo(() => buildSelectableItems(draft), [draft])
  const selectedItems = useMemo(() => {
    return selectableItems.filter((item) => selectedItemIds.includes(item.id))
  }, [selectableItems, selectedItemIds])

  const updateSelectionByMode = (itemId, mode) => {
    setSelectedItemIds((currentState) => {
      if (mode === 'add') {
        return currentState.includes(itemId) ? currentState : [...currentState, itemId]
      }

      return currentState.filter((id) => id !== itemId)
    })
  }

  const handleCopy = () => {
    if (!selectedItems.length) return

    if (onCopyItems?.(selectedItems)) {
      onClose?.()
    }
  }

  return (
    <div
      className='text-analysis-backdrop'
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div className='text-analysis-modal'>
        <header className='text-analysis-header'>
          <h3>文本分词</h3>
          <div className='text-analysis-header-actions'>
            <button
              type='button'
              className='text-analysis-icon-button'
              onClick={() => setSelectedItemIds([])}
              disabled={!selectedItemIds.length}
              aria-label='清空已选分词'
              title='清空'
            >
              <span className='text-analysis-button-icon' aria-hidden='true'>
                <Clear theme='outline' size={16} strokeWidth={2.8} fill='currentColor' />
              </span>
            </button>
            <button
              type='button'
              className='text-analysis-icon-button is-primary'
              onClick={handleCopy}
              disabled={!selectedItems.length}
              aria-label='复制已选分词'
              title='复制'
            >
              <span className='text-analysis-button-icon' aria-hidden='true'>
                <CopyOne theme='outline' size={16} strokeWidth={2.8} fill='currentColor' />
              </span>
            </button>
            <button
              type='button'
              className='text-analysis-icon-button'
              onClick={onClose}
              aria-label='关闭分词面板'
              title='关闭'
            >
              <span className='text-analysis-button-icon' aria-hidden='true'>
                <CloseOne theme='outline' size={16} strokeWidth={2.8} fill='currentColor' />
              </span>
            </button>
          </div>
        </header>

        <section className='text-analysis-panel'>
          <div className='text-analysis-token-list'>
            {selectableItems.map((item) => {
              const isSelected = selectedItemIds.includes(item.id)

              return (
                <button
                  key={item.id}
                  type='button'
                  className={`text-analysis-token ${isSelected ? 'is-selected' : ''}`}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return

                    const mode = isSelected ? 'remove' : 'add'
                    dragSelectionRef.current = {
                      isActive: true,
                      mode,
                      startItemId: item.id,
                      didDrag: false,
                      visitedIds: new Set([item.id])
                    }
                  }}
                  onMouseEnter={() => {
                    const dragState = dragSelectionRef.current
                    if (!dragState.isActive || dragState.visitedIds.has(item.id)) return

                    if (!dragState.didDrag) {
                      dragState.didDrag = true
                      suppressClickRef.current = true
                      updateSelectionByMode(dragState.startItemId, dragState.mode)
                    }

                    dragState.visitedIds.add(item.id)
                    updateSelectionByMode(item.id, dragState.mode)
                  }}
                  onClick={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false
                      return
                    }

                    setSelectedItemIds((currentState) => {
                      if (currentState.includes(item.id)) {
                        return currentState.filter((id) => id !== item.id)
                      }

                      return [...currentState, item.id]
                    })
                  }}
                  title={item.text}
                >
                  {item.text}
                </button>
              )
            })}
          </div>
          <div className='text-analysis-meta'>
            <span>{draft.sourceText.length} chars</span>
            <span>{draft.tokens.length} tokens</span>
            <span>{draft.links.length} links</span>
            {selectedItems.length
              ? <span>{buildCopyText(selectedItems).length} copied chars</span>
              : null}
          </div>
        </section>
      </div>
    </div>
  )
}
