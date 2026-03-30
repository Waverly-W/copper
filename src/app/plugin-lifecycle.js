import { useEffect, useState } from 'react'

const DEFAULT_ROUTE = 'clipboard'

export function usePluginLifecycle () {
  const [route, setRoute] = useState(DEFAULT_ROUTE)
  const [enterAction, setEnterAction] = useState({
    code: DEFAULT_ROUTE,
    type: 'text',
    payload: ''
  })

  useEffect(() => {
    if (!window.utools) return

    window.utools.onPluginEnter((action) => {
      setRoute(action.code || DEFAULT_ROUTE)
      setEnterAction(action)
    })

    window.utools.onPluginOut(() => {
      setRoute(DEFAULT_ROUTE)
    })
  }, [])

  return {
    route,
    enterAction,
    navigateToRoute (nextRoute) {
      setRoute(nextRoute || DEFAULT_ROUTE)
    }
  }
}
