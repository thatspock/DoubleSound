import '@fontsource-variable/inter-tight'
import './styles/main.css'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

import { HEART_D } from './js/heart-path.js'
import { initGooReveals, playUnreachableGoo } from './js/goo.js'
import { runPreloader } from './js/preloader.js'
import { initFluidReveal } from './js/fluid.js'
import { initCountdown } from './js/countdown.js'
import { dropHeart, dropEgg } from './js/easter.js'
import { moveHint, showHint, hideHint } from './js/hint.js'
import { bootLog } from './js/boot-log.js'
import { initAudio } from './js/audio.js'
import { initAnalytics } from './js/analytics.js'
import { hit, initSfx, windTouch, spin } from './js/sfx.js'

gsap.registerPlugin(ScrollTrigger)

// a refresh always opens at the top — the preloader intro assumes it
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

// ---------- smooth scroll ----------
const lenis = new Lenis({ lerp: 0.11 })
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((t) => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)
lenis.stop()

// vw typography means the document height changes with window width —
// a stale Lenis limit stops the page short of its real bottom
let resizeT = null
new ResizeObserver(() => {
  clearTimeout(resizeT)
  resizeT = setTimeout(() => { lenis.resize(); ScrollTrigger.refresh() }, 150)
}).observe(document.body)

// ---------- heart silhouettes ----------
document.querySelectorAll('[data-heart-path]').forEach((p) => p.setAttribute('d', HEART_D))

// spin totems on click — consecutive clicks wind the riser sound higher
document.querySelectorAll('[data-heart-spin]').forEach((el) => {
  let turns = 0
  let clicks = []
  el.addEventListener('click', () => {
    turns += 1
    const now = performance.now()
    clicks = clicks.filter((ts) => now - ts < 1600)
    clicks.push(now)
    spin(clicks.length)
    gsap.to(el, { rotation: turns * 360, duration: 1.4, ease: 'elastic.out(1, 0.6)' })
  })
})

// ---------- easter-egg affordance + facts-row eggs ----------
// the same cursor pill marks every hidden hotspot: spin hearts, egg rows
if (window.matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('[data-heart-spin], [data-egg]').forEach((el) => {
    const overDark = el.classList.contains('f-logo-cell') // the black countdown tile
    el.addEventListener('pointermove', (e) => { moveHint(e.clientX, e.clientY); showHint(overDark) })
    el.addEventListener('pointerleave', hideHint)
  })
}
document.querySelectorAll('[data-egg]').forEach((el) => {
  el.addEventListener('click', (e) => {
    if (e.target.closest('a')) return // row links still navigate
    dropEgg(el.dataset.egg, e.clientX, e.clientY)
  })
})

// ---------- hero note types itself in like a chat message ----------
// iMessage pattern: typing dots, then the lineup flows in word by word —
// smooth, silent, and the bubble never changes size (a hidden ghost of
// the final text reserves it). Loops while on screen.
const chatNote = document.querySelector('[data-chat]')
if (chatNote) {
  const TXT = 'Michael\u00A0Dop \u00B7 Basic\u00A07 \u00B7 Preesh \u00B7 Dvinskikh \u00B7 Ika'
  const TOKENS = TXT.match(/\S+\s*/g)
  const l1 = chatNote.querySelector('.hn-1')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const finish = () => {
    l1.textContent = TXT
    chatNote.classList.remove('is-typing')
    chatNote.classList.add('is-in', 'is-done')
  }
  if (reduced) finish()
  else {
    let alive = false
    let idle = true
    const cycle = () => {
      if (!alive) { finish(); idle = true; return }
      idle = false
      l1.textContent = ''
      chatNote.classList.remove('is-done')
      chatNote.classList.add('is-in', 'is-typing')
      setTimeout(() => {
        if (!alive) { finish(); idle = true; return }
        chatNote.classList.remove('is-typing')
        let i = 0
        const step = () => {
          if (i >= TOKENS.length) {
            setTimeout(() => chatNote.classList.add('is-done'), 200)
            setTimeout(cycle, 3500)
            return
          }
          l1.textContent += TOKENS[i]
          i += 1
          setTimeout(step, 90)
        }
        step()
      }, 900)
    }
    const io = new IntersectionObserver((entries) => {
      const inView = entries.some((e) => e.isIntersecting)
      alive = inView
      if (inView && idle) cycle()
    }, { threshold: 0.6 })
    io.observe(chatNote)
  }
}

