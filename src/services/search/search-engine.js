import { match, pinyin } from 'pinyin-pro'

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

  const titleMatch = scoreTextMatch(indexRecord.titleText, normalizedQuery, 1400, true)
  bestMatch = pickBetterMatch(bestMatch, titleMatch)

  const fullTextMatch = scoreTextMatch(indexRecord.sourceText, normalizedQuery, 1200, false)
  bestMatch = pickBetterMatch(bestMatch, fullTextMatch)

  const titlePinyinMatch = scorePinyinMatch(indexRecord.titleRawText, normalizedQuery, 900, true)
  bestMatch = pickBetterMatch(bestMatch, titlePinyinMatch)

  const fullTextPinyinMatch = scorePinyinMatch(indexRecord.rawText, normalizedQuery, 760, false)
  bestMatch = pickBetterMatch(bestMatch, fullTextPinyinMatch)

  const initialsMatch = scoreInitialsMatch(indexRecord.pinyinInitials, normalizedQuery)
  bestMatch = pickBetterMatch(bestMatch, initialsMatch)

  const fuzzyMatch = scoreSubsequenceMatch(indexRecord.sourceText, normalizedQuery, 420)
  bestMatch = pickBetterMatch(bestMatch, fuzzyMatch)

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
    item.contentText || ''
  ].join(':')

  const cachedRecord = indexCache.get(cacheKey)
  if (cachedRecord) return cachedRecord

  const rawText = buildRawText(item)
  const titleRawText = String(item.title || '')
  const sourceText = normalizeSearchText(rawText)
  const titleText = normalizeSearchText(item.title || '')
  const pinyinText = normalizeSearchText(toPinyinText(rawText))
  const pinyinInitials = normalizeSearchText(toPinyinInitials(rawText))

  const nextRecord = {
    rawText,
    titleRawText,
    sourceText,
    titleText,
    pinyinText,
    pinyinInitials
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

function toPinyinText (text) {
  const normalizedText = String(text || '').trim()
  if (!normalizedText) return ''

  try {
    return pinyin(normalizedText, {
      toneType: 'none',
      type: 'array'
    }).join(' ')
  } catch {
    return ''
  }
}

function toPinyinInitials (text) {
  const normalizedText = String(text || '').trim()
  if (!normalizedText) return ''

  try {
    return pinyin(normalizedText, {
      toneType: 'none',
      type: 'array'
    })
      .map((syllable) => syllable[0] || '')
      .join('')
  } catch {
    return ''
  }
}

function scoreTextMatch (sourceText, normalizedQuery, baseScore, allowHighlight) {
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
    const isWordBoundary = matchIndex === 0 || sourceText[matchIndex - 1] === ' '
    return {
      score: baseScore + (isWordBoundary ? 80 : 30) - Math.min(matchIndex, 40),
      highlight: allowHighlight ? buildSubstringHighlight(sourceText, normalizedQuery, matchIndex) : null
    }
  }

  return null
}

function scorePinyinMatch (rawText, normalizedQuery, baseScore, allowHighlight) {
  if (!rawText || !normalizedQuery) return null

  const matchedIndexes = match(rawText, normalizedQuery, {
    precision: 'start',
    lastPrecision: 'every',
    insensitive: true,
    continuous: false,
    space: 'ignore'
  })

  if (!matchedIndexes?.length) return null

  return {
    score: baseScore - Math.min(matchedIndexes[0] * 12, 120) + matchedIndexes.length * 2,
    highlight: allowHighlight
      ? {
          mode: 'indexes',
          indexes: matchedIndexes
        }
      : null
  }
}

function scoreInitialsMatch (pinyinInitials, normalizedQuery) {
  if (!pinyinInitials || !normalizedQuery) return null

  const matchIndex = pinyinInitials.indexOf(normalizedQuery)
  if (matchIndex === -1) return null

  return {
    score: 720 - Math.min(matchIndex * 10, 120),
    highlight: null
  }
}

function scoreSubsequenceMatch (sourceText, normalizedQuery, baseScore) {
  if (!sourceText || !normalizedQuery) return null

  let queryIndex = 0
  const indexes = []

  for (let sourceIndex = 0; sourceIndex < sourceText.length; sourceIndex += 1) {
    if (sourceText[sourceIndex] !== normalizedQuery[queryIndex]) continue
    indexes.push(sourceIndex)
    queryIndex += 1
    if (queryIndex >= normalizedQuery.length) {
      return {
        score: baseScore - Math.min(indexes[0] * 3, 90) - Math.max(sourceText.length - normalizedQuery.length, 0),
        highlight: {
          mode: 'indexes',
          indexes
        }
      }
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
