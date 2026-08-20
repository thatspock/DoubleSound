// Easter egg: every click on the stone heart drops another Ika head.
// Tiny 2D physics sim — gravity, floor at the bottom of the first screen,
// bouncy circle-circle collisions with spin, and once the pile grows,
// the oldest heads phase out and sink through the floor.

const G = 2600            // px/s^2
const REST_FLOOR = 0.42   // floor bounciness
const REST_HEAD = 0.5     // head-vs-head bounciness
const MAX_ACTIVE = 7      // pile size before heads start sinking
const AR = 910 / 842      // head image h/w

let field = null
let heads = []
let running = false
let lastT = 0
let logged = false

function ensureField() {
  if (field) return field
  const hero = document.querySelector('.hero')
  field = document.createElement('div')
  field.style.cssText = 'position:absolute;inset:0 0 auto 0;height:100svh;overflow:clip;z-index:5;pointer-events:none'
  hero.appendChild(field)
  return field
}

export function dropIka(clickX) {
  const f = ensureField()
  const W = f.clientWidth
  const H = f.clientHeight
  const r = Math.min(H * 0.11, W * 0.09)

  if (!logged) {
    logged = true
    console.log('%cIKA ON THE DECKS', 'color:#f2a98a;background:#101010;padding:4px 10px;border-radius:10px;font-weight:bold')
  }

  const el = document.createElement('img')
  el.src = '/assets/head-ika.webp'
  el.alt = ''
  el.style.cssText = `position:absolute;left:0;top:0;width:${r * 2}px;will-change:transform`
  f.appendChild(el)

  const hh = r * AR // half-height; (x, y) is the image center
  const x = Math.min(Math.max(clickX ?? W / 2, r + 4), W - r - 4)
  heads.push({
    x, y: -hh - 10,
    vx: (Math.random() - 0.5) * 160,
    vy: 0,
    a: (Math.random() - 0.5) * 0.6,
    va: (Math.random() - 0.5) * 2,
    r, hh, el, phantom: false,
  })

  // pile overflow: the oldest solid head starts sinking
  const active = heads.filter((h) => !h.phantom)
  if (active.length > MAX_ACTIVE) active[0].phantom = true

  if (!running) {
    running = true
    lastT = performance.now()
    requestAnimationFrame(tick)
  }
}

// the ground has a gentle mound in the middle — heads roll off to the sides
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
    h.vy += G * dt
    h.x += h.vx * dt
    h.y += h.vy * dt
    h.a += h.va * dt

    if (!h.phantom) {
      const floor = H - humpAt(h.x, W, H) - h.hh
      if (h.y > floor) {
        h.y = floor
        if (Math.abs(h.vy) > 60) h.vy = -h.vy * REST_FLOOR
        else h.vy = 0
        h.vx += -G * 2 * humpSlope(h.x, W, H) * dt  // roll downhill, away from the mound
        h.vx *= 0.985                  // rolling friction
        h.va = h.vx / h.r              // roll, don't slide
      }
      if (h.x < h.r) { h.x = h.r; h.vx = -h.vx * 0.5 }
      if (h.x > W - h.r) { h.x = W - h.r; h.vx = -h.vx * 0.5 }
    }
  }

  // circle-circle collisions (equal masses)
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
      const push = (min - d) / 2
      A.x -= nx * push; A.y -= ny * push
      B.x += nx * push; B.y += ny * push
      const rvx = B.vx - A.vx, rvy = B.vy - A.vy
      const vn = rvx * nx + rvy * ny
      if (vn < 0) {
        const jimp = (-(1 + REST_HEAD) * vn) / 2
        A.vx -= jimp * nx; A.vy -= jimp * ny
        B.vx += jimp * nx; B.vy += jimp * ny
        const vt = rvx * -ny + rvy * nx
        A.va += (vt / A.r) * 0.25
        B.va -= (vt / B.r) * 0.25
      }
    }
  }

  // render + cull sunk heads
  heads = heads.filter((h) => {
    if (h.y - h.hh > H * 1.4) { h.el.remove(); return false }
    h.el.style.transform = `translate(${h.x - h.r}px, ${h.y - h.hh}px) rotate(${h.a}rad)`
    return true
  })

  if (heads.length) requestAnimationFrame(tick)
  else running = false
}
