const crypto = require('node:crypto')
const { execFile } = require('node:child_process')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const path = require('node:path')

let clipboard = null

try {
  clipboard = require('electron').clipboard
} catch {}

const CLIPBOARD_CHANGE_SIGNAL = 'CLIPBOARD_CHANGE'
const CLIPBOARD_CAPTURE_EVENT = 'clipboard_capture'
const LISTENER_PROTOCOL_SIGNAL = 'native-signal'
const LISTENER_PROTOCOL_CAPTURE = 'native-capture'
const LISTENER_PROTOCOL_POLLING = 'polling'

const clipboardChangeEmitter = new EventEmitter()
const pendingClipboardCaptures = []
let clipboardListenerProcess = null
let clipboardListenerStdoutBuffer = ''
let lastQueuedClipboardSignature = ''
let clipboardListenerStatus = {
  mode: LISTENER_PROTOCOL_POLLING,
  protocol: LISTENER_PROTOCOL_POLLING,
  available: false,
  listening: false,
  targetPath: '',
  reason: 'missing-binary'
}

function ensureDirectory (directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true })
  }
}

function getImageAssetsDirectory () {
  const baseDir = window.utools?.getPath('userData') || window.utools?.getPath('downloads')
  const directoryPath = path.join(baseDir, 'clipboard-plugin', 'assets', 'images')
  ensureDirectory(directoryPath)
  return directoryPath
}

function resolveClipboardListenerTarget () {
  if (process.platform === 'win32') {
    const exePath = path.resolve(__dirname, '..', 'clipboard-event-handler-win32.exe')
    if (fs.existsSync(exePath)) {
      return {
        mode: 'native',
        protocol: LISTENER_PROTOCOL_SIGNAL,
        available: true,
        listening: Boolean(clipboardListenerProcess),
        targetPath: exePath,
        command: exePath,
        args: [],
        reason: ''
      }
    }

    const scriptPath = path.resolve(__dirname, '..', 'clipboard-event-handler-win32.ps1')
    if (fs.existsSync(scriptPath)) {
      return {
        mode: 'native',
        protocol: LISTENER_PROTOCOL_SIGNAL,
        available: true,
        listening: Boolean(clipboardListenerProcess),
        targetPath: scriptPath,
        command: 'powershell.exe',
        args: [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-STA',
          '-File',
          scriptPath
        ],
        reason: ''
      }
    }

    return {
      mode: LISTENER_PROTOCOL_POLLING,
      protocol: LISTENER_PROTOCOL_POLLING,
      available: false,
      listening: false,
      targetPath: scriptPath,
      command: '',
      args: [],
      reason: 'missing-binary'
    }
  }

  const targetMap = {
    linux: 'clipboard-event-handler-linux',
    darwin: 'clipboard-event-handler-mac'
  }

  const targetName = targetMap[process.platform]
  if (!targetName) {
    return {
      mode: LISTENER_PROTOCOL_POLLING,
      protocol: LISTENER_PROTOCOL_POLLING,
      available: false,
      listening: false,
      targetPath: '',
      command: '',
      args: [],
      reason: 'unsupported-platform'
    }
  }

  const targetPath = path.resolve(__dirname, '..', targetName)
  if (!fs.existsSync(targetPath)) {
    return {
      mode: LISTENER_PROTOCOL_POLLING,
      protocol: LISTENER_PROTOCOL_POLLING,
      available: false,
      listening: false,
      targetPath,
      command: '',
      args: [],
      reason: 'missing-binary'
    }
  }

  return {
    mode: 'native',
    protocol: process.platform === 'darwin' ? LISTENER_PROTOCOL_CAPTURE : LISTENER_PROTOCOL_SIGNAL,
    available: true,
    listening: Boolean(clipboardListenerProcess),
    targetPath,
    command: targetPath,
    args: process.platform === 'darwin'
      ? [
          '--image-dir',
          getImageAssetsDirectory(),
          '--poll-interval-ms',
          '40'
        ]
      : [],
    reason: ''
  }
}

function setClipboardListenerStatus (nextStatusPatch) {
  clipboardListenerStatus = {
    ...clipboardListenerStatus,
    ...nextStatusPatch
  }
}

function emitClipboardChange () {
  clipboardChangeEmitter.emit('change')
}

function sanitizeFilePaths (paths) {
  return paths
    .map((filePath) => String(filePath || '').split('\u0000').join('').trim())
    .filter(Boolean)
    .filter((filePath) => fs.existsSync(filePath))
}

