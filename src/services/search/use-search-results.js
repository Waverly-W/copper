import { useDeferredValue, useMemo } from 'react'
import { searchClipboardItems } from './search-engine'

export function useSearchResults (items, query, timestampField) {
  const deferredQuery = useDeferredValue(query)
  return useMemo(() => {
    try {
      return searchClipboardItems(items, deferredQuery, { timestampField })
    } catch (error) {
      console.error('[copper] search failed', error)
      return items
    }
  }, [deferredQuery, items, timestampField])
}
