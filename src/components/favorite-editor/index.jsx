import { useEffect, useState } from 'react'
import './index.css'

function getEditorTitle (draft) {
  if (draft?.mode === 'create-tab') return '新建收藏分组'
  return draft?.mode === 'create' ? '新建收藏' : '编辑收藏'
}

function getTitleLabel (draft) {
  return draft?.mode === 'create-tab' ? '分组名称' : '标题'
}

function getTitlePlaceholder (draft) {
  return draft?.mode === 'create-tab' ? '输入新的收藏分组名称' : '输入收藏标题'
}

function getSubmitLabel (draft) {
  return draft?.mode === 'create-tab' ? '创建分组' : '保存'
}

export default function FavoriteEditor ({
  draft,
  onCancel,
  onSubmit
}) {
  const [title, setTitle] = useState(draft?.title || '')
  const [contentText, setContentText] = useState(draft?.contentText || '')

  useEffect(() => {
    setTitle(draft?.title || '')
    setContentText(draft?.contentText || '')
  }, [draft])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const isCreateTab = draft?.mode === 'create-tab'
  const isTextFavorite = draft?.type === 'text' || draft?.type === 'html'

  return (
    <div className='favorite-editor-backdrop'>
      <div className='favorite-editor'>
        <header className='favorite-editor-header'>
          <h3>{getEditorTitle(draft)}</h3>
          <button type='button' className='favorite-editor-close' onClick={onCancel}>关闭</button>
        </header>

        <label className='favorite-editor-field'>
          <span>{getTitleLabel(draft)}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={getTitlePlaceholder(draft)}
          />
        </label>

        {!isCreateTab
          ? (
            isTextFavorite
              ? (
                <label className='favorite-editor-field'>
                  <span>内容</span>
                  <textarea
                    value={contentText}
                    onChange={(event) => setContentText(event.target.value)}
                    placeholder='输入收藏内容'
                    rows={8}
                  />
                </label>
                )
              : (
                <div className='favorite-editor-field'>
                  <span>内容</span>
                  <div className='favorite-editor-readonly'>
                    {draft?.type === 'image'
                      ? '图片收藏暂不支持直接修改内容，只支持修改标题。'
                      : (draft?.filePaths?.join('\n') || '该收藏内容当前只支持修改标题。')}
                  </div>
                </div>
                )
            )
          : null}

        <footer className='favorite-editor-actions'>
          <button type='button' className='secondary' onClick={onCancel}>取消</button>
          <button
            type='button'
            className='primary'
            onClick={() => onSubmit?.({
              title,
              contentText
            })}
          >
            {getSubmitLabel(draft)}
          </button>
        </footer>
      </div>
    </div>
  )
}
