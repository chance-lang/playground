const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DIGITS = "0123456789".split("");
const WHEEL_IDS = ["wheel-br", "wheel-bl", "wheel-fr", "wheel-fl"];

const scoreEl = document.querySelector("#score");
const choicesEl = document.querySelector("#choices");
const promptEl = document.querySelector("#prompt");
const tiresEl = document.querySelector("#tires");
const truck = document.querySelector("#truck");
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

function dropWheel() {
  const index = 4 - wheelsLeft - 1;
  document.getElementById(WHEEL_IDS[index]).classList.add("gone");
  truck.classList.remove("lost-1", "lost-2", "lost-3", "lost-4");
  truck.classList.add(`lost-${index + 1}`);
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
  truck.classList.remove("lost-1", "lost-2", "lost-3", "lost-4");
  for (const id of WHEEL_IDS) {
    document.getElementById(id).classList.remove("gone");
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
