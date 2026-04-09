import { forwardRef, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ClipboardItem, { estimateClipboardItemHeight } from './clipboard-item'
import EmptyState from './empty-state'
import { useSettingsStore } from '../stores/settings-store'
import './virtualized-clipboard-list.css'

const LIST_PADDING_PX = 8
const OVERSCAN_PX = 320
const SCROLL_IDLE_MS = 96

function clamp (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function buildLayout(items, measuredHeights, settings) {
  const offsets = new Array(items.length)
  const sizes = new Array(items.length)
  let totalHeight = 0

  items.forEach((item, index) => {
    offsets[index] = totalHeight
    const nextSize = measuredHeights.get(item.id) || estimateClipboardItemHeight(item, settings)
    sizes[index] = nextSize
    totalHeight += nextSize
  })

  return { offsets, sizes, totalHeight }
}

function findStartIndex(offsets, targetOffset) {
  if (!offsets.length) return 0

  let low = 0
  let high = offsets.length - 1
  let answer = 0

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (offsets[middle] <= targetOffset) {
      answer = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return answer
}

function resolveVisibleRange(offsets, sizes, scrollTop, viewportHeight) {
  if (!offsets.length) {
    return {
      startIndex: 0,
      endIndex: 0
    }
  }

  const rangeTop = Math.max(scrollTop - OVERSCAN_PX, 0)
  const rangeBottom = scrollTop + viewportHeight + OVERSCAN_PX
  const startIndex = findStartIndex(offsets, rangeTop)
  let endIndex = startIndex

  while (endIndex < sizes.length && (offsets[endIndex] + sizes[endIndex]) < rangeBottom) {
    endIndex += 1
  }

  return {
    startIndex,
    endIndex: clamp(endIndex, startIndex, sizes.length - 1)
  }
}

const VirtualizedClipboardList = forwardRef(function VirtualizedClipboardList ({
  items,
  query,
  selectedIndex,
  selectedIds = [],
  isActive,
  selectionScrollMode = 'programmatic',
  onFocus,
  onSelectItem,
  onPasteItem,
  onPreviewItem,
  emptyTitle,
  emptyDescription
}, ref) {
  const { settings } = useSettingsStore()
  const containerRef = useRef(null)
  const measuredHeightsRef = useRef(new Map())
  const measureDispatcherRef = useRef(() => {})
  const pendingScrollTopRef = useRef(0)
  const scrollFrameRef = useRef(0)
  const scrollIdleTimerRef = useRef(0)
  const previousSelectedIndexRef = useRef(-1)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [measureVersion, setMeasureVersion] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)

  const setContainerNode = (node) => {
    containerRef.current = node

    if (typeof ref === 'function') {
      ref(node)
      return
    }

    if (ref) {
      ref.current = node
    }
  }

  useEffect(() => {
    measuredHeightsRef.current.clear()
    setMeasureVersion((version) => version + 1)
  }, [settings.imagePreviewMaxHeight, settings.textCollapsedLines])

  useEffect(() => {
    const nextIds = new Set(items.map((item) => item.id))
    let hasRemovedMeasurements = false

    Array.from(measuredHeightsRef.current.keys()).forEach((itemId) => {
      if (nextIds.has(itemId)) return
      measuredHeightsRef.current.delete(itemId)
      hasRemovedMeasurements = true
    })

    if (hasRemovedMeasurements) {
      setMeasureVersion((version) => version + 1)
    }
  }, [items])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const syncViewportHeight = () => {
      setViewportHeight(container.clientHeight)
    }

    syncViewportHeight()

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(syncViewportHeight)
      observer.observe(container)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', syncViewportHeight)
    return () => window.removeEventListener('resize', syncViewportHeight)
  }, [])

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) {
        window.cancelAnimationFrame(scrollFrameRef.current)
      }

      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current)
      }
    }
  }, [])

  const { offsets, sizes, totalHeight } = useMemo(() => {
    return buildLayout(items, measuredHeightsRef.current, settings)
  }, [items, measureVersion, settings])

  const { startIndex, endIndex } = useMemo(() => {
    return resolveVisibleRange(offsets, sizes, scrollTop, viewportHeight || 1)
  }, [offsets, scrollTop, sizes, viewportHeight])

  const visibleItems = items.slice(startIndex, endIndex + 1)
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  useLayoutEffect(() => {
    const previousSelectedIndex = previousSelectedIndexRef.current
    previousSelectedIndexRef.current = selectedIndex

    if (!isActive) return
    if (!items.length) return
    if (selectedIndex < 0 || selectedIndex >= items.length) return
    if (previousSelectedIndex === selectedIndex) return
    if (selectionScrollMode === 'pointer') return

    const container = containerRef.current
    if (!container) return

    const itemTop = LIST_PADDING_PX + (offsets[selectedIndex] || 0)
    const itemBottom = itemTop + (sizes[selectedIndex] || 0)
    const viewportTop = container.scrollTop
    const viewportBottom = viewportTop + container.clientHeight

    if (itemTop < viewportTop) {
      container.scrollTop = Math.max(itemTop - LIST_PADDING_PX, 0)
      setScrollTop(container.scrollTop)
      return
    }

    if (itemBottom > viewportBottom) {
      container.scrollTop = itemBottom - container.clientHeight + LIST_PADDING_PX
      setScrollTop(container.scrollTop)
    }
  }, [isActive, items.length, offsets, selectedIndex, selectionScrollMode, sizes])

  const handleScroll = (event) => {
    pendingScrollTopRef.current = event.currentTarget.scrollTop

    setIsScrolling(true)

    if (scrollIdleTimerRef.current) {
      window.clearTimeout(scrollIdleTimerRef.current)
    }

    scrollIdleTimerRef.current = window.setTimeout(() => {
      setIsScrolling(false)
    }, SCROLL_IDLE_MS)

    if (scrollFrameRef.current) return

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = 0
      setScrollTop(pendingScrollTopRef.current)
    })
  }

  measureDispatcherRef.current = (itemId, nextHeight) => {
    if (!itemId || !nextHeight) return

    const normalizedHeight = Math.ceil(nextHeight)
    if (measuredHeightsRef.current.get(itemId) === normalizedHeight) return

    measuredHeightsRef.current.set(itemId, normalizedHeight)
    setMeasureVersion((version) => version + 1)
  }

  if (!items.length) {
    return (
      <div ref={setContainerNode} className='clipboard-list clipboard-list-empty'>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
        />
      </div>
    )
  }

  return (
    <div
      ref={setContainerNode}
      className={`clipboard-list ${isScrolling ? 'is-scrolling' : ''}`}
      onMouseEnter={onFocus}
      onScroll={handleScroll}
    >
      <div
        className='clipboard-list-spacer'
        style={{ height: `${totalHeight + (LIST_PADDING_PX * 2)}px` }}
      >
        {visibleItems.map((item, visibleIndex) => {
          const itemIndex = startIndex + visibleIndex

          return (
            <MeasuredClipboardRow
              key={item.id}
              item={item}
              query={query}
              top={LIST_PADDING_PX + offsets[itemIndex]}
              isSelected={isActive && selectedIndex === itemIndex}
              isMultiSelected={selectedIdSet.has(item.id)}
              textCollapsedLines={settings.textCollapsedLines}
              imagePreviewMaxHeight={settings.imagePreviewMaxHeight}
              measureDispatcher={measureDispatcherRef}
              onSelectItem={(event) => onSelectItem(item, itemIndex, event)}
              onPasteItem={() => onPasteItem(item, itemIndex)}
              onPreviewItem={(event) => onPreviewItem?.(item, itemIndex, event)}
            />
          )
        })}
      </div>
    </div>
  )
})