// the grey square is parked (hidden in CSS) until it gets a new job;
// the liquid wake lives on in js/liquid-trail.js, currently unwired

// ---------- nav link char-roll ----------
document.querySelectorAll('[data-roll]').forEach((el) => {
  const text = el.textContent
  el.textContent = ''
  el.style.cssText += 'display:inline-block;position:relative;overflow:clip'
  const mk = (cls, y) => {
    const row = document.createElement('span')
    row.style.cssText = cls
    for (const ch of text) {
      const c = document.createElement('span')
      c.textContent = ch
      c.style.cssText = 'display:inline-block'
      if (y) c.style.transform = 'translateY(100%)'
      row.appendChild(c)
    }
    el.appendChild(row)
    return [...row.children]
  }
  const label = mk('display:inline-block', false)
  const shadow = mk('display:inline-block;position:absolute;left:0;top:0', true)
  const parent = el.closest('a') || el
  parent.addEventListener('mouseenter', () => {
    gsap.to(label, { yPercent: -100, duration: 0.4, ease: 'power3.inOut', stagger: 0.02 })
    gsap.to(shadow, { yPercent: -100, duration: 0.4, ease: 'power3.inOut', stagger: 0.02 })
  })
  parent.addEventListener('mouseleave', () => {
    gsap.to(label, { yPercent: 0, duration: 0.4, ease: 'power3.inOut', stagger: 0.02 })
    gsap.to(shadow, { yPercent: 0, duration: 0.4, ease: 'power3.inOut', stagger: 0.02 })
  })
})

// ---------- lineup: the words strike, the empty air breathes ----------
// Every name is a playable instrument on the shared A-minor pentatonic
// (sfx.js melody engine): Michael Dop = singing sub-kick · Basic 7 =
// rolling acid bass · Preesh = dry chord stab · Dvinskikh = glass perc ·
// Ika = acid pluck. Off the glyphs, movement swells a barely-there wind
// that fades away on its own.
const ARTIST_VOICES = ['kick', 'bass', 'clap', 'hat', 'pluck']
const TOUCH_UI = window.matchMedia('(hover: none)').matches
// scrolling must stay silent: rows sliding under a parked cursor fire
// mouseenter, and a touch-scroll starts with pointerdown — neither is
// the user "playing" the instrument
let lastMouseMove = 0
window.addEventListener('mousemove', () => { lastMouseMove = performance.now() })
let lastScrollTs = 0
lenis.on('scroll', () => { lastScrollTs = performance.now() })
const isTap = (t0, e) =>
  t0 && performance.now() - t0.ts < 350 &&
  Math.hypot(e.clientX - t0.x, e.clientY - t0.y) < 12
