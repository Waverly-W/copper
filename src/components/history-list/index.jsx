import { forwardRef } from 'react'
import VirtualizedClipboardList from '../virtualized-clipboard-list'

const HistoryList = forwardRef(function HistoryList ({
  items,
  query,
  selectedIndex,
  selectedIds,
  isActive,
  selectionScrollMode,
  onSelectItem,
  onPasteItem,
  onPreviewItem
}, ref) {
  return (
    <VirtualizedClipboardList
      ref={ref}
      items={items}
      query={query}
      selectedIndex={selectedIndex}
      selectedIds={selectedIds}
      isActive={isActive}
      selectionScrollMode={selectionScrollMode}
      onSelectItem={onSelectItem}
      onPasteItem={onPasteItem}
      onPreviewItem={onPreviewItem}
      emptyTitle='没有匹配的历史记录'
      emptyDescription='继续复制内容或调整关键词，这里会按匹配度和时间重新排序。'
    />
  )
})

export default HistoryList
