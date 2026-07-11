import { useEffect } from 'react'

// Periodically re-runs `callback` while the page is open, and immediately
// on tab focus, so data added by someone else shows up without navigating away and back.
export function useAutoRefresh(callback, intervalMs = 12000) {
  useEffect(() => {
    const id = setInterval(callback, intervalMs)
    function onVisible() { if (!document.hidden) callback() }
    window.addEventListener('focus', callback)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', callback)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [callback, intervalMs])
}