const strike = (el, voice) => {
  hit(voice)
  el.classList.add('is-struck')
  clearTimeout(el._struckT)
  el._struckT = setTimeout(() => el.classList.remove('is-struck'), 450)
  gsap.timeline()
    .to(el, { x: '1.2vw', duration: 0.16, ease: 'power3.out' })
    .to(el, { x: 0, duration: 0.5, ease: 'power3.out' })
}
// chords: every finger is its own pointer, so two or three rows can be
// struck at once. One finger stays a tap (scroll must survive); the
// moment a second finger lands, all held rows sound together.
const activeTouches = new Map()
document.querySelectorAll('[data-artist]').forEach((el, i) => {
  const voice = ARTIST_VOICES[i % ARTIST_VOICES.length]
  if (TOUCH_UI) {
    el.addEventListener('pointerdown', (e) => {
      el._t0 = { x: e.clientX, y: e.clientY, ts: performance.now() }
      activeTouches.set(e.pointerId, { el, voice, played: false })
      if (activeTouches.size >= 2) {
        for (const t of activeTouches.values()) {
          if (!t.played) { t.played = true; strike(t.el, t.voice) }
        }
      }
    })
    el.addEventListener('pointerup', (e) => {
      const t = activeTouches.get(e.pointerId)
      activeTouches.delete(e.pointerId)
      const t0 = el._t0
      el._t0 = null
      if (t?.played) return // already sounded as part of a chord
      if (!isTap(t0, e)) return
      strike(el, voice)
    })
    el.addEventListener('pointercancel', (e) => activeTouches.delete(e.pointerId))
    return
  }
  el.addEventListener('mouseenter', () => {
    // a wheel-scroll drives rows under a still cursor — only a moving
    // mouse counts as playing
    if (performance.now() - lastMouseMove > 200) return
    hit(voice)
    gsap.to(el, { x: '1.2vw', duration: 0.5, ease: 'power3.out' })
  })
  el.addEventListener('pointerdown', () => hit(voice))
  el.addEventListener('mouseleave', () => gsap.to(el, { x: 0, duration: 0.5, ease: 'power3.out' }))
})
// wind pitch = the note of whichever instrument's field the cursor is in
// (A/C/E/G/A up the rows — same A-minor world as the strikes)
const WIND_TONES = [440, 523.25, 659.25, 783.99, 880]
const artistsWrap = document.querySelector('.artists')
const artistRows = [...document.querySelectorAll('.artist')]
const windIfEmpty = (e) => {
  if (performance.now() - lastScrollTs < 150) return // mid-scroll = silence
  if (e.target.closest('[data-artist]')) return
  let i = artistRows.length - 1
  while (i >= 0 && e.clientY < artistRows[i].getBoundingClientRect().top) i--
  windTouch(i >= 0 ? WIND_TONES[i % WIND_TONES.length] : WIND_TONES[0])
}
artistsWrap?.addEventListener('pointermove', windIfEmpty)
if (TOUCH_UI) {
  // two fingers in the lineup = playing, not scrolling
  artistsWrap?.addEventListener('touchstart', (e) => {
    if (e.touches.length >= 2) e.preventDefault()
  }, { passive: false })
  // wind on a clean tap only — a touch-scroll also starts with pointerdown
  let wt0 = null
  artistsWrap?.addEventListener('pointerdown', (e) => { wt0 = { x: e.clientX, y: e.clientY, ts: performance.now() } })
  artistsWrap?.addEventListener('pointerup', (e) => { if (isTap(wt0, e)) windIfEmpty(e); wt0 = null })
} else {
  artistsWrap?.addEventListener('pointerdown', windIfEmpty)
}

// ---------- sticky bottom name ----------
const stickyName = document.querySelector('[data-sticky-name]')
if (stickyName) {
  gsap.to(stickyName, {
    opacity: 1,
    scrollTrigger: { trigger: '.lineup', start: 'top 80%', end: 'top 30%', scrub: true },
  })
  gsap.to('[data-sn-left]', {
    x: () => window.innerWidth * 0.28,
    scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
  })
  gsap.to('[data-sn-right]', {
    x: () => -window.innerWidth * 0.28,
    scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
  })
  // the giant closing wordmark takes over — the sticky name bows out
  gsap.to(stickyName, {
    autoAlpha: 0,
    scrollTrigger: { trigger: '.f-final', start: 'top 95%', end: 'top 70%', scrub: true },
  })
}

// ---------- custom scrollbar ----------
const thumb = document.querySelector('[data-scrollbar-thumb]')
if (thumb) {
  lenis.on('scroll', ({ progress }) => {
    const track = window.innerHeight - thumb.offsetHeight - 8
    thumb.style.transform = `translateY(${progress * track}px)`
  })
}

// ---------- hero parallax: reveal layer drifts out ----------
gsap.to('[data-reveal-wrap]', {
  yPercent: 18,
  opacity: 0.25,
  ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'center center', end: 'bottom top', scrub: true },
})

// ---------- boot ----------
bootLog()
initAnalytics()
initSfx()
initAudio()
initCountdown()
initGooReveals()
initFluidReveal({ onHeartClick: dropHeart })
// mobile: the static heart drops stone hearts too
document.querySelector('.heart-static')?.addEventListener('click', (e) => dropHeart(e.clientX))

runPreloader().then(() => {
  // belt and braces: whatever restored the position while the preloader
  // covered the screen, the site opens from the very top
  lenis.scrollTo(0, { immediate: true, force: true })
  window.scrollTo(0, 0)
  lenis.start()
  ScrollTrigger.refresh()
  playUnreachableGoo()
})
