// Cursor pill that marks the hidden clickable hearts — the classic
// easter-egg affordance: a label chases the cursor only while it is
// over the secret hotspot, so curiosity does the rest.
let el = null

function ensure() {
  if (!el) {
    el = document.createElement('div')
    el.className = 'cursor-hint p1'
    el.textContent = 'click'
    document.body.appendChild(el)
    // scrolling moves the hotspot out from under a resting cursor
    window.addEventListener('scroll', hideHint, { passive: true })
  }
  return el
}

export function moveHint(x, y) {
  const n = ensure()
  n.style.left = `${x}px`
  n.style.top = `${y}px`
}

export function showHint() {
  ensure().classList.add('is-on')
}

export function hideHint() {
  el?.classList.remove('is-on')
}