function isValidImageAsset (imageAsset) {
  return Boolean(
    imageAsset &&
    imageAsset.assetId &&
    imageAsset.imagePath &&
    Number.isFinite(Number(imageAsset.width)) &&
    Number.isFinite(Number(imageAsset.height))
  )
}

function normalizeNativeClipboardCapture (capture) {
  if (!capture || capture.event !== CLIPBOARD_CAPTURE_EVENT || typeof capture.signature !== 'string') {
    return null
  }

  if (capture.kind === 'file') {
    const filePaths = sanitizeFilePaths(Array.isArray(capture.filePaths) ? capture.filePaths : [])
    if (!filePaths.length) return null

    return {
      kind: 'file',
      signature: capture.signature,
      filePaths
    }
  }

  if (capture.kind === 'image') {
    const imageAsset = capture.image
    if (!isValidImageAsset(imageAsset) || !fs.existsSync(imageAsset.imagePath)) return null

    return {
      kind: 'image',
      signature: capture.signature,
      imageAsset: {
        assetId: String(imageAsset.assetId),
        imagePath: String(imageAsset.imagePath),
        width: Number(imageAsset.width),
        height: Number(imageAsset.height),
        byteSize: Number(imageAsset.byteSize) || 0,
        mimeType: String(imageAsset.mimeType || 'image/png')
      }
    }
  }

  if (capture.kind === 'text') {
    const text = String(capture.text || '').trim()
    if (!text) return null

    return {
      kind: 'text',
      signature: capture.signature,
      text
    }
  }

  return null
}

function queueClipboardCapture (capture) {
  if (!capture?.signature) return false
  if (capture.signature === lastQueuedClipboardSignature) return false

  pendingClipboardCaptures.push(capture)
  lastQueuedClipboardSignature = capture.signature
  emitClipboardChange()
  return true
}

function handleClipboardListenerOutput (chunk) {
  clipboardListenerStdoutBuffer += chunk.toString()
  const lines = clipboardListenerStdoutBuffer.split(/\r?\n/)
  clipboardListenerStdoutBuffer = lines.pop() || ''

  lines.forEach((line) => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return

    if (trimmedLine === CLIPBOARD_CHANGE_SIGNAL) {
      captureClipboardToQueue()
      return
    }

    try {
      const parsedCapture = JSON.parse(trimmedLine)
      const normalizedCapture = normalizeNativeClipboardCapture(parsedCapture)
      if (normalizedCapture) {
        queueClipboardCapture(normalizedCapture)
      }
    } catch {}
  })
}

function handleClipboardListenerExit (reason) {
  clipboardListenerProcess = null
  setClipboardListenerStatus({
    mode: LISTENER_PROTOCOL_POLLING,
    protocol: LISTENER_PROTOCOL_POLLING,
    available: false,
    listening: false,
    reason
  })
}

function startClipboardNativeListener () {
  const resolvedTarget = resolveClipboardListenerTarget()
  setClipboardListenerStatus(resolvedTarget)

  if (!resolvedTarget.available) {
    return clipboardListenerStatus
  }

  if (clipboardListenerProcess) {
    setClipboardListenerStatus({
      mode: 'native',
      protocol: resolvedTarget.protocol,
      available: true,
      listening: true,
      reason: ''
    })
    return clipboardListenerStatus
  }

  try {
    if (process.platform === 'linux' || process.platform === 'darwin') {
      fs.chmodSync(resolvedTarget.targetPath, 0o755)
    }

    clipboardListenerStdoutBuffer = ''
    clipboardListenerProcess = execFile(
      resolvedTarget.command,
      resolvedTarget.args || [],
      {
        windowsHide: true
      }
    )

    clipboardListenerProcess.stdout?.on('data', handleClipboardListenerOutput)
    clipboardListenerProcess.stderr?.on('data', (chunk) => {
      const message = chunk.toString().trim()
      if (!message) return
      console.warn('[copper] native clipboard listener stderr', message)
    })

    clipboardListenerProcess.on('error', (error) => {
      console.warn('[copper] native clipboard listener error', error)
      handleClipboardListenerExit('listener-error')
    })

    clipboardListenerProcess.on('exit', () => {
      handleClipboardListenerExit('listener-exit')
    })

    setClipboardListenerStatus({
      mode: 'native',
      protocol: resolvedTarget.protocol,
      available: true,
      listening: true,
      targetPath: resolvedTarget.targetPath,
      reason: ''
    })
  } catch (error) {
    console.warn('[copper] failed to start native clipboard listener', error)
    clipboardListenerProcess = null
    setClipboardListenerStatus({
      mode: LISTENER_PROTOCOL_POLLING,
      protocol: LISTENER_PROTOCOL_POLLING,
      available: false,
      listening: false,
      targetPath: resolvedTarget.targetPath,
      reason: 'listener-start-failed'
    })
  }

  return clipboardListenerStatus
}