const MeasuredClipboardRow = memo(function MeasuredClipboardRow ({
  item,
  query,
  top,
  isSelected,
  isMultiSelected,
  textCollapsedLines,
  imagePreviewMaxHeight,
  measureDispatcher,
  onSelectItem,
  onPasteItem,
  onPreviewItem
}) {
  const rowRef = useRef(null)

  useLayoutEffect(() => {
    const rowNode = rowRef.current
    if (!rowNode) return

    const measure = () => {
      measureDispatcher.current(item.id, rowNode.offsetHeight)
    }

    measure()

    if (typeof ResizeObserver !== 'function') return undefined

    const observer = new ResizeObserver(measure)
    observer.observe(rowNode)
    return () => observer.disconnect()
  }, [item.id, measureDispatcher])

  return (
    <div
      ref={rowRef}
      className='clipboard-list-row'
      style={{ top: `${top}px` }}
    >
      <ClipboardItem
        item={item}
        query={query}
        isSelected={isSelected}
        isMultiSelected={isMultiSelected}
        textCollapsedLines={textCollapsedLines}
        imagePreviewMaxHeight={imagePreviewMaxHeight}
        onClick={onSelectItem}
        onDoubleClick={onPasteItem}
        onContextMenu={onPreviewItem}
      />
    </div>
  )
}, areMeasuredClipboardRowPropsEqual)

function areMeasuredClipboardRowPropsEqual (previousProps, nextProps) {
  return previousProps.item === nextProps.item &&
    previousProps.query === nextProps.query &&
    previousProps.top === nextProps.top &&
    previousProps.isSelected === nextProps.isSelected &&
    previousProps.isMultiSelected === nextProps.isMultiSelected &&
    previousProps.textCollapsedLines === nextProps.textCollapsedLines &&
    previousProps.imagePreviewMaxHeight === nextProps.imagePreviewMaxHeight
}

export default VirtualizedClipboardList
