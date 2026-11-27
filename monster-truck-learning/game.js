const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LOWER_LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const TEENS = ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"];
const SIGHT_WORDS = [
  "a",
  "and",
  "away",
  "big",
  "blue",
  "can",
  "come",
  "down",
  "find",
  "for",
  "funny",
  "go",
  "help",
  "here",
  "I",
  "in",
  "is",
  "it",
  "jump",
  "little",
  "look",
  "make",
  "me",
  "my",
  "not",
  "one",
  "play",
  "red",
  "run",
  "said",
];
const WORDS = [
  "cat",
  "dog",
  "bat",
  "hat",
  "mat",
  "sat",
  "pig",
  "big",
  "dig",
  "sun",
  "run",
  "fun",
  "hop",
  "top",
  "pop",
  "bed",
  "red",
  "hen",
  "pen",
  "cup",
  "bug",
  "mug",
  "log",
  "fog",
  "man",
  "can",
  "pan",
  "fish",
  "duck",
  "ball",
];
const WHEEL_IDS = ["wheel-br", "wheel-bl", "wheel-fr", "wheel-fl"];
const POOLS = {
  letters: LETTERS,
  lower: LOWER_LETTERS,
  digits: DIGITS,
  teens: TEENS,
  sight: SIGHT_WORDS,
  words: WORDS,
};
// Sight-word "a" can't share letter A.mp3 on case-insensitive disks.
const AUDIO_ALIASES = {
  a: "sight-a",
};
// Freeze tire damage look for layout debugging: ?debugTires=0..4
const DEBUG_TIRES_RAW = new URLSearchParams(location.search).get("debugTires");
const DEBUG_TIRES_COUNT = (() => {
  if (DEBUG_TIRES_RAW == null || DEBUG_TIRES_RAW === "") return null;
  const n = Number(DEBUG_TIRES_RAW);
  if (!Number.isInteger(n) || n < 0 || n > 4) return null;
  return n;
})();

const scoreEl = document.querySelector("#score");
const choicesEl = document.querySelector("#choices");
const promptEl = document.querySelector("#prompt");
const tiresEl = document.querySelector("#tires");
let truck = null;
const truckRig = document.querySelector("#truckRig");
const road = document.querySelector("#road");
const arenaTrack = document.querySelector("#arenaTrack");
const crashFx = document.querySelector("#crashFx");
const barricade = document.querySelector(".barricade");
const replayBtn = document.querySelector("#replay");
const startOverlay = document.querySelector("#start");
const startBtn = document.querySelector("#startBtn");
const poolToggles = [...document.querySelectorAll("input[data-pool]")];
const gameOver = document.querySelector("#gameover");
const againBtn = document.querySelector("#again");
const finalScore = document.querySelector("#finalScore");
const tireIcons = [...tiresEl.children];
const ARENA_SCROLL_MS = 12000;
const WRECK_HOLD_MS = 3000;

const NUMBER_WORDS = {
  0: "zero",
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
  13: "thirteen",
  14: "fourteen",
  15: "fifteen",
  16: "sixteen",
  17: "seventeen",
  18: "eighteen",
  19: "nineteen",
  20: "twenty",
};

let score = 0;
let wheelsLeft = 4;
let target = "";
let locked = false;
let currentAudio = null;
const audioCache = new Map();
let sfxCtx = null;
const SFX = {
  correctRev: "audio/sfx/correct-rev.mp3",
  correctWhoosh: "audio/sfx/correct-whoosh.mp3",
  crash: "audio/sfx/crash.mp3",
};
const sfxCache = new Map();
let audioUnlocked = false;

function shuffle(items) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function audioKey(value) {
  const text = String(value);
  if (Object.prototype.hasOwnProperty.call(AUDIO_ALIASES, text)) {
    return AUDIO_ALIASES[text];
  }
  if (/^[a-z]$/.test(text)) return text.toUpperCase();
  return text;
}

function audioPath(value) {
  return `audio/default/${encodeURIComponent(audioKey(value))}.mp3`;
}

function getClip(value) {
  const key = audioKey(value);
  let clip = audioCache.get(key);
  if (!clip) {
    clip = new Audio(audioPath(value));
    clip.preload = "auto";
    audioCache.set(key, clip);
  }
  return clip;
}

