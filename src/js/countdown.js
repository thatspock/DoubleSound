// Live countdown to doors: 28.08.2026, 23:00 (viewer-local time).
// Every digit change rolls old-up/new-from-below; the seconds unit
// keeps the row visibly alive between minute flips.
import { gsap } from 'gsap'

const TARGET = new Date(2026, 7, 28, 23, 0, 0)

function makeRoller(el) {
  const cur = document.createElement('span')
  const next = document.createElement('span')
  next.className = 'cd-next'
  cur.textContent = el.textContent
  el.textContent = ''
  el.classList.add('cd-roll')
  el.append(cur, next)
  let value = cur.textContent
  let busy = false
  return (v) => {
    if (v === value) return
    value = v
    if (busy) { cur.textContent = v; return }
    busy = true
    next.textContent = v
    gsap.to([cur, next], {
      yPercent: -100,
      duration: 0.55,
      ease: 'power3.inOut',
      onComplete: () => {
        cur.textContent = v
        gsap.set([cur, next], { yPercent: 0 })
        busy = false
      },
    })
  }
}

export function initCountdown() {
  const els = ['d', 'h', 'm', 's'].map((k) => document.querySelector(`[data-cd="${k}"]`))
  if (!els[0]) return
  const set = els.map((n) => (n ? makeRoller(n) : () => {}))
  const pad = (n) => String(n).padStart(2, '0')

  function tick() {
    const diff = TARGET.getTime() - Date.now()
    if (diff <= 0) {
      ;['now', '!!', '!!', '!!'].forEach((v, i) => set[i](v))
      return
    }
    const secs = Math.floor(diff / 1000)
    set[0](pad(Math.floor(secs / 86400)))
    set[1](pad(Math.floor((secs % 86400) / 3600)))
    set[2](pad(Math.floor((secs % 3600) / 60)))
    set[3](pad(secs % 60))
  }
  tick()
  setInterval(tick, 1000)
}
