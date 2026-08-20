// Easter eggs share one physics world: Ika heads dropped from the heart
// and flat b/w sprites ejected from the facts rows all obey the same
// gravity, roll off the same floor mound, can be grabbed and thrown,
// bounce off walls/ceiling and only ever leave through the floor.

const G = 2600            // px/s^2
const REST_FLOOR = 0.42   // floor bounciness
const REST_WALL = 0.55
const REST_HEAD = 0.5     // body-vs-body bounciness
const MAX_ACTIVE = 7      // pile size before bodies start sinking
const LIFE_MS = 8000      // settled life before a body sinks away
const AR_IKA = 910 / 842  // head image h/w

let field = null
let heads = []
let running = false
let lastT = 0
let logged = false
let grabbed = null
const TOUCH = window.matchMedia('(hover: none)').matches

function ensureField() {
  if (field) return field
  // viewport-fixed so eggs can spawn from any section, not just the hero
  field = document.createElement('div')
  field.style.cssText = 'position:fixed;inset:0;overflow:clip;z-index:60;pointer-events:none'
  document.body.appendChild(field)

  document.addEventListener('pointermove', (e) => {
    if (!grabbed) return
    const r = field.getBoundingClientRect()
    const nx = e.clientX - r.left
    const ny = e.clientY - r.top
    const now = performance.now()
    const dt = Math.max((now - grabbed.gt) / 1000, 0.004)
    // smoothed cursor velocity — this becomes the throw
    grabbed.vx = grabbed.vx * 0.5 + ((nx - grabbed.x) / dt) * 0.5
    grabbed.vy = grabbed.vy * 0.5 + ((ny - grabbed.y) / dt) * 0.5
    grabbed.x = nx
    grabbed.y = ny
    grabbed.gt = now
  })
  const release = () => {
    if (!grabbed) return
    grabbed.el.style.cursor = 'grab'
    grabbed.grabbedNow = false
    grabbed.born = performance.now() // a caught body gets a fresh life
    grabbed = null
  }
  document.addEventListener('pointerup', release)
  // a touch turning into a scroll fires pointercancel — without this the
  // body stays "in hand" forever, frozen mid-air
  document.addEventListener('pointercancel', release)

  // the field is viewport-fixed, so bodies would ride along over every
  // section — once the reader scrolls on, let them sink away
  window.addEventListener('scroll', () => {
    const y = window.scrollY
    for (const h of heads) {
      if (!h.grabbedNow && Math.abs(y - h.spawnScroll) > window.innerHeight * 0.35) h.phantom = true
    }
  }, { passive: true })
  return field
}

function spawn(src, x0, y0, opts = {}) {
  const f = ensureField()
  const W = f.clientWidth
  const H = f.clientHeight
  const r = (opts.scale ?? 1) * Math.min(H * 0.11, W * 0.09)
  const ar = opts.ar ?? 1
  const hh = r * ar // half-height; (x, y) is the image center

  const el = document.createElement('img')
  el.src = src
  el.alt = ''
  el.draggable = false
  // on touch, bodies must not swallow the finger — scrolling wins over grabbing
  el.style.cssText = `position:absolute;left:0;top:0;width:${r * 2}px;will-change:transform;pointer-events:${TOUCH ? 'none' : 'auto'};cursor:grab;user-select:none;-webkit-user-drag:none`
  f.appendChild(el)

  const x = Math.min(Math.max(x0 ?? W / 2, r + 4), W - r - 4)
  const head = {
    x, y: y0 ?? -hh - 10,
    vx: opts.vx ?? (Math.random() - 0.5) * 160,
    vy: opts.vy ?? 0,
    a: (Math.random() - 0.5) * 0.6,
    va: (Math.random() - 0.5) * 2,
    r, hh, el,
    phantom: false,
    grabbedNow: false,
    born: performance.now(),
    life: LIFE_MS + Math.random() * 4000,
    spawnScroll: window.scrollY,
    gt: 0,
  }
  heads.push(head)

  el.addEventListener('pointerdown', (e) => {
    if (head.phantom) return
    e.preventDefault()
    grabbed = head
    head.grabbedNow = true
    head.vx = 0
    head.vy = 0
    head.gt = performance.now()
    el.style.cursor = 'grabbing'
  })

  // pile overflow: the oldest solid body starts sinking
  const active = heads.filter((h) => !h.phantom && !h.grabbedNow)
  if (active.length > MAX_ACTIVE) active[0].phantom = true

  if (!running) {
    running = true
    lastT = performance.now()
    requestAnimationFrame(tick)
  }
}