function getSfx(path) {
  let clip = sfxCache.get(path);
  if (!clip) {
    clip = new Audio(path);
    clip.preload = "auto";
    sfxCache.set(path, clip);
  }
  return clip;
}

function playSfxFile(path, { volume = 1, whenMs = 0, durationMs = null } = {}) {
  const play = () => {
    // Fresh Audio() (not cloneNode) — iOS often refuses cloned elements.
    const clip = new Audio(path);
    clip.volume = volume;
    const result = clip.play();
    if (result && typeof result.catch === "function") result.catch(() => {});
    if (durationMs != null && durationMs > 0) {
      const fadeMs = Math.min(180, durationMs * 0.2);
      const fadeAt = Math.max(0, durationMs - fadeMs);
      window.setTimeout(() => {
        const steps = 6;
        let step = 0;
        const from = clip.volume;
        const tick = window.setInterval(() => {
          step += 1;
          clip.volume = Math.max(0, from * (1 - step / steps));
          if (step >= steps) {
            window.clearInterval(tick);
            clip.pause();
            clip.currentTime = 0;
          }
        }, Math.max(16, fadeMs / steps));
      }, fadeAt);
    }
  };
  if (whenMs > 0) window.setTimeout(play, whenMs);
  else play();
}

function preloadAudio() {
  for (const value of [...DIGITS, ...TEENS, ...LETTERS, ...SIGHT_WORDS, ...WORDS]) {
    getClip(value);
  }
  for (const path of Object.values(SFX)) getSfx(path);
}

function unlockAudio() {
  if (audioUnlocked) {
    ensureSfx();
    return;
  }
  audioUnlocked = true;
  const ctx = ensureSfx();
  // Silent Web Audio tick so later synthesized/scheduled tones are allowed.
  if (ctx) {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    if (ctx.state === "suspended") ctx.resume();
  }
  // Prime HTMLAudio SFX under the same user gesture as letter clips.
  for (const path of Object.values(SFX)) {
    const clip = getSfx(path);
    clip.muted = true;
    const primed = clip.play();
    if (primed && typeof primed.then === "function") {
      primed
        .then(() => {
          clip.pause();
          clip.currentTime = 0;
          clip.muted = false;
        })
        .catch(() => {
          clip.muted = false;
        });
    } else {
      clip.muted = false;
    }
  }
}

function stopSpeech() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function spokenPhrase(value) {
  const text = String(value);
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, text)) {
    return NUMBER_WORDS[text];
  }
  if (/^z$/i.test(text)) return "zed";
  if (/^[A-Z]$/i.test(text)) {
    return text.toUpperCase();
  }
  return text;
}

function speakFallback(value) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(spokenPhrase(value));
  utter.lang = "en-US";
  utter.rate = 0.72;
  utter.pitch = 1;
  utter.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((item) => /google us english|natural|neural|samantha|zira/i.test(item.name) && /^en/i.test(item.lang)) ||
    voices.find((item) => item.lang === "en-US") ||
    voices.find((item) => /^en/i.test(item.lang));
  if (preferred) utter.voice = preferred;
  window.speechSynthesis.speak(utter);
}

function speak(value) {
  stopSpeech();
  const clip = getClip(value);
  clip.volume = 1;
  currentAudio = clip;
  const play = clip.play();
  if (play && typeof play.catch === "function") {
    play.catch(() => {
      currentAudio = null;
      speakFallback(value);
    });
  }
}

function ensureSfx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sfxCtx) sfxCtx = new AC();
  if (sfxCtx.state === "suspended") sfxCtx.resume();
  return sfxCtx;
}

function playCorrectSfx() {
  // Real monster-truck engine rev + takeoff whoosh, capped at 1.2s.
  playSfxFile(SFX.correctRev, { volume: 0.95, durationMs: 1200 });
  playSfxFile(SFX.correctWhoosh, { volume: 0.55, whenMs: 450, durationMs: 750 });
}

