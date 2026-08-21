// Synthesized UI crackles — Web Audio, no samples. Each hover gets a
// randomized vinyl-ish noise burst plus a hair of a click, so no two
// crackles sound the same. Gated by the nav sound toggle: the site is
// silent until the visitor explicitly opts in.
let ctx = null
let master = null
let enabled = false
let last = 0

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0.14
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
}

export function setSfxEnabled(v) {
  enabled = v
  if (v) ensure()
}

export function crackle() {
  if (!enabled || !ctx) return
  const now = performance.now()
  if (now - last < 70) return // rapid hover sweeps must not machine-gun
  last = now
  const t = ctx.currentTime

  // noise burst through a randomized bandpass — the crunch
  const dur = 0.03 + Math.random() * 0.05
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2
  const src = ctx.createBufferSource()
  src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800 + Math.random() * 4200
  bp.Q.value = 1 + Math.random() * 4
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.5 + Math.random() * 0.5, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(bp)
  bp.connect(g)
  g.connect(master)
  src.start(t)
  src.stop(t + dur)

  // the glitchy tick on top
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = 900 + Math.random() * 2500
  const og = ctx.createGain()
  og.gain.setValueAtTime(0.12, t)
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.012)
  osc.connect(og)
  og.connect(master)
  osc.start(t)
  osc.stop(t + 0.015)
}
