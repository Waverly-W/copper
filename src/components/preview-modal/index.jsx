import { CloseOne } from '@icon-park/react'
import { useEffect, useMemo } from 'react'
import './index.css'

function getPreviewText (item) {
  return String(item?.contentText || item?.title || '')
}

function getPreviewSubtitle (item) {
  if (!item) return ''
  if (item.type === 'image') return item.title || '当前图片'

  const text = getPreviewText(item)
  return `${text.length} chars`
}

export default function PreviewModal ({
  item,
  onClose
}) {
  const imageDataUrl = useMemo(() => {
    if (item?.type !== 'image') return ''
    return window.services?.readImageDataUrl?.(item.imagePath) || ''
  }, [item])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!item) return null

  return (
    <div
      className='preview-modal-backdrop'
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div className='preview-modal'>
        <header className='preview-modal-header'>
          <div className='preview-modal-header-copy'>
            <h3>{item.type === 'image' ? '图片预览' : '文本预览'}</h3>
            <div className='preview-modal-subtitle'>{getPreviewSubtitle(item)}</div>
          </div>
          <button
            type='button'
            className='preview-modal-close'
            onClick={onClose}
            aria-label='关闭预览'
            title='关闭'
          >
            <CloseOne theme='outline' size={16} strokeWidth={2.8} fill='currentColor' />
          </button>
        </header>

        <section className={`preview-modal-body ${item.type === 'image' ? 'is-image' : 'is-text'}`}>
          {item.type === 'image'
            ? (
              imageDataUrl
                ? <img className='preview-modal-image' src={imageDataUrl} alt={item.title || 'Clipboard image'} />
                : <div className='preview-modal-empty'>图片加载失败</div>
              )
            : (
              <pre className='preview-modal-text'>{getPreviewText(item)}</pre>
              )}
        </section>
      </div>
    </div>
  )
}