function playCrashSfx() {
  // MP3 crash (same path as letter clips) — Web Audio alone is often silent on mobile.
  ensureSfx();
  playSfxFile(SFX.crash, { volume: 0.18, whenMs: 260, durationMs: 1200 });
}

function spawnCrashFx() {
  if (!crashFx) return;
  crashFx.classList.remove("boom-on");
  crashFx.replaceChildren();

  const boom = document.createElement("div");
  boom.className = "boom";
  const flash = document.createElement("div");
  flash.className = "flash";
  const ring = document.createElement("div");
  ring.className = "smoke-ring";
  crashFx.append(boom, flash, ring);

  const kinds = [
    "spring",
    "spring",
    "spring",
    "bolt",
    "bolt",
    "nut",
    "nut",
    "panel",
    "panel",
    "bolt",
  ];
  kinds.forEach((kind, i) => {
    const el = document.createElement("div");
    el.className = `debris ${kind}`;
    const angle = -110 + i * 22 + (i % 3) * 8;
    const dist = 90 + (i % 4) * 36 + (i % 2) * 20;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad) * dist;
    const dy = Math.sin(rad) * dist - 40 - (i % 3) * 18;
    const spin = (i % 2 === 0 ? 1 : -1) * (160 + i * 40);
    el.style.setProperty("--dx", `${dx}px`);
    el.style.setProperty("--dy", `${dy}px`);
    el.style.setProperty("--spin", `${spin}deg`);
    el.style.animationDuration = `${0.55 + (i % 4) * 0.12}s`;
    el.style.animationDelay = `${0.28 + (i % 5) * 0.02}s`;
    crashFx.append(el);
  });

  void crashFx.offsetWidth;
  crashFx.classList.add("boom-on");
  barricade?.classList.add("hit");
}

function setLocked(value) {
  locked = value;
  for (const button of choicesEl.querySelectorAll("button")) {
    button.disabled = value;
  }
}

function updateTiresLabel() {
  const noun = wheelsLeft === 1 ? "wheel" : "wheels";
  tiresEl.setAttribute("aria-label", `${wheelsLeft} ${noun} left`);
}

function renderChoices(choices) {
  choicesEl.replaceChildren();
  for (const value of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    if (String(value).length > 3) button.classList.add("wordy");
    button.textContent = value;
    button.addEventListener("click", () => onChoice(value, button));
    choicesEl.append(button);
  }
}

function poolEnabled(name) {
  return poolToggles.some((box) => box.dataset.pool === name && box.checked);
}

function activePools() {
  const enabled = {};
  for (const [name, values] of Object.entries(POOLS)) {
    if (!poolEnabled(name)) continue;
    enabled[name] = values;
  }

  const pools = [];
  // When both number ranges are on, mix 1-digit and 2-digit answers in one round.
  if (enabled.digits && enabled.teens) {
    const digits = enabled.digits.includes("0") ? enabled.digits : ["0", ...enabled.digits];
    pools.push([...digits, ...enabled.teens]);
    delete enabled.digits;
    delete enabled.teens;
  }

  for (const [name, values] of Object.entries(enabled)) {
    if (name === "digits") {
      pools.push(values.includes("0") ? values : ["0", ...values]);
    } else {
      pools.push(values);
    }
  }
  return pools;
}

function syncPoolToggles(source) {
  const name = source.dataset.pool;
  for (const box of poolToggles) {
    if (box.dataset.pool === name) box.checked = source.checked;
  }
  syncActionButtons();
}

function syncActionButtons() {
  const ready = activePools().length > 0;
  startBtn.disabled = !ready;
  againBtn.disabled = !ready;
}

function nextRound() {
  const pools = activePools();
  if (!pools.length) return;
  const pool = pools[Math.floor(Math.random() * pools.length)];
  const picked = shuffle(pool);
  target = picked[0];
  const choices = shuffle(picked.slice(0, 3));
  promptEl.textContent = target;
  renderChoices(choices);
  speak(target);
}

function finishJump() {
  truckRig.classList.remove("jumping");
  road.classList.remove("jumping");
  truckRig.classList.add("driving");
  setLocked(false);
  nextRound();
}

