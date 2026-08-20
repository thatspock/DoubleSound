import { gsap } from 'gsap'

// Easter egg: clicking the stone heart drops Ika's head through the hero.
let busy = false

export function dropIka() {
  const head = document.querySelector('[data-ika]')
  if (!head || busy) return
  busy = true
  console.log('%cIKA ON THE DECKS', 'color:#f2a98a;background:#101010;padding:4px 10px;border-radius:10px;font-weight:bold')

  const tl = gsap.timeline({ onComplete: () => { busy = false } })
  tl.set(head, { visibility: 'visible', yPercent: 0, rotation: -18 })
  tl.fromTo(head,
    { top: '-60%' },
    { top: '30%', duration: 0.9, ease: 'bounce.out' })
  tl.to(head, { rotation: 10, duration: 0.9, ease: 'sine.inOut' }, 0.2)
  tl.to(head, { rotation: -6, duration: 0.8, ease: 'sine.inOut' }, '>-0.1')
  tl.to(head, { top: '130%', rotation: 24, duration: 0.7, ease: 'power2.in' }, '+=1.2')
  tl.set(head, { visibility: 'hidden', top: '-60%' })
}
