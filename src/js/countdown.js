// Live countdown to doors: 28.08.2026, 23:00 (viewer-local time)
const TARGET = new Date(2026, 7, 28, 23, 0, 0)

export function initCountdown() {
  const d = document.querySelector('[data-cd="d"]')
  const h = document.querySelector('[data-cd="h"]')
  const m = document.querySelector('[data-cd="m"]')
  if (!d) return

  const pad = (n) => String(n).padStart(2, '0')

  function tick() {
    const diff = TARGET.getTime() - Date.now()
    if (diff <= 0) {
      d.textContent = 'now'
      h.textContent = '!!'
      m.textContent = '!!'
      return
    }
    const mins = Math.floor(diff / 60000)
    d.textContent = pad(Math.floor(mins / 1440))
    h.textContent = pad(Math.floor((mins % 1440) / 60))
    m.textContent = pad(mins % 60)
  }
  tick()
  setInterval(tick, 1000)
}
