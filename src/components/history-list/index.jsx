import { forwardRef } from 'react'
import ClipboardItem from '../clipboard-item'
import EmptyState from '../empty-state'
import './index.css'

const HistoryList = forwardRef(function HistoryList ({
  items,
  query,
  selectedIndex,
  selectedIds,
  isActive,
  onSelectItem,
  onPasteItem,
  onPreviewItem
}, ref) {
  if (!items.length) {
    return (
      <div ref={ref} className='clipboard-list'>
        <EmptyState
          title='没有匹配的历史记录'
          description='继续复制内容或调整关键词，这里会按匹配度和时间重新排序。'
        />
      </div>
    )
  }

  return (
    <div ref={ref} className='clipboard-list'>
      {items.map((item, index) => (
        <ClipboardItem
          key={item.id}
          item={item}
          query={query}
          isSelected={isActive && selectedIndex === index}
          isMultiSelected={selectedIds.includes(item.id)}
          onClick={(event) => onSelectItem(item, index, event)}
          onDoubleClick={() => onPasteItem(item, index)}
          onContextMenu={(event) => onPreviewItem?.(item, index, event)}
        />
      ))}
    </div>
  )
})

export default HistoryList
