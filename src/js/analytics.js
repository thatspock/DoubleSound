// Google Analytics 4, env-gated: builds without VITE_GA_ID ship zero
// tracking code, and the tag waits for window load so it never competes
// with fonts, the hero image or the video for bandwidth.
export function initAnalytics() {
  // dev builds stay silent; VITE_GA_ID can override the baked-in id
  const id = import.meta.env.VITE_GA_ID || (import.meta.env.PROD ? 'G-NC9TDZ3SJZ' : '')
  if (!id) return
  const load = () => {
    const s = document.createElement('script')
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
    s.async = true
    document.head.appendChild(s)
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() { window.dataLayer.push(arguments) }
    window.gtag('js', new Date())
    window.gtag('config', id)
  }
  if (document.readyState === 'complete') load()
  else window.addEventListener('load', load, { once: true })
}
