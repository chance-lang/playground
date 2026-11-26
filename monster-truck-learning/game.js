const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DIGITS = "0123456789".split("");
const WHEEL_IDS = ["wheel-br", "wheel-bl", "wheel-fr", "wheel-fl"];

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
const gameOver = document.querySelector("#gameover");
const againBtn = document.querySelector("#again");
const finalScore = document.querySelector("#finalScore");
const tireIcons = [...tiresEl.children];

const DIGIT_WORDS = {
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

function audioPath(value) {
  return `audio/${encodeURIComponent(String(value))}.mp3`;
}

function getClip(value) {
  const key = String(value);
  let clip = audioCache.get(key);
  if (!clip) {
    clip = new Audio(audioPath(key));
    clip.preload = "auto";
    audioCache.set(key, clip);
  }
  return clip;
}

function preloadAudio() {
  for (const value of [...DIGITS, ...LETTERS]) {
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
  if (Object.prototype.hasOwnProperty.call(DIGIT_WORDS, value)) {
    return DIGIT_WORDS[value];
  }
  if (/^[A-Z]$/i.test(value)) {
    return value.toUpperCase();
  }
  return String(value);
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

function nextRound() {
  const pool = Math.random() < 0.5 ? LETTERS : DIGITS;
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
    truckRig.removeEventListener("animationend", onEnd);
    window.clearTimeout(timer);
    finishJump();
  };
  const onEnd = (event) => {
    if (event.target !== truckRig || event.animationName !== "hop") return;
    settle();
  };
  const timer = window.setTimeout(settle, 1300);
  truckRig.addEventListener("animationend", onEnd);
}

const AXLE = {
  "wheel-br": ["rearWheel", "loose"],
  "wheel-bl": ["rearWheel", "gone"],
  "wheel-fr": ["frontWheel", "loose"],
  "wheel-fl": ["frontWheel", "gone"],
};

function dropWheel() {
  const index = 4 - wheelsLeft - 1;
  const [axleId, state] = AXLE[WHEEL_IDS[index]];
  const axle = document.getElementById(axleId);
  if (axle) {
    if (state === "gone") axle.classList.remove("loose");
    axle.classList.add(state);
  }
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
  for (const id of ["rearWheel", "frontWheel"]) {
    document.getElementById(id)?.classList.remove("gone", "loose");
  }
  for (const icon of tireIcons) icon.classList.remove("off");
  updateTiresLabel();
  gameOver.hidden = true;
  setLocked(false);
  nextRound();
}

startBtn.addEventListener("click", () => {
  startOverlay.hidden = true;
  replayBtn.disabled = false;
  preloadAudio();
  nextRound();
});

replayBtn.addEventListener("click", () => {
  if (!target || gameOver.hidden === false) return;
  speak(target);
});

againBtn.addEventListener("click", resetGame);

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

  svg.appendChild(body);
  svg.appendChild(rear.wheel);
  svg.appendChild(front.wheel);
  svg.id = "truck";
  svg.setAttribute("class", "truck");
  svg.setAttribute("aria-hidden", "true");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  mount.replaceChildren(document.importNode(svg, true));
  truck = document.querySelector("#truck");
}