function playJump() {
  truckRig.classList.remove("driving", "jumping", "crashing");
  road.classList.remove("jumping", "crashing");
  void truckRig.offsetWidth;
  road.classList.add("jumping");
  truckRig.classList.add("jumping");
  playCorrectSfx();

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    finishJump();
  };
  // Wait for the synced hop + ramp exit before clearing the jump.
  const timer = window.setTimeout(settle, 1600);
}

function arenaScrollX() {
  if (!arenaTrack) return 0;
  const t = getComputedStyle(arenaTrack).transform;
  if (!t || t === "none") return 0;
  return new DOMMatrixReadOnly(t).m41;
}

function slowArenaToStop(durationMs = WRECK_HOLD_MS) {
  if (!arenaTrack) return;
  const x = arenaScrollX();
  const loopWidth = arenaTrack.scrollWidth / 2;
  const speed = loopWidth > 0 ? loopWidth / ARENA_SCROLL_MS : 0;
  // Ease-out coasts about half the distance full speed would cover.
  const coast = speed * durationMs * 0.5;
  arenaTrack.style.animation = "none";
  arenaTrack.style.transition = "none";
  arenaTrack.style.transform = `translateX(${x}px)`;
  void arenaTrack.offsetWidth;
  arenaTrack.style.transition = `transform ${durationMs}ms cubic-bezier(0.05, 0.85, 0.2, 1)`;
  arenaTrack.style.transform = `translateX(${x - coast}px)`;
}

function resumeArenaScroll() {
  if (!arenaTrack) return;
  arenaTrack.style.transition = "none";
  arenaTrack.style.transform = "";
  arenaTrack.style.animation = "";
  void arenaTrack.offsetWidth;
}

function finishCrash() {
  truckRig.classList.remove("crashing");
  road.classList.remove("crashing");
  clearCrashFx();
  truckRig.classList.add("driving");
  if (wheelsLeft === 0) {
    truckRig.classList.remove("dragging");
    truckRig.classList.add("wrecked", "front-fire");
    slowArenaToStop(WRECK_HOLD_MS);
    window.setTimeout(showGameOver, WRECK_HOLD_MS);
    return;
  }
  setLocked(false);
  nextRound();
}

function clearCrashFx() {
  crashFx?.classList.remove("boom-on");
  crashFx?.replaceChildren();
  barricade?.classList.remove("hit");
}

function playCrash() {
  truckRig.classList.remove("driving", "jumping", "crashing");
  road.classList.remove("jumping", "crashing");
  clearCrashFx();
  void truckRig.offsetWidth;
  road.classList.add("crashing");
  truckRig.classList.add("crashing");
  playCrashSfx();
  spawnCrashFx();

  const dropIndex = 4 - wheelsLeft - 1;
  // Kick fire on just before each tire falls off.
  if (dropIndex === 0) {
    window.setTimeout(() => {
      truckRig.classList.remove("fire-in-small");
      void truckRig.offsetWidth;
      truckRig.classList.add("limping", "fire-in-small");
    }, 220);
  } else if (dropIndex === 1) {
    window.setTimeout(() => {
      truckRig.classList.remove("fire-in-large");
      void truckRig.offsetWidth;
      truckRig.classList.add("dragging", "fire-in-large");
    }, 220);
  } else if (dropIndex === 2) {
    window.setTimeout(() => {
      truckRig.classList.remove("fire-in-front");
      void truckRig.offsetWidth;
      truckRig.classList.add("front-fire", "fire-in-front");
    }, 220);
  } else if (dropIndex === 3) {
    window.setTimeout(() => {
      truckRig.classList.remove("dragging", "fire-in-front-large");
      void truckRig.offsetWidth;
      truckRig.classList.add("wrecked", "front-fire", "fire-in-front-large");
    }, 220);
  }

  window.setTimeout(dropWheel, 380);

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    finishCrash();
  };
  const timer = window.setTimeout(settle, 1450);
}