export function dropIka(clickX) {
  if (!logged) {
    logged = true
    console.log('%cIKA ON THE DECKS — catch him if you can', 'color:#609957;background:#101010;padding:4px 10px;border-radius:10px;font-weight:bold')
  }
  spawn('/assets/head-ika.webp', clickX, undefined, { ar: AR_IKA })
}

// facts-row eggs pop out of the clicked row, then fall like everything else
export function dropEgg(src, x, y) {
  spawn(src, x, y, {
    scale: 0.72,
    vx: (Math.random() - 0.5) * 240,
    vy: -(420 + Math.random() * 260),
  })
}

// the ground has a gentle mound in the middle — bodies roll off to the sides
function humpAt(x, W, H) {
  const u = (x - W / 2) / (W * 0.16)
  return H * 0.055 * Math.exp(-u * u)
}
function humpSlope(x, W, H) {
  const s = W * 0.16
  const u = (x - W / 2) / s
  return H * 0.055 * Math.exp(-u * u) * (-2 * u / s)
}

function tick(t) {
  const dt = Math.min((t - lastT) / 1000, 0.032)
  lastT = t
  const W = field.clientWidth
  const H = field.clientHeight

  for (const h of heads) {
    if (h.grabbedNow) {
      h.a *= 0.94 // settle upright-ish in hand
      continue
    }
    h.vy += G * dt
    h.x += h.vx * dt
    h.y += h.vy * dt
    h.a += h.va * dt

    if (!h.phantom) {
      // settled long enough — time to go
      if (t - h.born > h.life) h.phantom = true

      const floor = H - humpAt(h.x, W, H) - h.hh
      if (h.y > floor) {
        h.y = floor
        if (Math.abs(h.vy) > 60) h.vy = -h.vy * REST_FLOOR
        else h.vy = 0
        h.vx += -G * 2 * humpSlope(h.x, W, H) * dt  // roll downhill, away from the mound
        h.vx *= 0.985                  // rolling friction
        h.va = h.vx / h.r              // roll, don't slide
      }
      // walls and ceiling bounce a thrown body back into the field
      if (h.x < h.r) { h.x = h.r; h.vx = -h.vx * REST_WALL }
      if (h.x > W - h.r) { h.x = W - h.r; h.vx = -h.vx * REST_WALL }
      if (h.y < h.hh && h.vy < 0) { h.y = h.hh; h.vy = -h.vy * REST_WALL }
    }
  }

  // circle-circle collisions (equal masses; a grabbed body is immovable)
  for (let i = 0; i < heads.length; i++) {
    const A = heads[i]
    if (A.phantom) continue
    for (let j = i + 1; j < heads.length; j++) {
      const B = heads[j]
      if (B.phantom) continue
      const dx = B.x - A.x
      const dy = B.y - A.y
      const d = Math.hypot(dx, dy) || 0.001
      const min = (A.r + A.hh + B.r + B.hh) * 0.5 * 0.94
      if (d >= min) continue
      const nx = dx / d, ny = dy / d
      const push = (min - d)
      if (A.grabbedNow && !B.grabbedNow) { B.x += nx * push; B.y += ny * push }
      else if (!A.grabbedNow && B.grabbedNow) { A.x -= nx * push; A.y -= ny * push }
      else { A.x -= nx * push / 2; A.y -= ny * push / 2; B.x += nx * push / 2; B.y += ny * push / 2 }
      const rvx = B.vx - A.vx, rvy = B.vy - A.vy
      const vn = rvx * nx + rvy * ny
      if (vn < 0) {
        const jimp = (-(1 + REST_HEAD) * vn) / 2
        if (!A.grabbedNow) { A.vx -= jimp * nx; A.vy -= jimp * ny }
        if (!B.grabbedNow) { B.vx += jimp * nx; B.vy += jimp * ny }
        const vt = rvx * -ny + rvy * nx
        A.va += (vt / A.r) * 0.25
        B.va -= (vt / B.r) * 0.25
      }
    }
  }

  // render + cull sunk bodies
  heads = heads.filter((h) => {
    if (h.y - h.hh > H * 1.4) { h.el.remove(); return false }
    h.el.style.transform = `translate(${h.x - h.r}px, ${h.y - h.hh}px) rotate(${h.a}rad)`
    return true
  })

  if (heads.length) requestAnimationFrame(tick)
  else running = false
}
