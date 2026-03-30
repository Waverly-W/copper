import { forwardRef } from 'react'
import ClipboardItem from '../clipboard-item'
import EmptyState from '../empty-state'
import './index.css'

const HistoryList = forwardRef(function HistoryList ({
  items,
  query,
  selectedIndex,
  isActive,
  onFocus,
  onCopyItem,
  onPasteItem
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
    <div ref={ref} className='clipboard-list' onMouseEnter={onFocus}>
      {items.map((item, index) => (
        <ClipboardItem
          key={item.id}
          item={item}
          query={query}
          isSelected={isActive && selectedIndex === index}
          onClick={() => onCopyItem(item, index)}
          onDoubleClick={() => onPasteItem(item, index)}
        />
      ))}
    </div>
  )
})

export default HistoryList