function dropWheel() {
  const index = 4 - wheelsLeft - 1;
  document.getElementById(WHEEL_IDS[index])?.classList.add("gone");
  // Small rear → large rear + hood → front small → undrag + front large.
  truckRig.classList.add("limping");
  truckRig.classList.toggle("dragging", index >= 1 && index < 3);
  truckRig.classList.toggle("front-fire", index >= 2);
  truckRig.classList.toggle("wrecked", index >= 3);
  if (index > 0) truckRig.classList.remove("fire-in-small");
  if (index > 1) truckRig.classList.remove("fire-in-large");
  if (index > 2) truckRig.classList.remove("fire-in-front");
  if (index > 3) truckRig.classList.remove("fire-in-front-large");
  tireIcons[index].classList.add("off");
  updateTiresLabel();
}

function showGameOver() {
  finalScore.textContent = String(score);
  gameOver.hidden = false;
}

function onChoice(value, button) {
  if (locked || gameOver.hidden === false) return;

  if (value === target) {
    setLocked(true);
    button.classList.add("right");
    score += 1;
    scoreEl.textContent = String(score);
    scoreEl.classList.remove("pop");
    void scoreEl.offsetWidth;
    scoreEl.classList.add("pop");
    playJump();
    return;
  }

  setLocked(true);
  button.classList.add("wrong");
  wheelsLeft -= 1;
  playCrash();
}

function resetGame() {
  score = 0;
  wheelsLeft = 4;
  scoreEl.textContent = "0";
  truckRig.classList.remove(
    "dragging",
    "limping",
    "front-fire",
    "wrecked",
    "fire-in-small",
    "fire-in-large",
    "fire-in-front",
    "fire-in-front-large"
  );
  for (const id of WHEEL_IDS) {
    document.getElementById(id)?.classList.remove("gone", "loose");
  }
  for (const icon of tireIcons) icon.classList.remove("off");
  updateTiresLabel();
  resumeArenaScroll();
  clearCrashFx();
  gameOver.hidden = true;
  setLocked(false);
  nextRound();
}

for (const box of poolToggles) {
  box.addEventListener("change", () => syncPoolToggles(box));
}
syncActionButtons();

startBtn.addEventListener("click", () => {
  if (!activePools().length) return;
  startOverlay.hidden = true;
  replayBtn.disabled = false;
  preloadAudio();
  unlockAudio();
  nextRound();
});

replayBtn.addEventListener("click", () => {
  if (!target || gameOver.hidden === false) return;
  speak(target);
});

againBtn.addEventListener("click", () => {
  if (!activePools().length) return;
  unlockAudio();
  resetGame();
});

function applyDebugTires() {
  if (DEBUG_TIRES_COUNT == null) return;
  wheelsLeft = DEBUG_TIRES_COUNT;
  const gone = 4 - wheelsLeft;
  startOverlay.hidden = true;
  gameOver.hidden = true;
  replayBtn.disabled = true;

  truckRig.classList.remove(
    "crashing",
    "jumping",
    "dragging",
    "limping",
    "front-fire",
    "wrecked",
    "fire-in-small",
    "fire-in-large",
    "fire-in-front",
    "fire-in-front-large"
  );
  truckRig.classList.add("driving");

  for (let i = 0; i < WHEEL_IDS.length; i += 1) {
    const lost = i < gone;
    document.getElementById(WHEEL_IDS[i])?.classList.toggle("gone", lost);
    tireIcons[i].classList.toggle("off", lost);
  }

  if (gone >= 1) truckRig.classList.add("limping");
  if (gone >= 2 && gone <= 3) truckRig.classList.add("dragging");
  if (gone >= 3) truckRig.classList.add("front-fire");
  if (gone >= 4) truckRig.classList.add("wrecked");

  updateTiresLabel();
  setLocked(true);
}

preloadAudio();
loadTruck().then(applyDebugTires);

const SVG_NS = "http://www.w3.org/2000/svg";
const REAR_HUB = { x: 359, y: 558, r: 178 };
const FRONT_HUB = { x: 1034, y: 559, r: 178 };

function pathStats(d) {
  const nums = d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!nums || nums.length < 4) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i]);
    const y = Number(nums[i + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    sx += x;
    sy += y;
    n += 1;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!n) return null;
  return { x: sx / n, y: sy / n, w: maxX - minX, h: maxY - minY };
}

