import { memo, useEffect, useState } from 'react'
import { FileTxt, FolderClose, Pic } from '@icon-park/react'
import './index.css'

const IMAGE_PLACEHOLDER_MIN_HEIGHT = 72
const DEFAULT_IMAGE_PREVIEW_MAX_HEIGHT = 160
const DEFAULT_TEXT_COLLAPSED_LINES = 6
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

function clamp (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function resolveCollapsedLines (item, textCollapsedLines) {
  const normalizedLines = Number(textCollapsedLines) || DEFAULT_TEXT_COLLAPSED_LINES
  if (item.type === 'text' || item.type === 'html') {
    return normalizedLines
  }

  return Math.min(normalizedLines, 2)
}

function resolvePreviewHeight (item, imagePreviewMaxHeight) {
  const maxHeight = Number(imagePreviewMaxHeight) || DEFAULT_IMAGE_PREVIEW_MAX_HEIGHT

  if (item.type !== 'image') return maxHeight

  const imageHeight = Number(item.imageHeight) || maxHeight
  const imageWidth = Number(item.imageWidth) || 0
  const normalizedHeight = imageWidth > 0
    ? Math.round((imageHeight / imageWidth) * 240)
    : imageHeight

  return clamp(normalizedHeight || maxHeight, IMAGE_PLACEHOLDER_MIN_HEIGHT, maxHeight)
}

export function estimateClipboardItemHeight (item, settings = {}) {
  if (!item) return 0

  if (item.type === 'image') {
    return resolvePreviewHeight(item, settings.imagePreviewMaxHeight) + 68
  }

  const collapsedLines = resolveCollapsedLines(item, settings.textCollapsedLines)
  const lineCount = clamp(Number(item.textMetrics?.lineCount) || 1, 1, collapsedLines)
  return 42 + (lineCount * 18)
}

function useClipboardImageDataUrl (imagePath, enabled) {
  const [imageDataUrl, setImageDataUrl] = useState(() => {
    if (!imagePath) return ''
    return imageDataUrlCache.get(imagePath) || ''
  })

  useEffect(() => {
    if (!imagePath) {
      setImageDataUrl('')
      return
    }

    const cachedDataUrl = imageDataUrlCache.get(imagePath)
    if (cachedDataUrl) {
      setImageDataUrl(cachedDataUrl)
      return
    }

    setImageDataUrl('')
    if (!enabled) return

    let cancelled = false

    const loadImageDataUrl = () => {
      if (cancelled) return

      const nextDataUrl = window.services?.readImageDataUrl?.(imagePath) || ''
      if (cancelled || !nextDataUrl) return

      imageDataUrlCache.set(imagePath, nextDataUrl)
      setImageDataUrl(nextDataUrl)
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(loadImageDataUrl, { timeout: 180 })
      return () => {
        cancelled = true
        window.cancelIdleCallback?.(idleId)
      }
    }

    const timer = window.setTimeout(loadImageDataUrl, 16)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [enabled, imagePath])

  return imageDataUrl
}

const ClipboardItem = memo(function ClipboardItem ({
  item,
  query,
  isSelected,
  allowImageLoading = true,
  textCollapsedLines = DEFAULT_TEXT_COLLAPSED_LINES,
  imagePreviewMaxHeight = DEFAULT_IMAGE_PREVIEW_MAX_HEIGHT,
  onClick,
  onDoubleClick
}) {
  const favoriteBadgeLabel = getFavoriteBadgeLabel(item.favoriteStatus)
  const TypeIcon = getTypeIconComponent(item.type)
  const isImageItem = item.type === 'image'
  const collapsedLines = resolveCollapsedLines(item, textCollapsedLines)
  const resolvedPreviewHeight = resolvePreviewHeight(item, imagePreviewMaxHeight)
  const imageDataUrl = useClipboardImageDataUrl(item.imagePath, isImageItem && allowImageLoading)

  return (
    <article
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
                      style={{ '--clipboard-image-max-height': `${imagePreviewMaxHeight}px` }}
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
                      <div
                        className='clipboard-item-image-placeholder'
                        style={{ '--clipboard-image-fallback-height': `${resolvedPreviewHeight}px` }}
                        aria-hidden='true'
                      />
                      <div className='clipboard-item-image-fallback-text'>
                        {renderHighlightedText(item.title, query, item.highlight)}
                      </div>
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
}, areClipboardItemPropsEqual)

function areClipboardItemPropsEqual (previousProps, nextProps) {
  return previousProps.item === nextProps.item &&
    previousProps.query === nextProps.query &&
    previousProps.isSelected === nextProps.isSelected &&
    previousProps.allowImageLoading === nextProps.allowImageLoading &&
    previousProps.textCollapsedLines === nextProps.textCollapsedLines &&
    previousProps.imagePreviewMaxHeight === nextProps.imagePreviewMaxHeight
}

export default ClipboardItem
