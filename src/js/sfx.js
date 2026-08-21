// The lineup is a drum machine: every artist hovers/taps a different
// minimal-techno voice, all tuned around A minor so sweeping between
// names always sounds musical. A faint vinyl crackle rides on top of
// every hit to keep the glitch texture. Synthesized in Web Audio, no
// samples; the first gesture anywhere unlocks the context.
let ctx = null
let master = null
let last = 0

// The context is born ONLY inside a real user gesture — creating it
// early (on hover) can leave it stuck in 'suspended' on some Chromes,
// which is why the site used to need the sound-toggle dance to wake up.
function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0.42
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
}

// iOS mutes Web Audio with the ringer switch, but a playing HTMLAudio
// element flips the session into "media playback", which the switch
// does not touch — so a silent loop makes the crackles audible on a
// muted phone. Touch devices only: it steals audio focus otherwise.
const SILENT_WAV = '/assets/silence.wav' // real file: iOS won't reliably play data: URIs
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']
let keepAlive = null
let pending = null // the strike that arrived while the context was waking

export function initSfx() {
  const unlock = () => {
    ensure()
    // second wake-up channel on every platform: a playing HTMLAudio is
    // exactly what makes the nav toggle "work", so lean on it too
    if (!keepAlive) {
      keepAlive = new Audio(SILENT_WAV)
      keepAlive.loop = true
      keepAlive.volume = 1 // the file itself is silence
      keepAlive.play().catch(() => { keepAlive = null })
    }
    ctx.resume().then(() => {
      if (ctx.state !== 'running') return
      UNLOCK_EVENTS.forEach((e) => document.removeEventListener(e, unlock, true))
      console.log('%c[sfx] audio unlocked — the lineup is live', 'color:#609957')
      if (pending && performance.now() - pending.ts < 600) playHit(pending.kind)
      pending = null
    }).catch((err) => console.log('[sfx] resume failed:', err?.message))
  }
  UNLOCK_EVENTS.forEach((e) => document.addEventListener(e, unlock, true))
}

function noiseSrc(dur) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  return src
}

function env(t, peak, dur) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(peak, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  return g
}

const VOICES = {
  crackle() {}, // bare tick: the crackle layer alone
  kick(t) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(160, t)
    o.frequency.exponentialRampToValueAtTime(44, t + 0.11)
    const g = env(t, 1.0, 0.26)
    o.connect(g).connect(master)
    o.start(t); o.stop(t + 0.28)
    const click = noiseSrc(0.012)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000
    click.connect(hp).connect(env(t, 0.25, 0.012)).connect(master)
    click.start(t); click.stop(t + 0.012)
  },
  bass(t) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = 110 // A2
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6
    lp.frequency.setValueAtTime(900, t)
    lp.frequency.exponentialRampToValueAtTime(140, t + 0.22)
    const g = env(t, 0.55, 0.26)
    o.connect(lp).connect(g).connect(master)
    o.start(t); o.stop(t + 0.28)
  },
  clap(t) {
    for (const [off, peak, dur] of [[0, 0.5, 0.03], [0.013, 0.45, 0.03], [0.027, 0.55, 0.16]]) {
      const n = noiseSrc(dur)
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
      bp.frequency.value = 1150; bp.Q.value = 0.9
      n.connect(bp).connect(env(t + off, peak, dur)).connect(master)
      n.start(t + off); n.stop(t + off + dur)
    }
  },
  hat(t) {
    const n = noiseSrc(0.05)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7800
    n.connect(hp).connect(env(t, 0.4, 0.045)).connect(master)
    n.start(t); n.stop(t + 0.05)
  },
  pluck(t) {
    // rominimal guitar: a muted low string (Karplus–Strong, softened
    // excitation), dark-filtered, with a tuned sub-tom underneath and a
    // deep muffled dub tail — dry, woody, hypnotic
    const notes = [110, 130.81, 164.81, 196, 220] // A minor pent, an octave down
    const f = notes[Math.floor(Math.random() * notes.length)]
    const out = ctx.createGain()
    out.gain.setValueAtTime(0.42, t)
    out.gain.setTargetAtTime(0, t + 0.7, 0.3)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1300
    for (const det of [1, 1.003]) {
      const src = ctx.createBufferSource()
      src.buffer = pluckString(f * det)
      src.connect(lp)
      src.start(t)
      src.stop(t + 1.4)
    }
    lp.connect(out)
    out.connect(master)
    out.connect(ensurePluckEcho())
    // tuned sub-tom body under the string
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(f / 2, t)
    sub.frequency.exponentialRampToValueAtTime(f / 2.4, t + 0.12)
    const sg = env(t, 0.2, 0.14)
    sub.connect(sg)
    sg.connect(master)
    sub.start(t)
    sub.stop(t + 0.16)
  },
}