function nearHub(stats, hub) {
  if (stats.w > 380 || stats.h > 380) return false;
  const dx = stats.x - hub.x;
  const dy = stats.y - hub.y;
  return dx * dx + dy * dy < hub.r * hub.r;
}

function cutTireHoles(svg, path) {
  const defs = svg.querySelector("defs") || svg.insertBefore(
    document.createElementNS(SVG_NS, "defs"),
    svg.firstChild
  );
  const mask = document.createElementNS(SVG_NS, "mask");
  mask.id = "tireHoles";
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("width", "1376");
  rect.setAttribute("height", "768");
  rect.setAttribute("fill", "white");
  mask.appendChild(rect);
  for (const hub of [REAR_HUB, FRONT_HUB]) {
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", String(hub.x));
    circle.setAttribute("cy", String(hub.y));
    circle.setAttribute("r", "172");
    circle.setAttribute("fill", "black");
    mask.appendChild(circle);
  }
  defs.appendChild(mask);
  path.setAttribute("mask", "url(#tireHoles)");
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h / 6, s, l };
}

function hslToHex(h, s, l) {
  const hue = ((h % 1) + 1) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const byte = (value) => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, "0");
  return `#${byte(channel(hue + 1 / 3))}${byte(channel(hue))}${byte(channel(hue - 1 / 3))}`;
}

function tintColor(hex, hue) {
  const { s, l } = hexToHsl(hex);
  let sat = s;
  let light = l;
  if (l < 0.22) {
    sat = 0.7;
    light = 0.32 + l * 0.35;
  } else if (s < 0.2) {
    sat = 0.55;
  } else {
    sat = Math.min(0.92, Math.max(s, 0.6));
  }
  return hslToHex(hue, sat, light);
}

function recolorPaint(value, hue, prefix, svg, grads) {
  if (!value) return value;
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return tintColor(value, hue);
  const match = value.match(/^url\(#([^)]+)\)$/);
  if (!match) return value;
  const nextId = `${prefix}-${match[1]}`;
  if (!grads.has(match[1])) {
    const original = svg.querySelector(`[id="${match[1]}"]`);
    if (original) {
      const clone = original.cloneNode(true);
      clone.id = nextId;
      for (const stop of clone.querySelectorAll("stop")) {
        const color = stop.getAttribute("stop-color");
        if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
          stop.setAttribute("stop-color", tintColor(color, hue));
        }
      }
      original.parentNode.appendChild(clone);
    }
    grads.set(match[1], nextId);
  }
  return `url(#${nextId})`;
}

function recolorWheel(svg, wheel, prefix, hue) {
  const grads = new Map();
  for (const el of wheel.querySelectorAll("[fill], [stroke]")) {
    for (const attr of ["fill", "stroke"]) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      el.setAttribute(attr, recolorPaint(value, hue, prefix, svg, grads));
    }
  }
}

function mountCopy(svg, source, id, hue, dx, dy) {
  const copy = source.cloneNode(true);
  copy.id = id;
  recolorWheel(svg, copy, id, hue);
  const slot = document.createElementNS(SVG_NS, "g");
  slot.setAttribute("transform", `translate(${dx} ${dy})`);
  slot.appendChild(copy);
  return slot;
}

