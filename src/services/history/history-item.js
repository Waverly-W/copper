export function createTextHistoryItem (text, now = Date.now()) {
  const normalizedText = normalizeText(text)
  const textMetrics = getTextMetrics(normalizedText)

  return decorateHistoryItem({
    id: `history-${now}`,
    type: 'text',
    title: normalizedText,
    contentText: normalizedText,
    searchText: normalizedText.toLowerCase(),
    copyCount: 1,
    createdAt: now,
    updatedAt: now,
    lastCopiedAt: now,
    textMetrics
  })
}

export function createImageHistoryItem (imageAsset, now = Date.now()) {
  const title = imageAsset.imagePath?.split(/[\\/]/).pop() || `image-${now}.png`

  return decorateHistoryItem({
    id: `history-${now}`,
    type: 'image',
    title,
    imagePath: imageAsset.imagePath,
    imageAssetId: imageAsset.assetId,
    imageWidth: imageAsset.width,
    imageHeight: imageAsset.height,
    imageByteSize: imageAsset.byteSize,
    searchText: title.toLowerCase(),
    copyCount: 1,
    createdAt: now,
    updatedAt: now,
    lastCopiedAt: now
  })
}

export function createFileHistoryItem (filePaths, now = Date.now()) {
  const normalizedFilePaths = filePaths.filter(Boolean)
  const title = normalizedFilePaths.length === 1
    ? (normalizedFilePaths[0].split(/[\\/]/).pop() || normalizedFilePaths[0])
    : `${normalizedFilePaths.length} files`

  return decorateHistoryItem({
    id: `history-${now}`,
    type: normalizedFilePaths.length > 1 ? 'files' : 'file',
    title,
    filePaths: normalizedFilePaths,
    searchText: normalizedFilePaths.join(' ').toLowerCase(),
    copyCount: 1,
    createdAt: now,
    updatedAt: now,
    lastCopiedAt: now
  })
}

export function mergeTextHistoryItem (item, text, now = Date.now()) {
  const normalizedText = normalizeText(text)
  const textMetrics = getTextMetrics(normalizedText)

  return decorateHistoryItem({
    ...item,
    title: normalizedText,
    contentText: normalizedText,
    searchText: normalizedText.toLowerCase(),
    copyCount: (item.copyCount || 1) + 1,
    updatedAt: now,
    lastCopiedAt: now,
    textMetrics
  })
}

export function mergeImageHistoryItem (item, imageAsset, now = Date.now()) {
  const title = imageAsset.imagePath?.split(/[\\/]/).pop() || item.title || `image-${now}.png`

  return decorateHistoryItem({
    ...item,
    title,
    imagePath: imageAsset.imagePath,
    imageAssetId: imageAsset.assetId || item.imageAssetId,
    imageWidth: imageAsset.width,
    imageHeight: imageAsset.height,
    imageByteSize: imageAsset.byteSize,
    searchText: title.toLowerCase(),
    copyCount: (item.copyCount || 1) + 1,
    updatedAt: now,
    lastCopiedAt: now
  })
}

export function mergeFileHistoryItem (item, filePaths, now = Date.now()) {
  const normalizedFilePaths = normalizeFilePaths(filePaths)
  const title = normalizedFilePaths.length === 1
    ? (normalizedFilePaths[0].split(/[\\/]/).pop() || normalizedFilePaths[0])
    : `${normalizedFilePaths.length} files`

  return decorateHistoryItem({
    ...item,
    type: normalizedFilePaths.length > 1 ? 'files' : 'file',
    title,
    filePaths: normalizedFilePaths,
    searchText: normalizedFilePaths.join(' ').toLowerCase(),
    copyCount: (item.copyCount || 1) + 1,
    updatedAt: now,
    lastCopiedAt: now
  })
}

export function decorateHistoryItems (items) {
  return items.map((item) => decorateHistoryItem(item))
}

export function decorateHistoryItem (item) {
  const copyCount = item.copyCount || 1
  const lastCopiedAt = item.lastCopiedAt || item.updatedAt || item.createdAt || Date.now()
  const textMetrics = item.type === 'image'
    ? {
        imageWidth: item.imageWidth || 0,
        imageHeight: item.imageHeight || 0
      }
    : (item.textMetrics || getTextMetrics(item.contentText || item.title || ''))

  return {
    ...item,
    typeLabel: getTypeLabel(item.type),
    meta: buildMeta(item.type, copyCount, textMetrics, item.filePaths),
    relativeTime: formatRelativeTime(lastCopiedAt),
    copyCount,
    lastCopiedAt,
    textMetrics
  }
}

export function isSameTextHistoryItem (item, text) {
  if (item.type !== 'text' && item.type !== 'html') return false
  return normalizeText(item.contentText || item.title || '') === normalizeText(text)
}

export function isSameImageHistoryItem (item, imageAsset) {
  if (item.type !== 'image' || !imageAsset) return false
  if (item.imageAssetId && imageAsset.assetId) {
    return item.imageAssetId === imageAsset.assetId
  }

  return String(item.imagePath || '').trim() === String(imageAsset.imagePath || '').trim()
}

export function isSameFileHistoryItem (item, filePaths) {
  if (item.type !== 'file' && item.type !== 'files') return false

  const leftPaths = normalizeFilePaths(item.filePaths || [])
  const rightPaths = normalizeFilePaths(filePaths)

  if (leftPaths.length !== rightPaths.length) return false
  return leftPaths.every((filePath, index) => filePath === rightPaths[index])
}

function normalizeText (text) {
  return String(text || '').trim().replace(/\r\n/g, '\n')
}

function normalizeFilePaths (filePaths) {
  return (filePaths || [])
    .map((filePath) => String(filePath || '').trim())
    .filter(Boolean)
}

function getTextMetrics (text) {
  const normalizedText = normalizeText(text)
  if (!normalizedText) {
    return {
      charCount: 0,
      lineCount: 0
    }
  }

  return {
    charCount: normalizedText.length,
    lineCount: normalizedText.split('\n').length
  }
}

function getTypeLabel (type) {
  switch (type) {
    case 'text':
      return 'Text'
    case 'html':
      return 'HTML'
    case 'image':
      return 'Image'
    case 'file':
      return 'File'
    case 'files':
      return 'Files'
    default:
      return 'Item'
  }
}

function buildMeta (type, copyCount, textMetrics, filePaths) {
  if (type === 'file' || type === 'files') {
    const fileCount = filePaths?.length || 0
    return `File item | ${fileCount} path${fileCount === 1 ? '' : 's'} | copied ${copyCount} time${copyCount === 1 ? '' : 's'}`
  }

  if (type === 'image') {
    const width = textMetrics?.imageWidth || 0
    const height = textMetrics?.imageHeight || 0
    const sizePart = width && height ? ` | ${width}x${height}` : ''
    return `Image item${sizePart} | copied ${copyCount} time${copyCount === 1 ? '' : 's'}`
  }

  return `Text item | ${textMetrics.charCount} chars | ${textMetrics.lineCount} line${textMetrics.lineCount === 1 ? '' : 's'} | copied ${copyCount} time${copyCount === 1 ? '' : 's'}`
}

function formatRelativeTime (timestamp) {
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes <= 0) return 'now'
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}
