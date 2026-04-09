import { memo, useEffect, useMemo, useRef } from 'react'
import { FileTxt, FolderClose, Pic } from '@icon-park/react'
import './index.css'

const imageDataUrlCache = new Map()

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

export function estimateClipboardItemHeight (item, settings = {}) {
  const textCollapsedLines = Number(settings.textCollapsedLines) || 2
  const imagePreviewMaxHeight = Number(settings.imagePreviewMaxHeight) || 160

  if (item?.type === 'image') {
    return Math.max(imagePreviewMaxHeight + 56, 128)
  }

  if (item?.type === 'file' || item?.type === 'files') {
    return 58
  }

  if (item?.type === 'text' || item?.type === 'html') {
    return 44 + (Math.max(textCollapsedLines, 1) * 18)
  }

  return 56
}

function ClipboardItem ({
  item,
  query,
  isSelected,
  isMultiSelected,
  textCollapsedLines = 2,
  imagePreviewMaxHeight = 160,
  onClick,
  onDoubleClick,
  onContextMenu
}) {
  const itemRef = useRef(null)
  const TypeIcon = getTypeIconComponent(item.type)
  const isImageItem = item.type === 'image'
  const isFavorited = Boolean(item.favoriteStatus)
  const collapsedLines =
    item.type === 'text' || item.type === 'html'
      ? textCollapsedLines
      : Math.min(textCollapsedLines, 2)
  const imageDataUrl = useMemo(() => {
    if (!isImageItem || !item.imagePath) return ''

    const cachedDataUrl = imageDataUrlCache.get(item.imagePath)
    if (cachedDataUrl) return cachedDataUrl

    const nextDataUrl = window.services?.readImageDataUrl?.(item.imagePath) || ''
    if (nextDataUrl) {
      imageDataUrlCache.set(item.imagePath, nextDataUrl)
    }

    return nextDataUrl
  }, [isImageItem, item.imagePath])

  useEffect(() => {
    if (!isSelected) return
    itemRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest'
    })
  }, [isSelected])

  const handleContextMenu = (event) => {
    event.preventDefault()
    event.stopPropagation()
    onContextMenu?.(event)
  }

  const handleMouseDown = (event) => {
    if (event.button === 2) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return (
    <article
      ref={itemRef}
      className={`clipboard-item ${isSelected ? 'is-selected' : ''} ${isMultiSelected ? 'is-multi-selected' : ''} ${isImageItem ? 'is-image' : ''} ${isFavorited ? 'is-favorited' : ''}`}
      onMouseDown={handleMouseDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <span className='clipboard-item-type' aria-label={item.typeLabel}>
        <TypeIcon
          theme='outline'
          size={18}
          strokeWidth={3}
          fill='currentColor'
        />
      </span>
      <div className='clipboard-item-content'>
        {isImageItem ? (
          imageDataUrl ? (
            <div
              className='clipboard-item-image-wrap'
              style={{
                '--clipboard-image-max-height': `${imagePreviewMaxHeight}px`
              }}
            >
              <img
                className='clipboard-item-image'
                src={imageDataUrl}
                alt={item.title || 'Clipboard image'}
                onMouseDown={handleMouseDown}
                onContextMenu={handleContextMenu}
              />
            </div>
          ) : (
            <div className='clipboard-item-image-fallback'>
              {renderHighlightedText(item.title, query, item.highlight)}
            </div>
          )
        ) : (
          <div
            className='clipboard-item-body'
            style={{ '--clipboard-item-lines': collapsedLines }}
          >
            {renderHighlightedText(item.title, query, item.highlight)}
          </div>
        )}
      </div>
      <span className='clipboard-item-time'>{item.relativeTime}</span>
    </article>
  )
}

export default memo(ClipboardItem)
