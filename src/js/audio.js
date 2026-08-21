// Background track (spok) with an equalizer toggle in the nav.
// Browsers block autoplay, so playback starts on the first click.
// The toggle is the master switch for ALL site audio, UI crackles included.
import { setSfxEnabled } from './sfx.js'

export function initAudio() {
  const btn = document.querySelector('[data-sound]')
  if (!btn) return
  const track = new Audio('/assets/spok.m4a')
  track.loop = true
  track.volume = 0.85
  track.preload = 'none'

  btn.addEventListener('click', async () => {
    if (track.paused) {
      try {
        await track.play()
        btn.classList.add('is-on')
        setSfxEnabled(true)
      } catch { /* blocked — stays off */ }
    } else {
      track.pause()
      btn.classList.remove('is-on')
      setSfxEnabled(false)
    }
  })
}
