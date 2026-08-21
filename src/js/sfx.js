// The lineup is a drum machine where every voice is PLAYABLE: each artist
// taps a different minimal-techno instrument, and every instrument walks
// the A-minor pentatonic (shared melody engine below) — so hammering one
// name in any rhythm plays music, the Ika trick generalized to the whole
// lineup. Dry, deep, no reverb; a faint vinyl crackle rides on top of
// every hit to keep the glitch texture. Synthesized in Web Audio, no
// samples; the first gesture anywhere unlocks the context.
let ctx = null
let master = null
let last = 0

// open doublesound.live/#sfx to see this on-screen status (phone debugging)
let dbg = null
function debugLine(msg) {
  if (!location.hash.includes('sfx')) return
  if (!dbg) {
    dbg = document.createElement('div')
    dbg.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:999;background:#1f1f1e;color:#9fdc8f;padding:6px 10px;font:12px monospace;border-radius:8px;pointer-events:none;white-space:pre'
    document.body.appendChild(dbg)
  }
  dbg.textContent = msg
}

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
let bridge = null // touch devices: route synth through an <audio> element,
                  // the channel the ringer switch does NOT mute
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
    debugLine('unlock: ctx=' + ctx.state + ' keepAlive=' + !!keepAlive)
    ctx.resume().then(() => {
      debugLine('resume -> ' + ctx.state)
      if (ctx.state !== 'running') return
      UNLOCK_EVENTS.forEach((e) => document.removeEventListener(e, unlock, true))
      console.log('%c[sfx] audio unlocked — the lineup is live', 'color:#609957')
      // touch: pipe the master bus into an HTMLAudio element — media
      // playback ignores the silent switch, unlike raw Web Audio
      if (!bridge && window.matchMedia('(hover: none)').matches && ctx.createMediaStreamDestination) {
        try {
          const msd = ctx.createMediaStreamDestination()
          const out = new Audio()
          out.srcObject = msd.stream
          out.play().then(() => {
            master.disconnect()
            master.connect(msd)
            bridge = out
            debugLine('bridge ON (media route)')
          }).catch((e) => debugLine('bridge failed: ' + e?.message))
        } catch (e) { debugLine('bridge error: ' + e?.message) }
      }
      // warmup: a near-silent blip validates the whole graph on iOS
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      g.gain.value = 0.001
      o.connect(g); g.connect(master)
      o.start(); o.stop(ctx.currentTime + 0.03)
      if (pending && performance.now() - pending.ts < 1500) { playHit(pending.kind); debugLine('unlocked + replay ' + pending.kind) }
      pending = null
    }).catch((err) => { debugLine('resume FAILED: ' + err?.message); console.log('[sfx] resume failed:', err?.message) })
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

// ── melody engine (screen 2026-08-21: every name must PLAY like Ika) ────────
// One shared musical brain so any voice tapped in any rhythm comes out as
// music, not dice: notes walk the A-minor pentatonic with a pull back to
// the root (lines, not jumps), and the gap since the previous tap becomes
// the groove — fast rolls tighten and quieten each hit, spaced taps breathe.

const PENT = [0, 3, 5, 7, 10] // A minor pentatonic, semitones from A
function pentHz(base, deg) {
  const oct = Math.floor(deg / 5)
  const step = PENT[((deg % 5) + 5) % 5]
  return base * Math.pow(2, (step + 12 * oct) / 12)
}

const walks = {}
function walkDeg(kind, lo, hi) {
  const w = walks[kind] ?? (walks[kind] = { pos: 0 })
  let step = [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]
  // gravity toward the root: far from home, odds tilt back down the lattice
  if (w.pos !== 0 && Math.random() < 0.3) step = -Math.sign(w.pos) * Math.abs(step)
  w.pos = Math.max(lo, Math.min(hi, w.pos + step))
  return w.pos
}

const lastTap = {}
function groove(kind) {
  const now = performance.now()
  const gap = now - (lastTap[kind] ?? 0)
  lastTap[kind] = now
  return Math.max(0, Math.min(1, (gap - 90) / 480)) // 0 = fast roll · 1 = spaced
}

// dry minor-chord cycle for the stab voice: i → VI → III → VII — a steady
// tap rhythm harmonises itself (semitones relative to A)
const STAB_CHORDS = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]]
let stabStep = 0

