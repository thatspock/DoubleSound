import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// bleibtgleich-style gooey text reveal: per-element SVG filter,
// feGaussianBlur stdDeviation animates 50 -> 0 while alpha is
// re-contrasted by feColorMatrix, so type condenses out of a blob.

const SVG_NS = 'http://www.w3.org/2000/svg'
let defsSvg = null
let count = 0

function ensureDefs() {
  if (defsSvg) return defsSvg
  defsSvg = document.createElementNS(SVG_NS, 'svg')
  defsSvg.setAttribute('aria-hidden', 'true')
  defsSvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
  document.body.appendChild(defsSvg)
  return defsSvg
}

export function attachGoo(el, initial = 50) {
  const svg = ensureDefs()
  const id = `goo-${++count}`
  const filter = document.createElementNS(SVG_NS, 'filter')
  filter.setAttribute('id', id)
  filter.setAttribute('x', '-60%')
  filter.setAttribute('y', '-60%')
  filter.setAttribute('width', '220%')
  filter.setAttribute('height', '220%')
  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur')
  blur.setAttribute('in', 'SourceGraphic')
  blur.setAttribute('stdDeviation', String(initial))
  blur.setAttribute('result', 'blur')
  const cm = document.createElementNS(SVG_NS, 'feColorMatrix')
  cm.setAttribute('in', 'blur')
  cm.setAttribute('mode', 'matrix')
  cm.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8')
  filter.appendChild(blur)
  filter.appendChild(cm)
  svg.appendChild(filter)
  el.style.filter = `url(#${id})`
  return blur
}

export function gooRevealTween(el, opts = {}) {
  const blur = attachGoo(el, 50)
  gsap.set(el, { visibility: 'visible', opacity: 0 })
  const tl = gsap.timeline({ paused: true })
  tl.to(el, { opacity: 1, duration: 0.35, ease: 'none' }, 0)
  tl.to(blur, { attr: { stdDeviation: 0 }, duration: opts.duration ?? 1.1, ease: 'power3.out' }, 0)
  tl.eventCallback('onComplete', () => { el.style.filter = 'none' })
  return tl
}

const tracked = []

export function initGooReveals(scope = document) {
  const els = scope.querySelectorAll('[data-goo]')
  els.forEach((el) => {
    const tl = gooRevealTween(el)
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => tl.play(),
    })
    tracked.push({ st, tl })
  })
}

// Two cases the 88% line can't serve: (a) triggers at the very bottom of
// the page that can never be crossed (the closing wordmark), and (b)
// elements already partly visible on load, sitting below the line — they
// must not wait for a scroll. Play both outright once layout is final.
export function playUnreachableGoo() {
  const max = ScrollTrigger.maxScroll(window)
  tracked.forEach(({ st, tl }) => {
    const r = st.trigger.getBoundingClientRect()
    const visibleNow = r.top < window.innerHeight && r.bottom > 0
    if (st.start > max - 48 || visibleNow) { tl.play(); st.kill() }
  })
}

// instant reveal for elements already in the first viewport (post-preloader)
export function playVisibleGoo() {
  ScrollTrigger.refresh()
}
