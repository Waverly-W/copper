function createLocalStorageAdapter () {
  return {
    getItem (key) {
      const raw = window.localStorage?.getItem(key)
      return raw ? JSON.parse(raw) : null
    },
    setItem (key, value) {
      window.localStorage?.setItem(key, JSON.stringify(value))
    },
    removeItem (key) {
      window.localStorage?.removeItem(key)
    }
  }
}

function normalizeStorageValue (value) {
  if (typeof value !== 'string') return value

  const trimmedValue = value.trim()
  if (!trimmedValue) return value

  const looksLikeJson = (
    trimmedValue === 'null' ||
    trimmedValue === 'true' ||
    trimmedValue === 'false' ||
    trimmedValue.startsWith('{') ||
    trimmedValue.startsWith('[') ||
    trimmedValue.startsWith('"') ||
    /^-?\d+(\.\d+)?$/.test(trimmedValue)
  )

  if (!looksLikeJson) return value

  try {
    return JSON.parse(trimmedValue)
  } catch {
    return value
  }
}

function getPrimaryStorageAdapter () {
  if (window.utools?.dbCryptoStorage) {
    return window.utools.dbCryptoStorage
  }

  if (window.utools?.dbStorage) {
    return window.utools.dbStorage
  }

  return createLocalStorageAdapter()
}

function getLegacyStorageAdapter () {
  if (window.utools?.dbCryptoStorage && window.utools?.dbStorage) {
    return window.utools.dbStorage
  }

  return null
}

function readAdapterItem (adapter, key) {
  try {
    return {
      ok: true,
      value: normalizeStorageValue(adapter?.getItem?.(key))
    }
  } catch {
    return {
      ok: false,
      value: null
    }
  }
}

export function readStorageItem (key, fallbackValue) {
  const primaryAdapter = getPrimaryStorageAdapter()
  const primaryResult = readAdapterItem(primaryAdapter, key)
  if (primaryResult.ok && primaryResult.value != null) {
    return primaryResult.value
  }

  const legacyAdapter = getLegacyStorageAdapter()
  if (!legacyAdapter) return fallbackValue

  const legacyResult = readAdapterItem(legacyAdapter, key)
  if (!legacyResult.ok || legacyResult.value == null) {
    return fallbackValue
  }

  try {
    primaryAdapter.setItem(key, legacyResult.value)
    legacyAdapter.removeItem(key)
  } catch {}

  return legacyResult.value
}

export function writeStorageItem (key, value) {
  const primaryAdapter = getPrimaryStorageAdapter()
  const legacyAdapter = getLegacyStorageAdapter()
  try {
    primaryAdapter.setItem(key, value)
    legacyAdapter?.removeItem(key)
    return
  } catch {}

  if (!legacyAdapter) return

  legacyAdapter.setItem(key, value)
}

export function removeStorageItem (key) {
  const primaryAdapter = getPrimaryStorageAdapter()
  const legacyAdapter = getLegacyStorageAdapter()
  try {
    primaryAdapter.removeItem(key)
    legacyAdapter?.removeItem(key)
    return
  } catch {}

  legacyAdapter?.removeItem(key)
}