function stopClipboardNativeListenerIfIdle () {
  if (clipboardChangeEmitter.listenerCount('change') > 0) return
  if (!clipboardListenerProcess) return

  clipboardListenerProcess.kill()
  clipboardListenerProcess = null
  setClipboardListenerStatus({
    mode: 'native',
    protocol: clipboardListenerStatus.protocol,
    available: true,
    listening: false,
    reason: ''
  })
}

function getClipboardImageSnapshot () {
  if (!clipboard?.readImage) return null
  const image = clipboard.readImage()
  if (!image || image.isEmpty()) return null

  const bitmapBuffer = typeof image.toBitmap === 'function'
    ? image.toBitmap()
    : null

  return {
    image,
    pngBuffer: image.toPNG(),
    bitmapBuffer: bitmapBuffer?.length ? bitmapBuffer : null
  }
}

function getMimeTypeFromExtension (filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

function normalizeCopiedFileEntry (entry) {
  if (!entry || typeof entry !== 'object') return null

  const normalizedFilePath = String(entry.path || '').split('\u0000').join('').trim()
  if (!normalizedFilePath || !fs.existsSync(normalizedFilePath)) return null

  return {
    isFile: Boolean(entry.isFile),
    isDirectory: Boolean(entry.isDirectory ?? entry.isDiractory),
    name: String(entry.name || path.basename(normalizedFilePath)),
    path: normalizedFilePath
  }
}

function readUtoolsCopiedFiles () {
  const copiedFiles = window.utools?.getCopyedFiles?.()
  if (!Array.isArray(copiedFiles) || !copiedFiles.length) return []

  return copiedFiles
    .map((entry) => normalizeCopiedFileEntry(entry))
    .filter(Boolean)
}

function normalizeUriListPath (value) {
  const normalizedValue = value
    .split('\u0000').join('')
    .replace(/^\uFEFF/, '')
    .trim()
  if (!normalizedValue) return ''

  if (normalizedValue.startsWith('file://')) {
    try {
      const fileUrl = new URL(normalizedValue)
      let nextPath = decodeURIComponent(fileUrl.pathname)
      if (process.platform === 'win32' && nextPath.startsWith('/')) {
        nextPath = nextPath.slice(1)
      }
      return nextPath
    } catch {
      return ''
    }
  }

  if (/^[a-zA-Z]:\\/.test(normalizedValue)) {
    return normalizedValue
  }

  return ''
}

function parseWindowsFileNameW () {
  if (!clipboard?.availableFormats || !clipboard?.readBuffer) return []
  const formats = clipboard.availableFormats()
  const candidateFormat = formats.find((format) => {
    const loweredFormat = format.toLowerCase()
    return loweredFormat === 'filenamew' || loweredFormat === 'filename'
  })

  if (!candidateFormat) return []

  const buffer = clipboard.readBuffer(candidateFormat)
  if (!buffer?.length) return []

  const encodings = candidateFormat.toLowerCase() === 'filenamew'
    ? ['ucs2', 'utf8']
    : ['utf8', 'ucs2']

  for (const encoding of encodings) {
    const filePaths = buffer
      .toString(encoding)
      .split('\u0000')

    const sanitizedPaths = sanitizeFilePaths(filePaths)
    if (sanitizedPaths.length) return sanitizedPaths
  }

  return []
}

function getFormatBufferPreview (format) {
  if (!clipboard?.readBuffer) return null

  try {
    const buffer = clipboard.readBuffer(format)
    if (!buffer?.length) {
      return {
        format,
        length: 0
      }
    }

    return {
      format,
      length: buffer.length,
      utf8Preview: buffer.toString('utf8').slice(0, 200),
      ucs2Preview: buffer.toString('ucs2').slice(0, 200),
      hexPreview: buffer.toString('hex').slice(0, 120)
    }
  } catch (error) {
    return {
      format,
      error: error?.message || String(error)
    }
  }
}

function parseUriListFormats () {
  if (!clipboard?.availableFormats) return []

  const formats = clipboard.availableFormats()
  const candidateFormats = ['text/uri-list', 'public.file-url']

  for (const format of candidateFormats) {
    if (!formats.includes(format)) continue

    const candidatePayloads = []

    if (clipboard.read) {
      try {
        const rawText = clipboard.read(format)
        if (rawText) candidatePayloads.push(rawText)
      } catch {}
    }

    if (clipboard.readBuffer) {
      try {
        const buffer = clipboard.readBuffer(format)
        if (buffer?.length) {
          candidatePayloads.push(buffer.toString('utf8'))
          candidatePayloads.push(buffer.toString('ucs2'))
          candidatePayloads.push(buffer.toString('latin1'))
        }
      } catch {}
    }

    for (const payload of candidatePayloads) {
      const parsedPaths = payload
        .split('\u0000').join('\n')
        .split(/\r?\n|[\u2028\u2029]/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith('#'))
        .map((line) => normalizeUriListPath(line))

      const sanitizedPaths = sanitizeFilePaths(parsedPaths)
      if (sanitizedPaths.length) return sanitizedPaths
    }
  }

  return []
}

function parseMacNsFilenamesPboardType () {
  if (!clipboard?.availableFormats || !clipboard?.readBuffer) return []
  const formats = clipboard.availableFormats()
  if (!formats.includes('NSFilenamesPboardType')) return []

  const buffer = clipboard.readBuffer('NSFilenamesPboardType')
  if (!buffer?.length) return []

  const rawValue = buffer.toString('utf8')
  const matches = [...rawValue.matchAll(/<string>(.*?)<\/string>/g)]
  const parsedPaths = matches.map((match) => match[1] || '')
  return sanitizeFilePaths(parsedPaths)
}

function readClipboardFilePathsInternal () {
  const copiedFiles = readUtoolsCopiedFiles()
  if (copiedFiles.length) return copiedFiles.map((entry) => entry.path)

  const windowsPaths = parseWindowsFileNameW()
  if (windowsPaths.length) return windowsPaths

  const uriListPaths = parseUriListFormats()
  if (uriListPaths.length) return uriListPaths

  return parseMacNsFilenamesPboardType()
}

function buildImageAssetFromSnapshot (imageSnapshot) {
  const assetIdBuffer = imageSnapshot.bitmapBuffer || imageSnapshot.pngBuffer
  const assetId = crypto.createHash('sha1').update(assetIdBuffer).digest('hex')
  const imagePath = path.join(getImageAssetsDirectory(), `${assetId}.png`)

  if (!fs.existsSync(imagePath)) {
    fs.writeFileSync(imagePath, imageSnapshot.pngBuffer)
  }

  const size = imageSnapshot.image.getSize()

  return {
    assetId,
    imagePath,
    width: size.width,
    height: size.height,
    byteSize: imageSnapshot.pngBuffer.length,
    mimeType: 'image/png'
  }
}

function createFileCapture (filePaths, signature) {
  if (!filePaths.length) return null

  return {
    kind: 'file',
    signature,
    filePaths
  }
}

function createImageCapture (imageSnapshot) {
  if (!imageSnapshot) return null

  const imageAsset = buildImageAssetFromSnapshot(imageSnapshot)
  return {
    kind: 'image',
    signature: `image:${imageAsset.assetId}`,
    imageAsset
  }
}

function createTextCapture (text) {
  const normalizedText = String(text || '').trim()
  if (!normalizedText) return null

  return {
    kind: 'text',
    signature: `text:${normalizedText}`,
    text: normalizedText
  }
}

function createClipboardCaptureFromCurrentState () {
  const copiedFiles = readUtoolsCopiedFiles()
  if (copiedFiles.length) {
    const filePaths = copiedFiles.map((entry) => entry.path)
    return createFileCapture(
      filePaths,
      `files:${copiedFiles
        .map((entry) => `${entry.path}:${entry.isDirectory ? 'dir' : 'file'}`)
        .join('|')}`
    )
  }

  const filePaths = readClipboardFilePathsInternal()
  if (filePaths.length) {
    return createFileCapture(filePaths, `files:${filePaths.join('|')}`)
  }

  const imageSnapshot = getClipboardImageSnapshot()
  if (imageSnapshot) {
    return createImageCapture(imageSnapshot)
  }

  const textCapture = createTextCapture(clipboard?.readText?.() || '')
  if (textCapture) {
    return textCapture
  }

  lastQueuedClipboardSignature = ''
  return null
}

function captureClipboardToQueue () {
  const capture = createClipboardCaptureFromCurrentState()
  if (!capture) return false

  return queueClipboardCapture(capture)
}

window.services = {
  readFile (file) {
    return fs.readFileSync(file, { encoding: 'utf-8' })
  },
  writeTextFile (text) {
    const filePath = path.join(window.utools.getPath('downloads'), `${Date.now()}.txt`)
    fs.writeFileSync(filePath, text, { encoding: 'utf-8' })
    return filePath
  },
  writeImageFile (base64Url) {
    const matches = /^data:image\/([a-z]{1,20});base64,/i.exec(base64Url)
    if (!matches) return
    const filePath = path.join(window.utools.getPath('downloads'), `${Date.now()}.${matches[1]}`)
    fs.writeFileSync(filePath, base64Url.substring(matches[0].length), { encoding: 'base64' })
    return filePath
  },
  readClipboardText () {
    if (!clipboard?.readText) return ''
    return clipboard.readText()
  },
  captureClipboardToQueue () {
    return captureClipboardToQueue()
  },
  consumePendingClipboardCaptures () {
    if (!pendingClipboardCaptures.length) return []
    return pendingClipboardCaptures.splice(0, pendingClipboardCaptures.length)
  },
  getClipboardImageSignature () {
    const snapshot = getClipboardImageSnapshot()
    if (!snapshot) return ''
    return crypto.createHash('sha1').update(snapshot.bitmapBuffer || snapshot.pngBuffer).digest('hex')
  },
  persistClipboardImageAsset () {
    const snapshot = getClipboardImageSnapshot()
    if (!snapshot) return null

    return buildImageAssetFromSnapshot(snapshot)
  },
  readImageDataUrl (imagePath) {
    if (!imagePath || !fs.existsSync(imagePath)) return ''
    const mimeType = getMimeTypeFromExtension(imagePath)
    const buffer = fs.readFileSync(imagePath)
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  },
  readClipboardFilePaths () {
    return readClipboardFilePathsInternal()
  },
  readClipboardCopiedFiles () {
    return readUtoolsCopiedFiles()
  },
  getClipboardFileSignature () {
    const copiedFiles = readUtoolsCopiedFiles()
    if (copiedFiles.length) {
      return copiedFiles
        .map((entry) => `${entry.path}:${entry.isDirectory ? 'dir' : 'file'}`)
        .join('|')
    }

    const filePaths = readClipboardFilePathsInternal()
    if (!filePaths.length) return ''
    return filePaths.join('|')
  },
  getClipboardFormats () {
    if (!clipboard?.availableFormats) return []
    return clipboard.availableFormats()
  },
  getClipboardDebugSnapshot () {
    const formats = clipboard?.availableFormats?.() || []
    return {
      formats,
      textPreview: clipboard?.readText?.()?.slice(0, 120) || '',
      utoolsCopiedFiles: readUtoolsCopiedFiles(),
      windowsPaths: parseWindowsFileNameW(),
      uriListPaths: parseUriListFormats(),
      macPaths: parseMacNsFilenamesPboardType(),
      fileSignature: (() => {
        const copiedFiles = readUtoolsCopiedFiles()
        if (copiedFiles.length) {
          return copiedFiles
            .map((entry) => `${entry.path}:${entry.isDirectory ? 'dir' : 'file'}`)
            .join('|')
        }

        const paths = readClipboardFilePathsInternal()
        return paths.length ? paths.join('|') : ''
      })(),
      interestingBuffers: formats
        .filter((format) => {
          const loweredFormat = format.toLowerCase()
          return loweredFormat.includes('file') ||
            loweredFormat.includes('uri') ||
            loweredFormat.includes('drop') ||
            loweredFormat.includes('shell')
        })
        .map((format) => getFormatBufferPreview(format))
    }
  },
  subscribeClipboardChanges (callback) {
    if (typeof callback !== 'function') return () => {}

    clipboardChangeEmitter.on('change', callback)
    startClipboardNativeListener()

    return () => {
      clipboardChangeEmitter.off('change', callback)
      stopClipboardNativeListenerIfIdle()
    }
  },
  getClipboardListenerStatus () {
    const resolvedTarget = resolveClipboardListenerTarget()

    return {
      ...clipboardListenerStatus,
      mode: clipboardListenerProcess ? 'native' : resolvedTarget.mode,
      protocol: clipboardListenerProcess ? clipboardListenerStatus.protocol : resolvedTarget.protocol,
      available: clipboardListenerProcess ? true : resolvedTarget.available,
      listening: Boolean(clipboardListenerProcess),
      targetPath: clipboardListenerStatus.targetPath || resolvedTarget.targetPath,
      reason: clipboardListenerProcess ? '' : (clipboardListenerStatus.reason || resolvedTarget.reason)
    }
  }
}
