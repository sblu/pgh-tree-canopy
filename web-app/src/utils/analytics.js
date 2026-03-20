/**
 * Lightweight Google Analytics 4 event helper.
 * Safe to call even when gtag isn't loaded (dev, GitHub Pages, etc.) —
 * calls are silently ignored unless the GA snippet is present in index.html.
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
}
