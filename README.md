# Double Sound² × K-30

My friends' crew, Double Sound², turned sixteen and threw one night at K-30 in Saint Petersburg. I made them a site. It got out of hand.

**Live:** [doublesound.live](https://doublesound.live) · 28.08, doors 23:00

## The fun parts

- **The hero hides a video.** Move the cursor and a gooey trail tears the page open to a looping clip underneath. Canvas 2D, no WebGL: a low-res trail buffer gets a heavy blur, then a hard alpha threshold snaps the blob field into metaball edges. Safari has no canvas SVG filters, so it falls back to stacking the alpha until the edge hardens.
- **The lineup is a drum machine.** Each artist row is a Web Audio voice: kick, bass, clap, hat, acid pluck. Synthesized from oscillators and noise, no samples, all tuned around A minor so sweeping across the names stays musical. On a phone a second finger turns taps into chords, and the empty air between the rows plays wind.
- **Scroll stays silent.** Rows sliding under a parked cursor fire `mouseenter`, and a touch scroll starts with `pointerdown`. Both get filtered out, otherwise the page would honk at you while you scroll.
- **iOS ringer switch.** The switch mutes Web Audio but not media playback, so a looping silent `<audio>` flips the session over and the drums survive a muted phone.
- **The preloader tells a small lie.** The percent counter is theater. The gate is real though: it holds until the fonts and the hero image are actually in.
- There are easter eggs. The console knows about one of them.

## Stack

Vite, vanilla JS, one CSS file. GSAP for animation, Lenis for smooth scroll, Inter Tight self-hosted. No framework, it's a poster, not an app.

## Run

```sh
npm install
npm run dev
```

`npm run build` outputs to `dist/`. Deployed on Vercel, pushes to `main` go live.

Analytics: production builds load GA4 after `window.load` so it never competes with the site itself. Dev builds ship no tracking code at all, and `VITE_GA_ID` overrides the measurement id at build time.

## Performance

The fluid loop runs full-canvas blurs and `getImageData` readbacks, so it sleeps whenever the hero is off screen. The hidden video starts downloading only after `window.load`, the hero image is preloaded from the HTML, and static assets ship with year-long immutable cache headers (files get renamed when they change).

## License

MIT for the code. The artwork, the stone heart, the video loop and the music belong to Double Sound², those are not up for reuse.
