let segmentitRuntimePromise = null

export function loadSegmentitRuntime () {
  if (window.Segmentit) {
    return Promise.resolve(window.Segmentit)
  }

  if (!segmentitRuntimePromise) {
    segmentitRuntimePromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-segmentit-runtime="true"]')
      if (existingScript) {
        if (window.Segmentit) {
          resolve(window.Segmentit)
          return
        }

        existingScript.addEventListener('load', () => resolve(window.Segmentit), { once: true })
        existingScript.addEventListener('error', () => reject(new Error('segmentit runtime failed to load')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = `${import.meta.env.BASE_URL}vendor/segmentit.js`
      script.async = true
      script.dataset.segmentitRuntime = 'true'
      script.onload = () => resolve(window.Segmentit)
      script.onerror = () => reject(new Error('segmentit runtime failed to load'))
      document.head.appendChild(script)
    }).then((segmentit) => {
      if (!segmentit) {
        throw new Error('segmentit runtime is unavailable')
      }

      return segmentit
    })
  }

  return segmentitRuntimePromise
}
