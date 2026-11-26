const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LOWER_LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const TEENS = ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"];
const WHEEL_IDS = ["wheel-br", "wheel-bl", "wheel-fr", "wheel-fl"];
const POOLS = {
  letters: LETTERS,
  lower: LOWER_LETTERS,
  digits: DIGITS,
  teens: TEENS,
};

const scoreEl = document.querySelector("#score");
const choicesEl = document.querySelector("#choices");
const promptEl = document.querySelector("#prompt");
const tiresEl = document.querySelector("#tires");
let truck = null;
const truckRig = document.querySelector("#truckRig");
const road = document.querySelector("#road");
const replayBtn = document.querySelector("#replay");
const startOverlay = document.querySelector("#start");
const startBtn = document.querySelector("#startBtn");
const poolToggles = [...document.querySelectorAll("input[data-pool]")];
const gameOver = document.querySelector("#gameover");
const againBtn = document.querySelector("#again");
const finalScore = document.querySelector("#finalScore");
const tireIcons = [...tiresEl.children];

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
  if (/^[a-z]$/.test(text)) return text.toUpperCase();
  return text;
}

function audioPath(value) {
  return `audio/${encodeURIComponent(audioKey(value))}.mp3`;
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

function preloadAudio() {
  for (const value of [...DIGITS, ...TEENS, ...LETTERS]) {
    getClip(value);
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
    button.textContent = value;
    button.addEventListener("click", () => onChoice(value, button));
    choicesEl.append(button);
  }
}

function poolEnabled(name) {
  return poolToggles.some((box) => box.dataset.pool === name && box.checked);
}

function activePools() {
  const pools = [];
  for (const [name, values] of Object.entries(POOLS)) {
    if (!poolEnabled(name)) continue;
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
  truckRig.classList.remove("driving");
  road.classList.remove("jumping");
  truckRig.classList.remove("jumping");
  void truckRig.offsetWidth;
  road.classList.add("jumping");
  truckRig.classList.add("jumping");

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timer);
    finishJump();
  };
  // Wait for the ramp to scroll fully off-screen before clearing the jump.
  const timer = window.setTimeout(settle, 1550);
}

function dropWheel() {
  const index = 4 - wheelsLeft - 1;
  document.getElementById(WHEEL_IDS[index])?.classList.add("gone");
  if (truck) {
    truck.classList.remove("lost-1", "lost-2", "lost-3", "lost-4");
    truck.classList.add(`lost-${index + 1}`);
  }
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
  dropWheel();

  if (wheelsLeft === 0) {
    window.setTimeout(showGameOver, 650);
    return;
  }

  window.setTimeout(() => {
    setLocked(false);
    nextRound();
  }, 650);
}

function resetGame() {
  score = 0;
  wheelsLeft = 4;
  scoreEl.textContent = "0";
  if (truck) truck.classList.remove("lost-1", "lost-2", "lost-3", "lost-4");
  for (const id of WHEEL_IDS) {
    document.getElementById(id)?.classList.remove("gone", "loose");
  }
  for (const icon of tireIcons) icon.classList.remove("off");
  updateTiresLabel();
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
  nextRound();
});

replayBtn.addEventListener("click", () => {
  if (!target || gameOver.hidden === false) return;
  speak(target);
});

againBtn.addEventListener("click", () => {
  if (!activePools().length) return;
  resetGame();
});

preloadAudio();
loadTruck();

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

async function loadTruck() {
  const mount = document.querySelector("#truckMount");
  const response = await fetch("trucks/demo-derby.svg");
  if (!response.ok) return;
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
  svg.appendChild(body);
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
