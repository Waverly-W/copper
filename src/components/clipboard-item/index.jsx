import { useEffect, useMemo, useRef } from 'react'
import { FileTxt, FolderClose, Pic } from '@icon-park/react'
import { useSettingsStore } from '../../stores/settings-store'
import './index.css'

function renderHighlightedText (text, query, highlight) {
  const safeText = String(text || '')
  if (!safeText) return ''

  if (highlight?.mode === 'substring') {
    const start = Math.max(0, highlight.start || 0)
    const end = Math.min(safeText.length, highlight.end || start)
    if (start < end) {
      return (
        <>
          {safeText.slice(0, start)}
          <mark>{safeText.slice(start, end)}</mark>
          {safeText.slice(end)}
        </>
      )
    }
  }

  if (highlight?.mode === 'indexes' && highlight.indexes?.length) {
    const highlightedIndexes = new Set(highlight.indexes)
    const segments = []
    let currentSegment = ''
    let isHighlighted = false

    for (let index = 0; index < safeText.length; index += 1) {
      const nextHighlighted = highlightedIndexes.has(index)
      if (index === 0) {
        isHighlighted = nextHighlighted
      }

      if (nextHighlighted !== isHighlighted) {
        segments.push({
          text: currentSegment,
          highlighted: isHighlighted
        })
        currentSegment = ''
        isHighlighted = nextHighlighted
      }

      currentSegment += safeText[index]
    }

    if (currentSegment) {
      segments.push({
        text: currentSegment,
        highlighted: isHighlighted
      })
    }

    return segments.map((segment, index) => {
      if (!segment.highlighted) return <span key={index}>{segment.text}</span>
      return <mark key={index}>{segment.text}</mark>
    })
  }

  if (!query) return safeText

  const loweredText = safeText.toLowerCase()
  const loweredQuery = query.toLowerCase()
  const start = loweredText.indexOf(loweredQuery)
  if (start === -1) return safeText

  const end = start + loweredQuery.length

  return (
    <>
      {safeText.slice(0, start)}
      <mark>{safeText.slice(start, end)}</mark>
      {safeText.slice(end)}
    </>
  )
}

function getFavoriteBadgeLabel (favoriteStatus) {
  if (favoriteStatus === 'current-tab') return '收藏中'
  if (favoriteStatus === 'other-tab') return '已收藏'
  return ''
}

function getTypeIconComponent (type) {
  switch (type) {
    case 'text':
    case 'html':
      return FileTxt
    case 'image':
      return Pic
    case 'files':
    case 'file':
    default:
      return FolderClose
  }
}

export default function ClipboardItem ({ item, query, isSelected, onClick, onDoubleClick }) {
  const itemRef = useRef(null)
  const { settings } = useSettingsStore()
  const favoriteBadgeLabel = getFavoriteBadgeLabel(item.favoriteStatus)
  const TypeIcon = getTypeIconComponent(item.type)
  const isImageItem = item.type === 'image'
  const collapsedLines = item.type === 'text' || item.type === 'html'
    ? settings.textCollapsedLines
    : Math.min(settings.textCollapsedLines, 2)
  const imageDataUrl = useMemo(() => {
    if (!isImageItem) return ''
    return window.services?.readImageDataUrl?.(item.imagePath) || ''
  }, [isImageItem, item.imagePath])

  useEffect(() => {
    if (!isSelected) return
    itemRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest'
    })
  }, [isSelected])

  return (
    <article
      ref={itemRef}
      className={`clipboard-item ${isSelected ? 'is-selected' : ''} ${isImageItem ? 'is-image' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <span
        className='clipboard-item-type'
        aria-label={item.typeLabel}
      >
        <TypeIcon
          theme='outline'
          size={18}
          strokeWidth={3}
          fill='currentColor'
        />
      </span>
      <div className='clipboard-item-content'>
        {isImageItem
          ? (
            imageDataUrl
              ? (
                <div
                  className='clipboard-item-image-wrap'
                  style={{ '--clipboard-image-max-height': `${settings.imagePreviewMaxHeight}px` }}
                >
                  <img
                    className='clipboard-item-image'
                    src={imageDataUrl}
                    alt={item.title || 'Clipboard image'}
                  />
                </div>
                )
              : (
                <div className='clipboard-item-image-fallback'>
                  {renderHighlightedText(item.title, query, item.highlight)}
                </div>
                )
            )
          : (
            <div
              className='clipboard-item-body'
              style={{ '--clipboard-item-lines': collapsedLines }}
            >
              {renderHighlightedText(item.title, query, item.highlight)}
            </div>
            )}
      </div>
      {favoriteBadgeLabel
        ? (
          <span className={`clipboard-item-favorite clipboard-item-favorite-${item.favoriteStatus}`}>
            {favoriteBadgeLabel}
          </span>
          )
        : null}
      <span className='clipboard-item-time'>{item.relativeTime}</span>
    </article>
  )
}
