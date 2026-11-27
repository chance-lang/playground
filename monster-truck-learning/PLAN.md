# Monster Truck Letter Game

A static page with no build step. Every file for this game goes in `monster-truck-learning` (the folder already exists and is empty). Nothing for this project is written in the playground root. Open `monster-truck-learning/index.html` on a phone or in a narrow browser window.

## Layout

Portrait screen, `100dvh`, safe-area padding, no page scroll.

- **Top half:** sky, scrolling road, and an inline SVG monster truck. Score in the corner. Four tire icons show wheels left. A speaker button repeats the prompt.
- **Bottom half:** three large tap targets (the spoken item plus two distractors), shuffled each round. A short “Tap to start” overlay unlocks audio (mobile browsers block playback until a tap).

## Round rules

Each round is either digits `0–9` or letters `A–Z` (never mixed in one round). Pick one target, two different wrong choices, shuffle the three buttons, then play a clear pre-recorded clip from `audio/default/` (browser speech is only a fallback).

- **Correct:** score +1, ignore taps during the jump, play the ramp animation, then a new round while the truck returns to the drive loop. Wheels stay as they are.
- **Wrong:** detach one wheel and keep driving. A new prompt starts immediately. At 0 wheels, show the score and a Play again button that restores four wheels and resets the score.

## Truck animation

All CSS on one SVG, no image assets.

- **Driving:** road stripes scroll, body bobs, remaining wheels spin. Each lost wheel is hidden in order (back-right, back-left, front-right, front-left). The body tilts and sits lower as wheels disappear so it still looks like it is rolling.
- **Ramp:** a ramp slides in ahead of the truck, the truck follows a short arc up and down (about 1.2s), then the ramp leaves and the drive loop resumes.

## Prompt audio (`audio/default/`)

Pre-recorded MP3s for digits, teens, and letters. Browser `speechSynthesis` is fallback only. Voice packs live under `audio/<pack>/`; the game loads `audio/default/`.

## Game SFX (`audio/sfx/`)

Correct-answer feedback uses real clips (not WebAudio tones):

- `correct-rev.mp3` — Casper “Monster Truck Rev” (`engine-monster-rev`); playback capped at **1.2s**
- `correct-whoosh.mp3` — takeoff whoosh layered ~0.45s in, also ending by 1.2s
- `crash.mp3` — Casper “Heavy Car Crash” (`car-crash-heavy`); plays on barricade hit (~1.2s)

All game SFX use HTML `Audio` (same as letter clips) and are primed on Tap to start so mobile browsers allow them.

**How they were generated (keep new clips matching this):** Google Translate TTS, not a named Cloud TTS / WaveNet / Neural2 voice.

```
https://translate.googleapis.com/translate_tts?client=gtx&tl=en&q=<phrase>
```

- Language: generic English (`tl=en`) — Translate’s default “Listen” speaker.
- Digits/teens use spoken words (`zero`, `eleven`, …). Letters use the letter name (`A`, `B`, …).
- Sight words use the word as spoken (`and`, `little`, …). File for display `a` is `sight-a.mp3` so it doesn’t clash with letter `A.mp3`; `I` reuses letter `I.mp3`.
- Easy **Words** pool (`cat`, `dog`, …) uses the same `audio/default/<word>.mp3` naming; overlaps with sight words reuse the same clip.
- **2 Dice Addition** uses all faces `1+1` … `6+6` (36). Spoken as `N plus M` (`audio/default/N-plus-M.mp3`). UI shows dice + under the replay button; choices are the sum.
- **3 Dice Addition** uses all faces `1+1+1` … `6+6+6` (216). Spoken as `N plus M plus P` (`audio/default/N-plus-M-plus-P.mp3`). Same dice UI with a third die; choices are the sum.
- **3 Dice Subtraction** uses `A+B-C` where `A+B-C >= 0`. UI shows three dice as `A + B − C`. Spoken as the simplified `(A+B) minus C` (`audio/default/L-minus-C.mp3`); choices are the difference.
- **Z is Canadian:** phrase `zed` (file still `audio/default/Z.mp3`). TTS fallback in `game.js` also maps Z → `zed`.
- Download with a normal browser User-Agent; save as `audio/default/<key>.mp3`.

## Files

All of these live in `monster-truck-learning/`:

- `index.html` — viewport, scene, three buttons, overlays
- `styles.css` — mobile layout and truck/road/ramp keyframes
- `game.js` — rounds, scoring, wheel state, speech, animation lock
- `audio/default/` — Google Translate TTS MP3s (see above)
- `.nojekyll` — tells Pages to serve the folder as-is

## Hosting

GitHub Pages, free plan. The playground is already a git repo. Pages serves that repo, and this game stays in its subfolder.

- Link CSS and JS with relative paths (`styles.css`, `game.js`) so they load from `https://<user>.github.io/<repo>/monster-truck-learning/`.
- Turn on Pages from the `main` branch, root folder. The live game URL is `https://<user>.github.io/<repo>/monster-truck-learning/`.
- The free plan needs the repository to be public. HTTPS is included, which phones need before speech will play after the start tap.

Push and enable Pages as the last step, after the browser check. That needs a GitHub account already signed in for `gh`.

## Check in the browser

Serve `monster-truck-learning` and play a round: hear the prompt, tap the right choice (jump, score +1, new prompt), tap a wrong choice four times (one wheel each time, then game over and restart). Confirm the three choices stay tappable and the page does not scroll on a narrow viewport.