function makeWheel(id) {
  const wheel = document.createElementNS(SVG_NS, "g");
  wheel.id = id;
  wheel.setAttribute("class", "wheel");
  const spin = document.createElementNS(SVG_NS, "g");
  spin.setAttribute("class", "spin");
  wheel.appendChild(spin);
  return { wheel, spin };
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

function makeFxArt(className, artClass, href, size, x, y) {
  const root = svgEl("g", { class: className });
  const art = svgEl("image", {
    class: artClass,
    x: String(x),
    y: String(y),
    width: String(size),
    height: String(size),
    preserveAspectRatio: "xMidYMid meet",
  });
  art.setAttributeNS("http://www.w3.org/1999/xlink", "href", href);
  art.setAttribute("href", href);
  root.appendChild(art);
  return root;
}

function makeHubFires() {
  const layer = svgEl("g", { class: "hub-fires" });
  // Smaller burst for the first missing rear tire (3 left).
  const small = 360;
  layer.appendChild(
    makeFxArt(
      "hub-fire hub-fire-small",
      "hub-fire-art",
      "img/hub-fire-small.png",
      small,
      REAR_HUB.x - small + 40,
      REAR_HUB.y - small + 110
    )
  );
  // Larger burst replaces small at 2 tires.
  const large = 560;
  layer.appendChild(
    makeFxArt(
      "hub-fire hub-fire-large",
      "hub-fire-art",
      "img/hub-fire.png",
      large,
      REAR_HUB.x - large + 60,
      REAR_HUB.y - large + 20
    )
  );
  // Small front hub fire once a front tire is gone (1 left).
  const front = 320;
  layer.appendChild(
    makeFxArt(
      "hub-fire hub-fire-front",
      "hub-fire-art",
      "img/hub-fire-small.png",
      front,
      FRONT_HUB.x - front + 40,
      FRONT_HUB.y - front + 110
    )
  );
  // Large front fire when the last tire is gone.
  const frontLarge = 520;
  layer.appendChild(
    makeFxArt(
      "hub-fire hub-fire-front-large",
      "hub-fire-art",
      "img/hub-fire.png",
      frontLarge,
      FRONT_HUB.x - frontLarge + 80,
      FRONT_HUB.y - frontLarge + 40
    )
  );
  return layer;
}

function makeHoodSmoke() {
  // Drawn behind the body so steam rises from under/behind the hood.
  const layer = svgEl("g", { class: "hood-smokes" });
  const hood = 280;
  layer.appendChild(
    makeFxArt(
      "hood-smoke hood-smoke-light",
      "hood-smoke-art",
      "img/hood-smoke.png",
      hood,
      800,
      20
    )
  );
  const hoodHeavy = 420;
  layer.appendChild(
    makeFxArt(
      "hood-smoke hood-smoke-heavy",
      "hood-smoke-art",
      "img/hood-smoke-heavy.png",
      hoodHeavy,
      720,
      -40
    )
  );
  return layer;
}

async function loadTruck() {
  const mount = document.querySelector("#truckMount");
  const response = await fetch("trucks/demo-derby.svg");
  if (!response.ok) return undefined;
  const doc = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.tagName.toLowerCase() !== "svg") return;

  const rear = makeWheel("rearWheel");
  const front = makeWheel("frontWheel");
  const body = document.createElementNS(SVG_NS, "g");
  body.setAttribute("class", "body-float");

  for (const path of [...svg.querySelectorAll("path")]) {
    if (path.closest("defs")) continue;
    const stats = pathStats(path.getAttribute("d") || "");
    if (stats && nearHub(stats, REAR_HUB)) rear.spin.appendChild(path);
    else if (stats && nearHub(stats, FRONT_HUB)) front.spin.appendChild(path);
    else body.appendChild(path);
  }

  for (const path of body.querySelectorAll("path")) {
    if (path.getAttribute("fill") === "#161625") cutTireHoles(svg, path);
  }

  const rearLeft = mountCopy(svg, rear.wheel, "wheel-br", 210 / 360, -50, -12);
  const frontLeft = mountCopy(svg, front.wheel, "wheel-fr", 132 / 360, -50, -12);
  rear.wheel.id = "wheel-bl";
  front.wheel.id = "wheel-fl";
  const rearNear = document.createElementNS(SVG_NS, "g");
  rearNear.setAttribute("transform", "translate(10 0)");
  rearNear.appendChild(rear.wheel);
  const frontNear = document.createElementNS(SVG_NS, "g");
  frontNear.setAttribute("transform", "translate(10 0)");
  frontNear.appendChild(front.wheel);
  svg.appendChild(rearLeft);
  svg.appendChild(frontLeft);
  // Hood steam sits behind the body.
  svg.appendChild(makeHoodSmoke());
  svg.appendChild(body);
  // Hub fire sits behind the near-side tires.
  svg.appendChild(makeHubFires());
  svg.appendChild(rearNear);
  svg.appendChild(frontNear);
  svg.id = "truck";
  svg.setAttribute("class", "truck");
  svg.setAttribute("aria-hidden", "true");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  mount.replaceChildren(document.importNode(svg, true));
  truck = document.querySelector("#truck");
}
