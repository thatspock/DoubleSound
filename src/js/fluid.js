// Mouse-trail reveal, bleibtgleich-style: a hidden layer (stone heart +
// flyer chips) shows through a torn, gooey trail that follows the cursor.
// Implementation: low-res trail buffer -> blurred & alpha-steepened mask
// -> destination-in over the hidden layer. No WebGL needed.

import { moveHint, showHint, hideHint } from './hint.js'

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
  const content = document.createElement('canvas')
  const cctx = content.getContext('2d')

  const TRAIL_SCALE = 0.26
  let W = 0, H = 0
  let heartBox = null

  const heart = new Image()
  heart.src = '/assets/heart-face.webp'

  // looping hearts video is the hidden layer; the still heart covers
  // the first moments while it buffers
  const video = document.createElement('video')
  video.src = '/assets/heart-loop.mp4'
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = 'auto'
  video.play().catch(() => {})

  function drawChip(c, text, x, y, dark, rot) {
    c.save()
    c.translate(x, y)
    c.rotate(rot)
    c.font = `560 ${H * 0.022}px 'Inter Tight Variable', Arial, sans-serif`
    const w = c.measureText(text).width + H * 0.028
    const h = H * 0.048
    c.fillStyle = dark ? '#262625' : '#609957'
    c.beginPath()
    c.roundRect(-w / 2, -h / 2, w, h, h / 2)
    c.fill()
    c.fillStyle = dark ? '#609957' : '#262625'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(text, 0, 1)
    c.restore()
  }

  function paintLayer() {
    lctx.clearRect(0, 0, W, H)
    if (video.readyState >= 2 && video.videoWidth) {
      const s = Math.max(W / video.videoWidth, H / video.videoHeight)
      const dw = video.videoWidth * s
      const dh = video.videoHeight * s
      lctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh)
      heartBox = { x: W * 0.3, y: H * 0.18, w: W * 0.4, h: H * 0.62 }
    } else if (heart.complete && heart.naturalWidth) {
      const hh = H * 0.62
      const hw = hh * (heart.naturalWidth / heart.naturalHeight)
      const hx = W / 2 - hw / 2
      const hy = H * 0.42 - hh / 2
      lctx.drawImage(heart, hx, hy, hw, hh)
      heartBox = { x: hx, y: hy, w: hw, h: hh }
    } else {
      return
    }
    drawChip(lctx, '16 YEARS', W * 0.24, H * 0.24, false, -0.08)
    drawChip(lctx, '28.08', W * 0.77, H * 0.3, false, 0.06)
    drawChip(lctx, '×K-30', W * 0.73, H * 0.66, true, -0.05)
  }

  function resize() {
    W = Math.round(wrap.clientWidth * DPR)
    H = Math.round(wrap.clientHeight * DPR)
    canvas.width = W
    canvas.height = H
    layer.width = W
    layer.height = H
    content.width = W
    content.height = H
    // mask in CSS-pixel resolution: fine enough for liquid curves,
    // cheap enough for per-frame GPU blurs
    mask.width = Math.round(W / DPR)
    mask.height = Math.round(H / DPR)
    trail.width = Math.max(2, Math.round(W * TRAIL_SCALE))
    trail.height = Math.max(2, Math.round(H * TRAIL_SCALE))
    paintLayer()
  }

  const pointer = { x: -1, y: -1, px: -1, py: -1, lastMove: 0 }
  let cleanTick = 0

  // canvas SVG-filter support (Safari lacks it — fall back to alpha stacking)
  mctx.filter = 'url(#fluid-step)'
  const hasStepFilter = mctx.filter !== 'none'
  mctx.filter = 'none'

  // 8-bit alpha quantization makes multiplicative fade stall on faint
  // tails, and the threshold pumps them back up — sweep them to zero
  function sweepFaintTails() {
    const id = tctx.getImageData(0, 0, trail.width, trail.height)
    const d = id.data
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] > 0 && d[i] < 28) d[i] = Math.max(0, d[i] - 7)
    }
    tctx.putImageData(id, 0, 0)
  }

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
    // no ghost layer — the reveal simply melts away, water-like
    tctx.globalCompositeOperation = 'destination-out'
    tctx.fillStyle = 'rgba(0,0,0,0.018)'
    tctx.fillRect(0, 0, trail.width, trail.height)
    tctx.globalCompositeOperation = 'source-over'

    if (++cleanTick % 10 === 0) sweepFaintTails()

    const now = performance.now()
    if (pointer.x >= 0 && now - pointer.lastMove < 90) {
      const tx = pointer.x * TRAIL_SCALE * DPR
      const ty = pointer.y * TRAIL_SCALE * DPR
      const vx = (pointer.x - pointer.px) * TRAIL_SCALE * DPR
      const vy = (pointer.y - pointer.py) * TRAIL_SCALE * DPR
      const speed = Math.min(Math.hypot(vx, vy), 22)
      const base = trail.height * 0.15
      // jelly cluster: a core along the stroke + a few big smooth lobes
      for (let i = 0; i < 3; i++) {
        const k = i / 3
        splat(tx - vx * k * 2.4, ty - vy * k * 2.4, base * (0.75 + Math.random() * 0.4) + speed, 0.9)
      }
      for (let i = 0; i < 2; i++) {
        const ang = Math.random() * Math.PI * 2
        const dist = base * (0.5 + Math.random() * 0.5)
        splat(tx + Math.cos(ang) * dist, ty + Math.sin(ang) * dist, base * (0.45 + Math.random() * 0.3), 0.9)
      }
      if (Math.random() < 0.08) {
        const ang = Math.random() * Math.PI * 2
        const dist = base * (1.6 + Math.random() * 0.8)
        splat(tx + Math.cos(ang) * dist, ty + Math.sin(ang) * dist, base * (0.3 + Math.random() * 0.2), 0.85)
      }
      pointer.px = pointer.x
      pointer.py = pointer.y
    }

    // wide blur, then a HARD alpha step: the edge is the 0.5 iso-line of
    // the metaball field — binary, no partial-alpha skirt smearing over
    // the video while the trail melts. A 1px pass anti-aliases the rim.
    mctx.clearRect(0, 0, mask.width, mask.height)
    mctx.filter = `blur(${mask.height * 0.02}px)`
    mctx.drawImage(trail, 0, 0, mask.width, mask.height)
    mctx.globalCompositeOperation = 'copy'
    if (hasStepFilter) {
      mctx.filter = 'url(#fluid-step)'
      mctx.drawImage(mask, 0, 0)
    } else {
      mctx.filter = 'none'
      mctx.globalCompositeOperation = 'source-over'
      for (let i = 0; i < 8; i++) mctx.drawImage(mask, 0, 0)
      mctx.globalCompositeOperation = 'copy'
    }
    mctx.filter = 'blur(1px)'
    mctx.drawImage(mask, 0, 0)
    mctx.filter = 'none'
    mctx.globalCompositeOperation = 'source-over'

    paintLayer() // video frame changes every tick

    // full-strength content only inside the fresh mask
    cctx.clearRect(0, 0, W, H)
    cctx.drawImage(layer, 0, 0)
    cctx.globalCompositeOperation = 'destination-in'
    cctx.drawImage(mask, 0, 0, W, H)
    cctx.globalCompositeOperation = 'source-over'

    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(content, 0, 0)

    requestAnimationFrame(frame)
  }

  const hero = document.querySelector('.hero')
  hero.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect()
    pointer.x = e.clientX - r.left
    pointer.y = e.clientY - r.top
    if (pointer.px < 0) { pointer.px = pointer.x; pointer.py = pointer.y }
    pointer.lastMove = performance.now()
    const inHeart = heartBox &&
      pointer.x * DPR > heartBox.x && pointer.x * DPR < heartBox.x + heartBox.w &&
      pointer.y * DPR > heartBox.y && pointer.y * DPR < heartBox.y + heartBox.h
    hero.style.cursor = inHeart ? 'pointer' : ''
    if (inHeart) { moveHint(e.clientX, e.clientY); showHint() } else hideHint()
  })
  hero.addEventListener('pointerleave', hideHint)
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

  requestAnimationFrame(frame)
}