// Karplus–Strong: a noise burst circulating in a ring buffer with
// averaging — decays like a real plucked string
function pluckString(freq) {
  const sr = ctx.sampleRate
  const dur = 1.5
  const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr)
  const d = buf.getChannelData(0)
  const N = Math.max(2, Math.round(sr / freq))
  const ring = new Float32Array(N)
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1
  // soften the excitation — a finger, not a pick: two smoothing passes
  for (let p = 0; p < 2; p++) {
    let prev = ring[N - 1]
    for (let i = 0; i < N; i++) { const c = ring[i]; ring[i] = (c + prev) / 2; prev = c }
  }
  let idx = 0
  for (let i = 0; i < d.length; i++) {
    const cur = ring[idx]
    const nxt = ring[(idx + 1) % N]
    d[i] = cur
    ring[idx] = 0.993 * 0.5 * (cur + nxt)
    idx = (idx + 1) % N
  }
  return buf
}

// hypnotic tail: one shared feedback delay, band-filtered so the echoes
// get rounder and deeper with every repeat
let pluckEcho = null
function ensurePluckEcho() {
  if (pluckEcho) return pluckEcho
  const send = ctx.createGain()
  send.gain.value = 0.18
  const dly = ctx.createDelay(1)
  dly.delayTime.value = 0.34
  const fb = ctx.createGain()
  fb.gain.value = 0.45
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 650
  bp.Q.value = 1.0
  const wet = ctx.createGain()
  wet.gain.value = 0.38
  send.connect(dly)
  dly.connect(bp)
  bp.connect(fb)
  fb.connect(dly)
  bp.connect(wet)
  wet.connect(master)
  pluckEcho = send
  return send
}

// barely-there wind for the empty air between the names: movement swells
// it in softly, stillness lets it fade out on its own
let wind = null

// pink noise — smoother and more "analog" than white (Paul Kellet's filter)
function pinkBuf(dur) {
  const sr = ctx.sampleRate
  const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr)
  const d = buf.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
    b6 = w * 0.115926
  }
  return buf
}

// sparse organic ticks — the bark grain
function barkBuf(dur) {
  const sr = ctx.sampleRate
  const buf = ctx.createBuffer(1, Math.ceil(sr * dur), sr)
  const d = buf.getChannelData(0)
  for (let n = 0; n < 46; n++) {
    const pos = Math.floor(Math.random() * (d.length - 400))
    const len = 40 + Math.floor(Math.random() * 280)
    const amp = 0.3 + Math.random() * 0.7
    for (let j = 0; j < len; j++) {
      d[pos + j] += amp * (Math.random() * 2 - 1) * Math.exp(-(j / len) * 6)
    }
  }
  return buf
}

