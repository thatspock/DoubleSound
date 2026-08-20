// Mouse-trail reveal, bleibtgleich-style: a hidden layer (stone heart +
// flyer chips) shows through a torn, gooey trail that follows the cursor.
// Implementation: low-res trail buffer -> blurred & alpha-steepened mask
// -> destination-in over the hidden layer. No WebGL needed.

const DPR = Math.min(window.devicePixelRatio || 1, 2)

export function initFluidReveal({ onHeartClick } = {}) {
  const wrap = document.querySelector('[data-reveal-wrap]')
  const canvas = document.querySelector('[data-fluid]')
  if (!wrap || !canvas || window.matchMedia('(max-width: 991px)').matches) return

  const ctx = canvas.getContext('2d')
  const layer = document.createElement('canvas')
  const lctx = layer.getContext('2d')
  const trail = document.createElement('canvas')
  const tctx = trail.getContext('2d')
  const mask = document.createElement('canvas')
  const mctx = mask.getContext('2d')

  const TRAIL_SCALE = 0.14
  let W = 0, H = 0
  let heartBox = null

  const heart = new Image()
  heart.src = '/assets/heart-face.webp'

  function drawChip(c, text, x, y, dark, rot) {
    c.save()
    c.translate(x, y)
    c.rotate(rot)
    c.font = `560 ${H * 0.022}px 'Inter Tight Variable', Arial, sans-serif`
    const w = c.measureText(text).width + H * 0.028
    const h = H * 0.048
    c.fillStyle = dark ? '#101010' : '#f2a98a'
    c.beginPath()
    c.roundRect(-w / 2, -h / 2, w, h, h / 2)
    c.fill()
    c.fillStyle = dark ? '#f2a98a' : '#101010'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(text, 0, 1)
    c.restore()
  }

  function paintLayer() {
    lctx.clearRect(0, 0, W, H)
    if (!heart.complete || !heart.naturalWidth) return
    const hh = H * 0.62
    const hw = hh * (heart.naturalWidth / heart.naturalHeight)
    const hx = W / 2 - hw / 2
    const hy = H * 0.42 - hh / 2
    lctx.drawImage(heart, hx, hy, hw, hh)
    heartBox = { x: hx, y: hy, w: hw, h: hh }
    drawChip(lctx, '16 YEARS', W / 2 - hw * 0.62, H * 0.24, false, -0.08)
    drawChip(lctx, '28.08', W / 2 + hw * 0.58, H * 0.3, false, 0.06)
    drawChip(lctx, '×K-30', W / 2 + hw * 0.5, H * 0.66, true, -0.05)
  }

  function resize() {
    W = Math.round(wrap.clientWidth * DPR)
    H = Math.round(wrap.clientHeight * DPR)
    canvas.width = W
    canvas.height = H
    layer.width = W
    layer.height = H
    mask.width = Math.round(W / 2)
    mask.height = Math.round(H / 2)
    trail.width = Math.max(2, Math.round(W * TRAIL_SCALE))
    trail.height = Math.max(2, Math.round(H * TRAIL_SCALE))
    paintLayer()
  }

  const pointer = { x: -1, y: -1, px: -1, py: -1, lastMove: 0 }
  // autonomous wanderers: the reveal lives and churns on its own,
  // the mouse just tears it open wider
  const drifters = [
    { t: Math.random() * 100, fx: 1.3, fy: 0.9, ph: 1.7, r: 0.13 },
    { t: Math.random() * 100, fx: 0.7, fy: 1.1, ph: 4.2, r: 0.1 },
  ]

  function splat(x, y, r, a) {
    const g = tctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${a})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    tctx.fillStyle = g
    tctx.beginPath()
    tctx.arc(x, y, r, 0, Math.PI * 2)
    tctx.fill()
  }

  function frame(t) {
    // fade the trail slowly so the reveal oozes shut
    tctx.globalCompositeOperation = 'destination-out'
    tctx.fillStyle = 'rgba(0,0,0,0.010)'
    tctx.fillRect(0, 0, trail.width, trail.height)
    tctx.globalCompositeOperation = 'source-over'

    // wanderers churn all the time, mouse or not
    for (const d of drifters) {
      d.t += 0.0045
      const ix = trail.width * (0.5 + 0.34 * Math.sin(d.t * d.fx) * Math.cos(d.t * 0.63 + d.ph))
      const iy = trail.height * (0.42 + 0.3 * Math.sin(d.t * d.fy + d.ph))
      splat(ix, iy, trail.height * d.r, 0.5)
    }

    const now = performance.now()
    if (pointer.x >= 0 && now - pointer.lastMove < 90) {
      const tx = pointer.x * TRAIL_SCALE * DPR
      const ty = pointer.y * TRAIL_SCALE * DPR
      const vx = (pointer.x - pointer.px) * TRAIL_SCALE * DPR
      const vy = (pointer.y - pointer.py) * TRAIL_SCALE * DPR
      const speed = Math.min(Math.hypot(vx, vy), 18)
      const base = trail.height * 0.17
      for (let i = 0; i < 4; i++) {
        const k = i / 4
        splat(tx - vx * k * 2.4, ty - vy * k * 2.4, base * (0.75 + Math.random() * 0.5) + speed, 0.9)
      }
      pointer.px = pointer.x
      pointer.py = pointer.y
    }

    // steepen alpha into a torn-edged goo mask
    mctx.clearRect(0, 0, mask.width, mask.height)
    mctx.filter = `blur(${mask.height * 0.014}px)`
    mctx.drawImage(trail, 0, 0, mask.width, mask.height)
    mctx.filter = 'none'
    for (let i = 0; i < 4; i++) mctx.drawImage(mask, 0, 0)

    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(layer, 0, 0)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(mask, 0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'

    requestAnimationFrame(frame)
  }

  const hero = document.querySelector('.hero')
  hero.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect()
    pointer.x = e.clientX - r.left
    pointer.y = e.clientY - r.top
    if (pointer.px < 0) { pointer.px = pointer.x; pointer.py = pointer.y }
    pointer.lastMove = performance.now()
  })
  hero.addEventListener('click', (e) => {
    if (!heartBox || !onHeartClick) return
    const r = wrap.getBoundingClientRect()
    const x = (e.clientX - r.left) * DPR
    const y = (e.clientY - r.top) * DPR
    if (x > heartBox.x && x < heartBox.x + heartBox.w && y > heartBox.y && y < heartBox.y + heartBox.h) {
      onHeartClick(e.clientX)
    }
  })

  heart.decode().then(() => paintLayer()).catch(() => {})
  document.fonts?.ready.then(() => paintLayer())
  window.addEventListener('resize', resize)
  resize()

  // welcome burst: the heart arrives mostly revealed
  for (let i = 0; i < 26; i++) {
    splat(
      trail.width * (0.5 + (Math.random() - 0.5) * 0.42),
      trail.height * (0.42 + (Math.random() - 0.5) * 0.4),
      trail.height * (0.1 + Math.random() * 0.14),
      0.9,
    )
  }
  requestAnimationFrame(frame)
}
