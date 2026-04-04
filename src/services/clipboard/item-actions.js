function resolveImageSource (item) {
  if (item.imagePath) return item.imagePath
  if (item.imageDataUrl) return item.imageDataUrl
  return ''
}

function getClipboardItemKind (item) {
  if (item.type === 'text' || item.type === 'html') return 'text'
  if (item.type === 'file' || item.type === 'files') return 'file'
  if (item.type === 'image') return 'image'
  return 'unsupported'
}

function buildCombinedText (items) {
  return items
    .map((item) => item.contentText || item.title || '')
    .filter(Boolean)
    .join('\n')
}

function buildCombinedFilePaths (items) {
  return Array.from(new Set(items.flatMap((item) => item.filePaths || [])))
}

export function copyClipboardItem (item) {
  if (!item || !window.utools) return false

  switch (item.type) {
    case 'text':
    case 'html':
      return window.utools.copyText(item.contentText || item.title)
    case 'image': {
      const imageSource = resolveImageSource(item)
      if (!imageSource) return notifyUnsupported('This image item does not have source image data yet.')
      return window.utools.copyImage(imageSource)
    }
    case 'file':
    case 'files':
      if (!item.filePaths?.length) return notifyUnsupported('This file item does not have a valid path list yet.')
      return window.utools.copyFile(item.filePaths)
    default:
      return notifyUnsupported('This item type is not supported yet.')
  }
}

export function copyClipboardItems (items) {
  if (!items?.length || !window.utools) return false
  if (items.length === 1) return copyClipboardItem(items[0])

  const itemKinds = Array.from(new Set(items.map(getClipboardItemKind)))
  if (itemKinds.length !== 1) {
    return notifyUnsupported('多选复制暂时只支持同类型内容。')
  }

  switch (itemKinds[0]) {
    case 'text': {
      const combinedText = buildCombinedText(items)
      if (!combinedText) return notifyUnsupported('选中的文本内容为空。')
      return window.utools.copyText(combinedText)
    }
    case 'file': {
      const filePaths = buildCombinedFilePaths(items)
      if (!filePaths.length) return notifyUnsupported('选中的文件项没有可用路径。')
      return window.utools.copyFile(filePaths)
    }
    case 'image':
      return notifyUnsupported('多选图片暂时不支持合并复制。')
    default:
      return notifyUnsupported('当前选中的内容暂不支持多选复制。')
  }
}

export function pasteClipboardItem (item) {
  if (!item || !window.utools) return false

  switch (item.type) {
    case 'text':
    case 'html':
      window.utools.hideMainWindowPasteText(item.contentText || item.title)
      return true
    case 'image': {
      const imageSource = resolveImageSource(item)
      if (!imageSource) return notifyUnsupported('This image item does not have source image data yet.')
      window.utools.hideMainWindowPasteImage(imageSource)
      return true
    }
    case 'file':
    case 'files':
      if (!item.filePaths?.length) return notifyUnsupported('This file item does not have a valid path list yet.')
      window.utools.hideMainWindowPasteFile(item.filePaths)
      return true
    default:
      return notifyUnsupported('This item type is not supported yet.')
  }
}

export function pasteClipboardItems (items) {
  if (!items?.length || !window.utools) return false
  if (items.length === 1) return pasteClipboardItem(items[0])

  const itemKinds = Array.from(new Set(items.map(getClipboardItemKind)))
  if (itemKinds.length !== 1) {
    return notifyUnsupported('多选粘贴暂时只支持同类型内容。')
  }

  switch (itemKinds[0]) {
    case 'text': {
      const combinedText = buildCombinedText(items)
      if (!combinedText) return notifyUnsupported('选中的文本内容为空。')
      window.utools.hideMainWindowPasteText(combinedText)
      return true
    }
    case 'file': {
      const filePaths = buildCombinedFilePaths(items)
      if (!filePaths.length) return notifyUnsupported('选中的文件项没有可用路径。')
      window.utools.hideMainWindowPasteFile(filePaths)
      return true
    }
    case 'image':
      return notifyUnsupported('多选图片暂时不支持合并粘贴。')
    default:
      return notifyUnsupported('当前选中的内容暂不支持多选粘贴。')
  }
}

export function notifyActionResult (message) {
  window.utools?.showNotification?.(message)
}

function notifyUnsupported (message) {
  notifyActionResult(message)
  return false
}
