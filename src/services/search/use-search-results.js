import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import { searchClipboardItems } from './search-engine'

export function useSearchResults (items, query, timestampField) {
  const deferredQuery = useDeferredValue(query)
  const [results, setResults] = useState(() => {
    return searchClipboardItems(items, deferredQuery, { timestampField })
  })

  useEffect(() => {
    let cancelled = false

    const runSearch = () => {
      try {
        const nextResults = searchClipboardItems(items, deferredQuery, { timestampField })
        if (cancelled) return

        startTransition(() => {
          setResults(nextResults)
        })
      } catch (error) {
        console.error('[copper] search failed', error)
        if (cancelled) return

        startTransition(() => {
          setResults(items)
        })
      }
    }

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(runSearch, { timeout: 120 })
      return () => {
        cancelled = true
        window.cancelIdleCallback?.(idleId)
      }
    }

    const timer = window.setTimeout(runSearch, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [deferredQuery, items, timestampField])

  return results
}
