import { forwardRef } from 'react'
import VirtualizedClipboardList from '../virtualized-clipboard-list'

const HistoryList = forwardRef(function HistoryList ({
  items,
  query,
  selectedIndex,
  isActive,
  onFocus,
  onCopyItem,
  onPasteItem
}, ref) {
  return (
    <VirtualizedClipboardList
      ref={ref}
      items={items}
      query={query}
      selectedIndex={selectedIndex}
      isActive={isActive}
      onFocus={onFocus}
      onCopyItem={onCopyItem}
      onPasteItem={onPasteItem}
      emptyTitle='没有匹配的历史记录'
      emptyDescription='继续复制内容或调整关键词，这里会按匹配度和时间重新排序。'
    />
  )
})

export default HistoryList
