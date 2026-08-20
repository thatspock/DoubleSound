import { gsap } from 'gsap'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { HEART_D } from './heart-path.js'
import { attachGoo } from './goo.js'

gsap.registerPlugin(MorphSVGPlugin)

// rect -> heart morph + gooey percent counter, then clip the overlay away
export function runPreloader() {
  const pre = document.querySelector('[data-preloader]')
  const path = pre.querySelector('[data-pre-path]')
  const countEl = pre.querySelector('[data-pre-count]')
  const countBlur = attachGoo(countEl, 0)

  const heartImg = new Image()
  heartImg.src = '/assets/heart-face.webp'
  const imgReady = heartImg.decode().catch(() => {})

  const state = { p: 0 }
  const tl = gsap.timeline()
  tl.to(path, { morphSVG: HEART_D, duration: 1.5, ease: 'power2.inOut' }, 0)
  // the face condenses in once the silhouette has (mostly) become a heart
  tl.to('[data-pre-face]', { opacity: 1, duration: 0.5, ease: 'power2.out' }, 1.15)
  tl.to(state, {
    p: 100,
    duration: 1.5,
    ease: 'power1.inOut',
    onUpdate: () => { countEl.textContent = `${Math.round(state.p)}%` },
  }, 0)

  return Promise.all([
    new Promise((res) => tl.eventCallback('onComplete', res)),
    imgReady,
    document.fonts?.ready ?? Promise.resolve(),
  ]).then(() => new Promise((res) => {
    const out = gsap.timeline({ onComplete: () => { pre.remove(); res() } })
    out.to(countBlur, { attr: { stdDeviation: 40 }, duration: 0.5, ease: 'power2.in' }, 0)
    out.to(countEl, { opacity: 0, duration: 0.45, ease: 'power2.in' }, 0.05)
    out.to(pre.querySelector('.pre-tag'), { opacity: 0, duration: 0.3 }, 0)
    out.to(pre.querySelector('.pre-heart'), {
      scale: 0.92, transformOrigin: '50% 50%', duration: 0.4, ease: 'power2.in',
    }, 0.1)
    out.to(pre, {
      clipPath: 'inset(0% 0% 100% 0%)',
      duration: 0.9,
      ease: 'power4.inOut',
    }, 0.35)
  }))
}
