// The lineup is a drum machine: every artist hovers/taps a different
// minimal-techno voice, all tuned around A minor so sweeping between
// names always sounds musical. A faint vinyl crackle rides on top of
// every hit to keep the glitch texture. Synthesized in Web Audio, no
// samples; the first gesture anywhere unlocks the context.
let ctx = null
let master = null
let last = 0

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
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']
let keepAlive = null

export function initSfx() {
  const unlock = () => {
    ensure()
    if (!keepAlive && window.matchMedia('(hover: none)').matches) {
      keepAlive = new Audio(SILENT_WAV)
      keepAlive.loop = true
      keepAlive.volume = 0.01
      keepAlive.play().catch(() => { keepAlive = null })
    }
    if (ctx && ctx.state === 'running') UNLOCK_EVENTS.forEach((e) => document.removeEventListener(e, unlock))
  }
  UNLOCK_EVENTS.forEach((e) => document.addEventListener(e, unlock))
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
    // acid pluck walking the A-minor pentatonic — the "guitar"
    const notes = [220, 261.63, 329.63, 392, 440]
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = notes[Math.floor(Math.random() * notes.length)]
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 13
    lp.frequency.setValueAtTime(2400, t)
    lp.frequency.exponentialRampToValueAtTime(280, t + 0.16)
    const g = env(t, 0.42, 0.2)
    o.connect(lp).connect(g).connect(master)
    o.start(t); o.stop(t + 0.22)
  },
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
  ensure()
  if (!ctx) return
  if (ctx.state !== 'running') {
    // the very first tap arrives while the context is still waking up —
    // queue the hit so that same gesture is heard, drop it if stale
    const asked = performance.now()
    ctx.resume().then(() => { if (performance.now() - asked < 400) playHit(kind) }).catch(() => {})
    return
  }
  playHit(kind)
}

// generic glitch tick, kept for non-lineup hotspots
export function crackle() {
  hit('crackle')
}
