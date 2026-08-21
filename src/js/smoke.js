// Smoke trail (option 3): below the hero, the cursor leaves barely-there
// puffs that swell, drift up and dissolve in ~2.5s. Low-res canvas +
// CSS blur keeps it cheap; alpha peaks at ~5% so the type stays crisp.
// Desktop pointers only; the grey nav square toggles it.
export function initSmoke() {
  if (window.matchMedia('(max-width: 1024px)').matches) return null
  if (window.matchMedia('(hover: none)').matches) return null
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  const cv = document.createElement('canvas')
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70;filter:blur(10px)'
  cv.setAttribute('aria-hidden', 'true')
  document.body.appendChild(cv)
  const ctx = cv.getContext('2d')
  const S = 0.5 // render at half resolution, the blur hides it
  let W = 0, H = 0
  const resize = () => {
    W = cv.width = Math.ceil(window.innerWidth * S)
    H = cv.height = Math.ceil(window.innerHeight * S)
  }
  resize()
  window.addEventListener('resize', resize)

  let enabled = true
  const puffs = []
  let last = 0

  window.addEventListener('pointermove', (e) => {
    if (!enabled) return
    // the hero owns its own magic — smoke lives below the first screen
    if (window.scrollY + e.clientY < window.innerHeight) return
    const now = performance.now()
    if (now - last < 45 || puffs.length > 48) return
    last = now
    puffs.push({
      x: e.clientX * S,
      y: e.clientY * S,
      r: (16 + Math.random() * 26) * S,
      vx: (Math.random() - 0.5) * 0.14,
      vy: -0.1 - Math.random() * 0.2,
      born: now,
      life: 2200 + Math.random() * 900,
    })
  })

  const frame = () => {
    if (puffs.length) {
      ctx.clearRect(0, 0, W, H)
      const now = performance.now()
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]
        const t = (now - p.born) / p.life
        if (t >= 1) { puffs.splice(i, 1); if (!puffs.length) ctx.clearRect(0, 0, W, H); continue }
        p.x += p.vx
        p.y += p.vy
        const r = p.r * (1 + t * 2.4)
        const a = 0.055 * Math.sin(Math.PI * t) // swell in, dissolve out
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r)
        g.addColorStop(0, `rgba(31,31,30,${a})`)
        g.addColorStop(1, 'rgba(31,31,30,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  return {
    toggle() {
      enabled = !enabled
      if (!enabled) { puffs.length = 0; ctx.clearRect(0, 0, W, H) }
      return enabled
    },
  }
}
