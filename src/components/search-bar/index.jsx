import './index.css'

export default function SearchBar ({
  actionLabel,
  onActionClick
}) {
  return (
    <div className='search-bar'>
      <div className='search-bar-copy'>
        <span className='search-bar-eyebrow'>Clipboard Workspace</span>
        <div className='search-bar-main'>
          <div className='search-bar-title'>使用 uTools 子输入框搜索剪贴板</div>
          <div className='search-bar-hint'>Enter 复制，Space 粘贴，Tab 切换双栏，Ctrl/Cmd + F 聚焦搜索。</div>
        </div>
      </div>
      {onActionClick
        ? (
          <button
            type='button'
            className='search-bar-action'
            onClick={onActionClick}
          >
            {actionLabel || '设置'}
          </button>
          )
        : null}
    </div>
  )
}