const VOICES = {
  crackle() {}, // bare tick: the crackle layer alone

  // Michael Dop — tuned sub-kick: the transient stays a kick, the tail
  // SINGS a low pentatonic note; rolling taps play a deep 808-ish bassline
  kick(t) {
    const a = groove('kick')
    const f = pentHz(55, walkDeg('kick', 0, 5)) // A1 … ~G2
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * 4.2, t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05)
    const g = env(t, 0.8 + 0.15 * a, 0.28 + 0.22 * a)
    o.connect(g).connect(master)
    o.start(t); o.stop(t + 0.55)
    const click = noiseSrc(0.01)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200
    click.connect(hp).connect(env(t, 0.16, 0.01)).connect(master)
    click.start(t); click.stop(t + 0.01)
  },

  // Basic 7 — rolling acid bass: every tap a walked note through a biting
  // resonant lowpass; spaced taps open the filter (accent), rolls stay tight
  bass(t) {
    const a = groove('bass')
    const f = pentHz(55, walkDeg('bass', 0, 9)) // A1 … ~C3
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const sub = ctx.createOscillator()
    sub.type = 'square'
    sub.frequency.value = f / 2
    const subG = ctx.createGain(); subG.gain.value = 0.25
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 9
    lp.frequency.setValueAtTime(340 + 1100 * a, t)
    lp.frequency.exponentialRampToValueAtTime(130, t + 0.14 + 0.1 * a)
    const g = env(t, 0.5, 0.16 + 0.12 * a)
    o.connect(lp)
    sub.connect(subG).connect(lp)
    lp.connect(g).connect(master)
    o.start(t); o.stop(t + 0.32)
    sub.start(t); sub.stop(t + 0.32)
  },

  // Preesh — dry minimal stab: the clap snap rides on top, a dark minor
  // chord fires underneath; the chord cycles i→VI→III→VII every other tap,
  // so a steady rhythm walks its own progression
  clap(t) {
    const a = groove('clap')
    for (const [off, peak, dur] of [[0, 0.3, 0.025], [0.012, 0.26, 0.025], [0.024, 0.34, 0.1]]) {
      const n = noiseSrc(dur)
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'
      bp.frequency.value = 1300; bp.Q.value = 1.1
      n.connect(bp).connect(env(t + off, peak, dur)).connect(master)
      n.start(t + off); n.stop(t + off + dur)
    }
    stabStep += Math.random() < 0.5 ? 1 : 0
    const chord = STAB_CHORDS[stabStep % STAB_CHORDS.length]
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.value = 850 + 500 * a
    const g = env(t, 0.34, 0.16 + 0.1 * a)
    for (const semi of chord) {
      for (const det of [1, 1.004]) {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = 220 * Math.pow(2, semi / 12) * det
        o.connect(lp)
        o.start(t); o.stop(t + 0.3)
      }
    }
    lp.connect(g).connect(master)
  },

  // Dvinskikh — glass perc: the hat keeps its air, but an FM ping walks a
  // high pentatonic line under it; fast taps sparkle dry, spaced taps ring
  hat(t) {
    const a = groove('hat')
    const n = noiseSrc(0.035)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8200
    n.connect(hp).connect(env(t, 0.28, 0.032)).connect(master)
    n.start(t); n.stop(t + 0.035)
    const f = pentHz(880, walkDeg('hat', 0, 7)) // A5 … ~A6
    const car = ctx.createOscillator()
    car.type = 'sine'
    car.frequency.value = f
    const mod = ctx.createOscillator()
    mod.type = 'sine'
    mod.frequency.value = f * 3.01 // inharmonic-ish → glassy, not organ
    const mg = ctx.createGain()
    mg.gain.setValueAtTime(f * 1.4, t)
    mg.gain.exponentialRampToValueAtTime(f * 0.1, t + 0.06)
    mod.connect(mg).connect(car.frequency)
    const g = env(t, 0.16, 0.05 + 0.14 * a)
    car.connect(g).connect(master)
    car.start(t); car.stop(t + 0.25)
    mod.start(t); mod.stop(t + 0.25)
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
    // schedule now AND queue a replay: desktops hear the scheduled note
    // the moment resume lands; iOS kills sources started while suspended,
    // so the unlock handler replays the queued strike after resume
    pending = { kind, ts: performance.now() }
    ctx.resume().catch(() => {})
  }
  playHit(kind)
  debugLine('hit ' + kind + ' @' + ctx.state)
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
