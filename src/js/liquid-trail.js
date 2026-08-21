// Liquid wake, hero-grade: the same metaball trail as the front-page
// reveal (low-res ink buffer -> blur -> hard 0.5 threshold), but slimmer
// and short-lived, and instead of unveiling a hidden layer it clips a
// backdrop-filter "glass" sheet — the page itself refracts inside the
// liquid shape and settles back as the ink melts. Marching squares turns
// the thresholded field into a clip-path each frame; the crisp glass rim
// is the look. Desktop pointers only; the grey nav square opts in (OFF
// by default).
export function initLiquidTrail() {
  if (window.matchMedia('(max-width: 1024px)').matches) return null
  if (window.matchMedia('(hover: none)').matches) return null
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  const SC = 10 // screen pixels per field cell
  const FADE = 0.02 // ink melt per frame — a short, watery tail

  const sheet = document.createElement('div')
  sheet.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:70;visibility:hidden;' +
    'backdrop-filter:blur(1.8px) saturate(1.1) brightness(1.005);' +
    'will-change:clip-path;'
  sheet.setAttribute('aria-hidden', 'true')
  document.body.appendChild(sheet)

  const trail = document.createElement('canvas')
  const tctx = trail.getContext('2d')
  const soft = document.createElement('canvas')
  const sctx = soft.getContext('2d', { willReadFrequently: true })
  let FW = 0, FH = 0
  const resize = () => {
    FW = Math.max(4, Math.ceil(window.innerWidth / SC))
    FH = Math.max(4, Math.ceil(window.innerHeight / SC))
    trail.width = soft.width = FW
    trail.height = soft.height = FH
  }
  resize()
  window.addEventListener('resize', resize)

  let enabled = false // opt-in: the grey square switches the wake on
  let raf = 0
  let hasInk = false
  const pointer = { x: -1, y: -1, px: -1, py: -1, lastMove: 0 }

  window.addEventListener('pointermove', (e) => {
    if (!enabled) return
    // the hero owns its own magic — the wake lives below the first screen
    if (window.scrollY + e.clientY < window.innerHeight) return
    if (pointer.x < 0) { pointer.px = e.clientX; pointer.py = e.clientY }
    else { pointer.px = pointer.x; pointer.py = pointer.y }
    pointer.x = e.clientX
    pointer.y = e.clientY
    pointer.lastMove = performance.now()
    if (!raf) raf = requestAnimationFrame(frame)
  })

  function splat(x, y, r) {
    const g = tctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.85)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    tctx.fillStyle = g
    tctx.beginPath()
    tctx.arc(x, y, r, 0, Math.PI * 2)
    tctx.fill()
  }

  // marching squares over the blurred field: emits closed loops as a
  // path string in screen coordinates, edges placed by interpolation
  function buildPath(a) {
    const at = (x, y) => a[(y * FW + x) * 4 + 3] / 255
    const segs = new Map() // "x,y" start -> [end, endKey]
    const key = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`
    const T = 0.5
    for (let y = 0; y < FH - 1; y++) {
      for (let x = 0; x < FW - 1; x++) {
        const v0 = at(x, y), v1 = at(x + 1, y), v2 = at(x + 1, y + 1), v3 = at(x, y + 1)
        const idx = (v0 > T ? 8 : 0) | (v1 > T ? 4 : 0) | (v2 > T ? 2 : 0) | (v3 > T ? 1 : 0)
        if (idx === 0 || idx === 15) continue
        const lerp = (va, vb) => (T - va) / (vb - va || 1e-6)
        const top = [x + lerp(v0, v1), y]
        const right = [x + 1, y + lerp(v1, v2)]
        const bottom = [x + lerp(v3, v2), y + 1]
        const left = [x, y + lerp(v0, v3)]
        const add = (p, q) => segs.set(key(p[0], p[1]), [q, key(q[0], q[1])])
        switch (idx) {
          case 1: add(left, bottom); break
          case 2: add(bottom, right); break
          case 3: add(left, right); break
          case 4: add(right, top); break
          case 5: add(right, bottom); add(left, top); break
          case 6: add(bottom, top); break
          case 7: add(left, top); break
          case 8: add(top, left); break
          case 9: add(top, bottom); break
          case 10: add(top, right); add(bottom, left); break
          case 11: add(top, right); break
          case 12: add(right, left); break
          case 13: add(right, bottom); break
          case 14: add(bottom, left); break
        }
      }
    }
    let d = ''
    const used = new Set()
    for (const [start, first] of segs) {
      if (used.has(start)) continue
      let [pt, k] = first
      d += `M${(parseFloat(start) * SC).toFixed(1)} ${(parseFloat(start.split(',')[1]) * SC).toFixed(1)}`
      used.add(start)
      let guard = 0
      while (k && !used.has(k) && guard++ < 4000) {
        d += `L${(pt[0] * SC).toFixed(1)} ${(pt[1] * SC).toFixed(1)}`
        used.add(k)
        const nxt = segs.get(k)
        if (!nxt) break
        ;[pt, k] = nxt
      }
      d += 'Z'
    }
    return d
  }

  function frame() {
    raf = 0
    // melt
    tctx.globalCompositeOperation = 'destination-out'
    tctx.fillStyle = `rgba(0,0,0,${FADE})`
    tctx.fillRect(0, 0, FW, FH)
    tctx.globalCompositeOperation = 'source-over'

    const now = performance.now()
    if (enabled && pointer.x >= 0 && now - pointer.lastMove < 80) {
      const tx = pointer.x / SC
      const ty = pointer.y / SC
      const vx = (pointer.x - pointer.px) / SC
      const vy = (pointer.y - pointer.py) / SC
      const speed = Math.min(Math.hypot(vx, vy), 6)
      // slim wake: a small core dragged along the stroke, nothing more
      const base = 2.4 + speed * 0.25
      splat(tx, ty, base)
      splat(tx - vx * 0.5, ty - vy * 0.5, base * 0.8)
      hasInk = true
    }

    if (hasInk) {
      sctx.clearRect(0, 0, FW, FH)
      sctx.filter = 'blur(1.2px)'
      sctx.drawImage(trail, 0, 0)
      sctx.filter = 'none'
      const img = sctx.getImageData(0, 0, FW, FH)
      const d = buildPath(img.data)
      if (d) {
        sheet.style.clipPath = `path("${d}")`
        sheet.style.visibility = 'visible'
      } else {
        sheet.style.visibility = 'hidden'
        hasInk = false
        tctx.clearRect(0, 0, FW, FH)
      }
      raf = requestAnimationFrame(frame)
    } else {
      sheet.style.visibility = 'hidden'
    }
  }

  return {
    toggle() {
      enabled = !enabled
      if (!enabled) {
        tctx.clearRect(0, 0, FW, FH)
        hasInk = false
        sheet.style.visibility = 'hidden'
        pointer.x = -1
      }
      return enabled
    },
  }
}
