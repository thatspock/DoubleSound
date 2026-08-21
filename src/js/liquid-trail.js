// Liquid trail: below the hero the cursor drags a transparent wake —
// droplet "lenses" that refract whatever sits under them (backdrop-filter
// blur + a touch of saturate/brightness) and melt away in ~1.4s. No paint
// of its own, so it reads as clear liquid, not smoke. The blur radius is
// animated to zero by hand: fading opacity would NOT fade a backdrop
// effect. Desktop pointers only; the grey nav square toggles it.
export function initLiquidTrail() {
  if (window.matchMedia('(max-width: 1024px)').matches) return null
  if (window.matchMedia('(hover: none)').matches) return null
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  const MAX = 14
  const LIFE = 1400
  const drops = []
  let enabled = false // opt-in: the grey square switches the wake on
  let last = 0
  let raf = 0

  const spawn = (x, y, vx, vy) => {
    const el = document.createElement('div')
    const size = 54 + Math.random() * 46
    const angle = Math.atan2(vy, vx)
    const stretch = 1 + Math.min(Math.hypot(vx, vy) * 0.012, 0.7)
    el.style.cssText =
      `position:fixed;left:${x - size / 2}px;top:${y - size / 2}px;` +
      `width:${size}px;height:${size}px;border-radius:50%;` +
      `pointer-events:none;z-index:70;will-change:backdrop-filter,transform;`
    el.setAttribute('aria-hidden', 'true')
    document.body.appendChild(el)
    drops.push({ el, born: performance.now(), angle, stretch, drift: (Math.random() - 0.5) * 0.3 })
    if (!raf) raf = requestAnimationFrame(tick)
  }

  const tick = () => {
    const now = performance.now()
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]
      const t = (now - d.born) / LIFE
      if (t >= 1) { d.el.remove(); drops.splice(i, 1); continue }
      // swell slightly while the refraction dies down — water settling flat
      const blur = 2.6 * (1 - t) * (1 - t)
      const scale = 0.75 + t * 0.45
      d.el.style.transform =
        `rotate(${d.angle + d.drift * t}rad) scale(${scale * d.stretch}, ${scale})`
      d.el.style.backdropFilter =
        `blur(${blur.toFixed(2)}px) saturate(${(1 + 0.1 * (1 - t)).toFixed(2)}) brightness(${(1 + 0.02 * (1 - t)).toFixed(3)})`
    }
    raf = drops.length ? requestAnimationFrame(tick) : 0
  }

  let px = 0, py = 0
  window.addEventListener('pointermove', (e) => {
    if (!enabled) return
    // the hero owns its own magic — the wake lives below the first screen
    if (window.scrollY + e.clientY < window.innerHeight) return
    const now = performance.now()
    const vx = e.clientX - px, vy = e.clientY - py
    px = e.clientX; py = e.clientY
    if (now - last < 55 || drops.length >= MAX) return
    last = now
    spawn(e.clientX, e.clientY, vx, vy)
  })

  return {
    toggle() {
      enabled = !enabled
      if (!enabled) { drops.forEach((d) => d.el.remove()); drops.length = 0 }
      return enabled
    },
  }
}
