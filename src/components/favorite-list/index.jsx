import { forwardRef } from 'react'
import ClipboardItem from '../clipboard-item'
import EmptyState from '../empty-state'
import './index.css'

const FavoriteList = forwardRef(function FavoriteList ({
  items,
  query,
  selectedIndex,
  selectedIds,
  isActive,
  onSelectItem,
  onPasteItem
}, ref) {
  if (!items.length) {
    return (
      <div ref={ref} className='clipboard-list'>
        <EmptyState
          title='当前 Tab 里还没有收藏项'
          description='你可以从历史区直接加入收藏，或者新建一个常用片段。'
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
        />
      ))}
    </div>
  )
})

export default FavoriteList
