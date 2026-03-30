import { useSyncExternalStore } from 'react'

export function createExternalStore (initialState) {
  let state = initialState
  const listeners = new Set()

  const getState = () => state

  const setState = (nextState) => {
    const resolvedState = typeof nextState === 'function'
      ? nextState(state)
      : nextState

    state = resolvedState
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const useStore = (selector = (currentState) => currentState) => {
    return useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state)
    )
  }

  return {
    getState,
    setState,
    subscribe,
    useStore
  }
}
