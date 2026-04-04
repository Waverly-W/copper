import { createSegmenter } from './create-segmenter'
import { loadSegmentitRuntime } from './load-segmentit-runtime'

const punctuationOnlyPattern = /^[\p{P}\p{S}]+$/u
let textAnalysisModulesPromise = null

export async function analyzeClipboardText (text) {
  const sourceText = String(text || '')
  const { linkify, segment } = await loadTextAnalysisModules()
  const links = extractLinks(sourceText, linkify)

  return {
    sourceText,
    tokens: extractTokens(sourceText, segment, links),
    links
  }
}

function extractTokens (sourceText, segment, links) {
  if (!sourceText.trim()) return []

  const segmentedWords = segment.doSegment(sourceText, { simple: true })
  const tokens = []
  let cursor = 0

  segmentedWords.forEach((word, index) => {
    const tokenText = String(word || '')
    if (!shouldKeepToken(tokenText)) return

    const start = sourceText.indexOf(tokenText, cursor)
    if (start === -1) return

    const end = start + tokenText.length
    cursor = end
    if (isInsideLinkRange(start, end, links)) return

    tokens.push({
      id: `token-${start}-${end}-${index}`,
      text: tokenText,
      start,
      end
    })
  })

  return tokens
}

function extractLinks (sourceText, linkify) {
  const matches = linkify.match(sourceText) || []

  return matches.map((match, index) => ({
    id: `link-${match.index}-${match.lastIndex}-${index}`,
    text: match.text,
    url: match.url,
    start: match.index,
    end: match.lastIndex
  }))
}

function shouldKeepToken (word) {
  if (!word || !word.trim()) return false
  return !punctuationOnlyPattern.test(word.trim())
}

function isInsideLinkRange (start, end, links) {
  return links.some((link) => start >= link.start && end <= link.end)
}

async function loadTextAnalysisModules () {
  if (!textAnalysisModulesPromise) {
    textAnalysisModulesPromise = Promise.all([
      import('linkify-it'),
      loadSegmentitRuntime()
    ]).then(([linkifyModule, segmentit]) => {
      const LinkifyIt = linkifyModule.default

      return {
        linkify: new LinkifyIt(),
        segment: createSegmenter(segmentit)
      }
    })
  }

  return textAnalysisModulesPromise
}
