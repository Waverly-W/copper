function resolveImageSource (item) {
  if (item.imagePath) return item.imagePath
  if (item.imageDataUrl) return item.imageDataUrl
  return ''
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

export function notifyActionResult (message) {
  window.utools?.showNotification?.(message)
}

function notifyUnsupported (message) {
  notifyActionResult(message)
  return false
}
