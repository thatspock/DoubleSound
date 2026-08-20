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
  // two trails: fresh (full-strength content) and old (cooled light-grey ghost)
  const trail = document.createElement('canvas')
  const tctx = trail.getContext('2d')
  const trailOld = document.createElement('canvas')
  const toctx = trailOld.getContext('2d')
  const mask = document.createElement('canvas')
  const mctx = mask.getContext('2d')
  const maskOld = document.createElement('canvas')
  const moctx = maskOld.getContext('2d')
  const gray = document.createElement('canvas')
  const gctx = gray.getContext('2d')
  const content = document.createElement('canvas')
  const cctx = content.getContext('2d')

  const TRAIL_SCALE = 0.14
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
    mask.width = Math.round(W / 2)
    mask.height = Math.round(H / 2)
    maskOld.width = mask.width
    maskOld.height = mask.height
    gray.width = mask.width
    gray.height = mask.height
    trail.width = Math.max(2, Math.round(W * TRAIL_SCALE))
    trail.height = Math.max(2, Math.round(H * TRAIL_SCALE))
    trailOld.width = trail.width
    trailOld.height = trail.height
    paintLayer()
  }

  const pointer = { x: -1, y: -1, px: -1, py: -1, lastMove: 0 }

  function splatOn(c, x, y, r, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${a})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
  }
  function splat(x, y, r, a) {
    splatOn(tctx, x, y, r, a)
    splatOn(toctx, x, y, r * 1.35, a) // the ghost spreads wider
  }

  function frame(t) {
    // fresh trail cools quickly; the grey ghost lingers for a long while
    tctx.globalCompositeOperation = 'destination-out'
    tctx.fillStyle = 'rgba(0,0,0,0.030)'
    tctx.fillRect(0, 0, trail.width, trail.height)
    tctx.globalCompositeOperation = 'source-over'
    toctx.globalCompositeOperation = 'destination-out'
    toctx.fillStyle = 'rgba(0,0,0,0.005)'
    toctx.fillRect(0, 0, trailOld.width, trailOld.height)
    toctx.globalCompositeOperation = 'source-over'

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

    // steepen alpha into torn-edged goo masks
    mctx.clearRect(0, 0, mask.width, mask.height)
    mctx.filter = `blur(${mask.height * 0.014}px)`
    mctx.drawImage(trail, 0, 0, mask.width, mask.height)
    mctx.filter = 'none'
    for (let i = 0; i < 4; i++) mctx.drawImage(mask, 0, 0)

    moctx.clearRect(0, 0, maskOld.width, maskOld.height)
    moctx.filter = `blur(${maskOld.height * 0.02}px)`
    moctx.drawImage(trailOld, 0, 0, maskOld.width, maskOld.height)
    moctx.filter = 'none'
    for (let i = 0; i < 3; i++) moctx.drawImage(maskOld, 0, 0)

    // cooled ghost: the old mask tinted light grey
    gctx.globalCompositeOperation = 'source-over'
    gctx.clearRect(0, 0, gray.width, gray.height)
    gctx.drawImage(maskOld, 0, 0)
    gctx.globalCompositeOperation = 'source-in'
    gctx.fillStyle = '#e9e9e9'
    gctx.fillRect(0, 0, gray.width, gray.height)

    paintLayer() // video frame changes every tick

    // full-strength content only inside the fresh mask
    cctx.clearRect(0, 0, W, H)
    cctx.drawImage(layer, 0, 0)
    cctx.globalCompositeOperation = 'destination-in'
    cctx.drawImage(mask, 0, 0, W, H)
    cctx.globalCompositeOperation = 'source-over'

    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(gray, 0, 0, W, H)
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

  requestAnimationFrame(frame)
}
