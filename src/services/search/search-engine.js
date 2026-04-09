const indexCache = new Map()

export function searchClipboardItems (items, query, { timestampField = 'updatedAt' } = {}) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) {
    return items
      .slice()
      .sort((left, right) => getSortTimestamp(right, timestampField) - getSortTimestamp(left, timestampField))
      .map((item) => ({ ...item, searchScore: 0, highlight: null }))
  }

  return items
    .map((item) => rankClipboardItem(item, normalizedQuery, timestampField))
    .filter(Boolean)
    .sort((left, right) => {
      if (right.searchScore !== left.searchScore) {
        return right.searchScore - left.searchScore
      }

      return getSortTimestamp(right, timestampField) - getSortTimestamp(left, timestampField)
    })
}

function rankClipboardItem (item, normalizedQuery, timestampField) {
  const indexRecord = getIndexRecord(item)
  let bestMatch = null

  bestMatch = pickBetterMatch(bestMatch, scoreContinuousMatch(indexRecord.titleText, normalizedQuery, 1400, true))
  bestMatch = pickBetterMatch(bestMatch, scoreContinuousMatch(indexRecord.sourceText, normalizedQuery, 1200, false))

  if (!bestMatch) return null

  return {
    ...item,
    searchScore: bestMatch.score + getRecencyBoost(item, timestampField),
    highlight: bestMatch.highlight
  }
}

function getIndexRecord (item) {
  const cacheKey = [
    item.id,
    item.updatedAt || '',
    item.lastCopiedAt || '',
    item.searchText || '',
    item.title || '',
    item.contentText || '',
    (item.filePaths || []).join('|'),
    item.imagePath || ''
  ].join(':')

  const cachedRecord = indexCache.get(cacheKey)
  if (cachedRecord) return cachedRecord

  const rawText = buildRawText(item)
  const titleText = normalizeSearchText(item.title || '')
  const sourceText = normalizeSearchText(item.searchText || rawText)

  const nextRecord = {
    sourceText,
    titleText
  }

  indexCache.set(cacheKey, nextRecord)
  return nextRecord
}

function buildRawText (item) {
  const fileNames = (item.filePaths || []).map((filePath) => filePath.split(/[\\/]/).pop() || filePath)

  return [
    item.title || '',
    item.contentText || '',
    item.searchText || '',
    ...(item.filePaths || []),
    ...fileNames,
    item.imagePath?.split(/[\\/]/).pop() || ''
  ]
    .filter(Boolean)
    .join(' ')
}

function scoreContinuousMatch (sourceText, normalizedQuery, baseScore, allowHighlight) {
  if (!sourceText || !normalizedQuery) return null

  if (sourceText === normalizedQuery) {
    return {
      score: baseScore + 180,
      highlight: allowHighlight ? buildSubstringHighlight(sourceText, normalizedQuery, 0) : null
    }
  }

  if (sourceText.startsWith(normalizedQuery)) {
    return {
      score: baseScore + 120,
      highlight: allowHighlight ? buildSubstringHighlight(sourceText, normalizedQuery, 0) : null
    }
  }

  const matchIndex = sourceText.indexOf(normalizedQuery)
  if (matchIndex >= 0) {
    return {
      score: baseScore + 40 - Math.min(matchIndex, 40),
      highlight: allowHighlight ? buildSubstringHighlight(sourceText, normalizedQuery, matchIndex) : null
    }
  }

  return null
}

function buildSubstringHighlight (sourceText, normalizedQuery, start) {
  return {
    mode: 'substring',
    start,
    end: start + normalizedQuery.length
  }
}

function pickBetterMatch (currentMatch, nextMatch) {
  if (!nextMatch) return currentMatch
  if (!currentMatch) return nextMatch
  return nextMatch.score > currentMatch.score ? nextMatch : currentMatch
}

function getRecencyBoost (item, timestampField) {
  const timestamp = getSortTimestamp(item, timestampField)
  if (!timestamp) return 0

  const ageMs = Date.now() - timestamp
  const ageHours = ageMs / 3600000
  return Math.max(0, 60 - Math.floor(ageHours))
}

function getSortTimestamp (item, timestampField) {
  return item[timestampField] || item.updatedAt || item.lastCopiedAt || item.createdAt || 0
}

function normalizeSearchText (text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