function ensureWind() {
  if (wind) return
  const g = ctx.createGain()
  g.gain.value = 0
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null

  // body: pink noise breathing through the zone's note
  const body = ctx.createBufferSource()
  body.buffer = pinkBuf(4)
  body.loop = true
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 180
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 620
  bp.Q.value = 0.9
  body.connect(hp); hp.connect(bp); bp.connect(g)

  // air: a silky high sliver of the same pink
  const air = ctx.createBufferSource()
  air.buffer = pinkBuf(3.1)
  air.loop = true
  const airHp = ctx.createBiquadFilter()
  airHp.type = 'highpass'
  airHp.frequency.value = 5600
  const airG = ctx.createGain()
  airG.gain.value = 0.5
  air.connect(airHp); airHp.connect(airG); airG.connect(g)

  // bark: sparse warm ticks riding the same swell
  const bark = ctx.createBufferSource()
  bark.buffer = barkBuf(5)
  bark.loop = true
  const barkLp = ctx.createBiquadFilter()
  barkLp.type = 'lowpass'
  barkLp.frequency.value = 2100
  const barkG = ctx.createGain()
  barkG.gain.value = 0.6
  bark.connect(barkLp); barkLp.connect(barkG); barkG.connect(g)

  // slow drifts: filter sway around the note + wandering stereo position
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.11
  const lfoAmp = ctx.createGain()
  lfoAmp.gain.value = 70
  lfo.connect(lfoAmp); lfoAmp.connect(bp.frequency)
  if (pan) {
    const drift = ctx.createOscillator()
    drift.frequency.value = 0.047
    const driftAmp = ctx.createGain()
    driftAmp.gain.value = 0.55
    drift.connect(driftAmp); driftAmp.connect(pan.pan)
    g.connect(pan); pan.connect(master)
    drift.start()
  } else {
    g.connect(master)
  }
  body.start(); air.start(); bark.start(); lfo.start()
  wind = { g, bp }
}

// tone follows the instrument whose field the cursor is over, gliding
// there smoothly so crossing zones sounds liquid, not stepped
export function windTouch(freq = 620) {
  if (!ctx || ctx.state !== 'running') return
  ensureWind()
  const t = ctx.currentTime
  wind.bp.frequency.setTargetAtTime(freq, t, 0.25)
  const g = wind.g.gain
  g.cancelScheduledValues(t)
  g.setTargetAtTime(0.04, t, 0.45)     // swell in while the cursor moves
  g.setTargetAtTime(0, t + 0.4, 1.4)  // and die down once it stops
}

function crackleLayer(t) {
  const dur = 0.025 + Math.random() * 0.04
  const n = noiseSrc(dur)
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
  bp.frequency.value = 2200 + Math.random() * 3800
  bp.Q.value = 1 + Math.random() * 4
  n.connect(bp).connect(env(t, 0.18, dur)).connect(master)
  n.start(t); n.stop(t + dur)
}

function playHit(kind) {
  const now = performance.now()
  if (now - last < 55) return // fast sweeps groove, they don't machine-gun
  last = now
  const t = ctx.currentTime
  ;(VOICES[kind] || VOICES.hat)(t)
  crackleLayer(t)
}

export function hit(kind) {
  if (!ctx) {
    // no context yet — the unlock handler (same gesture) replays this
    pending = { kind, ts: performance.now() }
    return
  }
  if (ctx.state !== 'running') {
    // schedule on the sleeping context anyway: notes queued at t=now
    // sound the instant resume() lands inside this same touch — waiting
    // for the promise made iOS swallow the first tap
    ctx.resume().catch(() => {})
  }
  playHit(kind)
}

// generic glitch tick, kept for non-lineup hotspots
export function crackle() {
  hit('crackle')
}

// the spinning heart tile: a dry deep-tech riser — a resonant blip
// gliding upward; consecutive clicks (momentum) push the glide higher,
// like something spinning up. Quiet by design.
export function spin(momentum = 1) {
  if (!ctx) {
    pending = { kind: 'crackle', ts: performance.now() }
    return
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {})
  const t = ctx.currentTime
  const m = Math.min(momentum, 6)
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(70, t)
  o.frequency.exponentialRampToValueAtTime(140 + m * 90, t + 0.22)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 9
  lp.frequency.setValueAtTime(320, t)
  lp.frequency.exponentialRampToValueAtTime(700 + m * 350, t + 0.22)
  const g = env(t, 0.22, 0.3)
  o.connect(lp)
  lp.connect(g)
  g.connect(master)
  o.start(t)
  o.stop(t + 0.32)
  // dry tick at the flick of the wrist
  const c = ctx.createOscillator()
  c.type = 'square'
  c.frequency.value = 1200 + m * 300
  const cg = env(t, 0.06, 0.01)
  c.connect(cg)
  cg.connect(master)
  c.start(t)
  c.stop(t + 0.012)
}
