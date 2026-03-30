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

export function readStorageItem (key, fallbackValue) {
  try {
    const primaryAdapter = getPrimaryStorageAdapter()
    const primaryValue = primaryAdapter.getItem(key)
    if (primaryValue != null) return primaryValue

    const legacyAdapter = getLegacyStorageAdapter()
    if (!legacyAdapter) return fallbackValue

    const legacyValue = legacyAdapter.getItem(key)
    if (legacyValue == null) return fallbackValue

    primaryAdapter.setItem(key, legacyValue)
    legacyAdapter.removeItem(key)
    return legacyValue
  } catch {
    return fallbackValue
  }
}

export function writeStorageItem (key, value) {
  const primaryAdapter = getPrimaryStorageAdapter()
  primaryAdapter.setItem(key, value)

  const legacyAdapter = getLegacyStorageAdapter()
  legacyAdapter?.removeItem(key)
}

export function removeStorageItem (key) {
  const primaryAdapter = getPrimaryStorageAdapter()
  primaryAdapter.removeItem(key)

  const legacyAdapter = getLegacyStorageAdapter()
  legacyAdapter?.removeItem(key)
}
