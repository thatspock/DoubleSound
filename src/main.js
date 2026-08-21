import '@fontsource-variable/inter-tight'
import '@fontsource-variable/inter-tight/wght-italic.css'
import './styles/main.css'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

import { HEART_D } from './js/heart-path.js'
import { initGooReveals, playUnreachableGoo } from './js/goo.js'
import { runPreloader } from './js/preloader.js'
import { initFluidReveal } from './js/fluid.js'
import { initCountdown } from './js/countdown.js'
import { dropIka, dropEgg } from './js/easter.js'
import { moveHint, showHint, hideHint } from './js/hint.js'
import { bootLog } from './js/boot-log.js'
import { initAudio } from './js/audio.js'
import { hit, initSfx, windTouch } from './js/sfx.js'

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

// spin totems on click
document.querySelectorAll('[data-heart-spin]').forEach((el) => {
  let turns = 0
  el.addEventListener('click', () => {
    turns += 1
    gsap.to(el, { rotation: turns * 360, duration: 1.4, ease: 'elastic.out(1, 0.6)' })
  })
})

// ---------- easter-egg affordance + facts-row eggs ----------
// the same cursor pill marks every hidden hotspot: spin hearts, egg rows
if (window.matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('[data-heart-spin], [data-egg]').forEach((el) => {
    el.addEventListener('pointermove', (e) => { moveHint(e.clientX, e.clientY); showHint() })
    el.addEventListener('pointerleave', hideHint)
  })
}
document.querySelectorAll('[data-egg]').forEach((el) => {
  el.addEventListener('click', (e) => {
    if (e.target.closest('a')) return // row links still navigate
    dropEgg(el.dataset.egg, e.clientX, e.clientY)
  })
})

// ---------- grid overlay toggle ----------
const gridBtn = document.querySelector('[data-grid-toggle]')
const gridOverlay = document.querySelector('[data-grid-overlay]')
gridBtn?.addEventListener('click', () => gridOverlay.classList.toggle('is-on'))

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
// Michael Dop = kick · Basic 7 = bass · Preesh = clap · Dvinskikh = hat ·
// Ika = acid pluck (pentatonic). Off the glyphs, movement swells a
// barely-there wind that fades away on its own.
const ARTIST_VOICES = ['kick', 'bass', 'clap', 'hat', 'pluck']
const TOUCH_UI = window.matchMedia('(hover: none)').matches
document.querySelectorAll('[data-artist]').forEach((el, i) => {
  const voice = ARTIST_VOICES[i % ARTIST_VOICES.length]
  if (TOUCH_UI) {
    // one handler only — iOS synthesizes mouseenter on tap, which
    // double-fired the strike and left the row stuck mid-drift
    el.addEventListener('pointerdown', () => {
      hit(voice)
      el.classList.add('is-struck')
      clearTimeout(el._struckT)
      el._struckT = setTimeout(() => el.classList.remove('is-struck'), 450)
      gsap.timeline()
        .to(el, { x: '1.2vw', duration: 0.16, ease: 'power3.out' })
        .to(el, { x: 0, duration: 0.5, ease: 'power3.out' })
    })
    return
  }
  el.addEventListener('mouseenter', () => {
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
  if (e.target.closest('[data-artist]')) return
  let i = artistRows.length - 1
  while (i >= 0 && e.clientY < artistRows[i].getBoundingClientRect().top) i--
  windTouch(i >= 0 ? WIND_TONES[i % WIND_TONES.length] : WIND_TONES[0])
}
artistsWrap?.addEventListener('pointermove', windIfEmpty)
artistsWrap?.addEventListener('pointerdown', windIfEmpty)

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
initSfx()
initAudio()
initCountdown()
initGooReveals()
initFluidReveal({ onHeartClick: dropIka })
// mobile: the static heart drops heads too
document.querySelector('.heart-static')?.addEventListener('click', (e) => dropIka(e.clientX))

runPreloader().then(() => {
  // belt and braces: whatever restored the position while the preloader
  // covered the screen, the site opens from the very top
  lenis.scrollTo(0, { immediate: true, force: true })
  window.scrollTo(0, 0)
  lenis.start()
  ScrollTrigger.refresh()
  playUnreachableGoo()
})
