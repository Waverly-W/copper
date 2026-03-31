import { forwardRef } from 'react'
import VirtualizedClipboardList from '../virtualized-clipboard-list'

const FavoriteList = forwardRef(function FavoriteList ({
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
      emptyTitle='当前 Tab 里还没有收藏项'
      emptyDescription='你可以从历史区直接加入收藏，或者新建一个常用片段。'
    />
  )
})

export default FavoriteList
