/* ===== Word Jungle – Shuffle & Guess ===== */

const WORDS = ["WILL", "YOU", "BE", "MY", "VALENTINE"];
const PHRASE = "Will you be my Valentine? 🥺";
const TILE_COUNT = 12; // fixed number of letter tiles shown every round

const HINTS = {
  WILL:      "A document read after someone is gone",
  YOU:       "The 7th vowel pair in the English alphabet reversed",
  BE:       "A striped insect minus its tail",
  MY:        "The 13th and 25th letters standing together",
  VALENTINE: "A patron saint once imprisoned in Rome, 3rd century",
};

/* --- DOM refs --- */
const $ = (id) => document.getElementById(id);
const boxesEl   = $("boxes");
const tilesEl   = $("tiles");
const statusEl  = $("status");
const wordListEl = $("wordList");
const foundEl   = $("foundCount");
const hintEl    = $("currentHint");

/* --- State --- */
const state = {
  found: new Set(),
  activeIdx: 0,
  filled: [],        // letters placed in boxes so far
  pool: [],          // { letter, id, used } — the shuffled tile pool
  nextId: 0,
};

/* ===== Helpers ===== */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomLetter() {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
}

function activeWord() {
  return WORDS[state.activeIdx] ?? null;
}

/* ===== Pool generation ===== */

function buildPool(word) {
  const letters = word.split("");
  // Pad with random letters so every word has the same number of tiles
  while (letters.length < TILE_COUNT) letters.push(randomLetter());
  const shuffled = shuffle(letters);
  state.pool = shuffled.map((ch) => ({ letter: ch, id: state.nextId++, used: false }));
  state.filled = [];
}

/* ===== Rendering ===== */

function renderBoxes() {
  const word = activeWord();
  if (!word) { boxesEl.innerHTML = ""; return; }

  boxesEl.innerHTML = "";
  for (let i = 0; i < word.length; i++) {
    const div = document.createElement("div");
    div.className = "box";
    const ch = state.filled[i]?.letter ?? "";
    if (ch) {
      div.classList.add("filled");
      div.textContent = ch;
    }
    boxesEl.appendChild(div);
  }
}

function renderTiles() {
  tilesEl.innerHTML = "";
  for (const item of state.pool) {
    const div = document.createElement("div");
    div.className = "tile" + (item.used ? " used" : "");
    div.textContent = item.letter;
    div.dataset.id = item.id;
    if (!item.used) {
      div.addEventListener("click", () => tapTile(item.id));
    }
    tilesEl.appendChild(div);
  }
}

function renderWordList() {
  wordListEl.innerHTML = "";
  WORDS.forEach((word, i) => {
    const li = document.createElement("li");
    li.className = "wordItem"
      + (i === state.activeIdx && !state.found.has(word) ? " active" : "")
      + (state.found.has(word) ? " found" : "");

    const name = document.createElement("span");
    // Hide the word — show blanks unless found
    name.textContent = state.found.has(word) ? word : "_ ".repeat(word.length).trim();

    const badge = document.createElement("span");
    badge.className = "wordBadge";
    badge.textContent = state.found.has(word) ? "Found ✓" : `${word.length} letters`;

    li.appendChild(name);
    li.appendChild(badge);
    if (!state.found.has(word)) {
      li.addEventListener("click", () => switchWord(i));
    }
    wordListEl.appendChild(li);
  });
}

function renderStats() {
  foundEl.textContent = `${state.found.size} / ${WORDS.length}`;
  const word = activeWord();
  if (state.found.size === WORDS.length && !revealedByGiveUp) {
    hintEl.textContent = "All done!";
    showReveal(true);
  } else if (word) {
    hintEl.textContent = HINTS[word] ?? "???";
  } else {
    hintEl.textContent = "—";
  }
}

function setStatus(msg, tone = "") {
  statusEl.textContent = msg;
  statusEl.className = "status" + (tone ? ` ${tone}` : "");
}

function render() {
  renderBoxes();
  renderTiles();
  renderWordList();
  renderStats();
}

/* ===== Game actions ===== */

function tapTile(id) {
  const word = activeWord();
  if (!word) return;
  if (state.filled.length >= word.length) return;

  const item = state.pool.find((p) => p.id === id);
  if (!item || item.used) return;

  item.used = true;
  state.filled.push(item);
  setStatus("");
  renderBoxes();
  renderTiles();

  // Auto-check when all boxes are filled
  if (state.filled.length === word.length) {
    checkAnswer();
  }
}

function checkAnswer() {
  const word = activeWord();
  const guess = state.filled.map((f) => f.letter).join("");

  if (guess === word) {
    state.found.add(word);
    setStatus("Correct!", "good");
    boxesEl.classList.add("win");

    setTimeout(() => {
      boxesEl.classList.remove("win");
      if (state.found.size < WORDS.length) {
        pickNextUnfound();
        buildPool(activeWord());
        setStatus("");
      }
      render();
    }, 900);
  } else {
    setStatus("Wrong! Try again.", "bad");
    shakeBoxes();
    // Return all letters after shake
    setTimeout(() => {
      clearFilled();
      render();
    }, 900);
  }
}

function shakeBoxes() {
  boxesEl.classList.remove("shake");
  void boxesEl.offsetWidth;
  boxesEl.classList.add("shake");
}

function undo() {
  if (state.filled.length === 0) return;
  const last = state.filled.pop();
  const item = state.pool.find((p) => p.id === last.id);
  if (item) item.used = false;
  setStatus("");
  renderBoxes();
  renderTiles();
}

function clearFilled() {
  for (const f of state.filled) {
    const item = state.pool.find((p) => p.id === f.id);
    if (item) item.used = false;
  }
  state.filled = [];
  setStatus("");
}

function clearAction() {
  clearFilled();
  render();
}

function switchWord(idx) {
  if (idx < 0 || idx >= WORDS.length) return;
  if (state.found.has(WORDS[idx])) return;
  state.activeIdx = idx;
  buildPool(activeWord());
  setStatus("");
  render();
}

function skipWord() {
  // Find next unfound word after current index
  for (let i = 1; i <= WORDS.length; i++) {
    const idx = (state.activeIdx + i) % WORDS.length;
    if (!state.found.has(WORDS[idx])) {
      switchWord(idx);
      return;
    }
  }
}

function pickNextUnfound() {
  const idx = WORDS.findIndex((w) => !state.found.has(w));
  state.activeIdx = idx === -1 ? 0 : idx;
}

let noCount = 0;
let revealedByGiveUp = false;  // track whether they gave up or completed all words

function giveUp() {
  revealedByGiveUp = true;

  // Reveal all unfound words in the word list
  for (const word of WORDS) {
    state.found.add(word);
  }
  render();

  // After a short delay, show the Valentine question
  setTimeout(() => {
    showReveal(false);
  }, 4000);
}

function showReveal(won) {
  noCount = 0;
  if (won) revealedByGiveUp = false;  // completed all words
  const overlay = $("overlay");
  const phraseEl = $("revealPhrase");
  phraseEl.textContent = PHRASE;
  overlay.classList.add("visible");
  if (won) {
    overlay.classList.add("won");
  } else {
    overlay.classList.remove("won");
  }
  // Show Yes/No, hide Play Again
  $("revealActions").style.display = "flex";
  $("playAgainBtn").style.display = "none";
  // Remove any previous sub-text
  const oldSub = overlay.querySelector(".revealSub");
  if (oldSub) oldSub.remove();
}

function handleYes() {
  const phraseEl = $("revealPhrase");
  phraseEl.innerHTML = '<span class="phraseText">Yayyy!</span> 🥰🥳🎉';
  $("overlay").classList.add("won");
  $("revealActions").style.display = "none";
  $("nextBtn").style.display = "inline-block";
  spawnHearts();
  saveAnswer("YES", noCount, !revealedByGiveUp);
}

function handleNo() {
  noCount++;
  const phraseEl = $("revealPhrase");

  if (noCount >= 3) {
    phraseEl.textContent = "Oki... goodbyeee 😭💔";
    $("revealActions").style.display = "none";
    saveAnswer("NO (x" + noCount + ") — closed tab 💔", noCount, !revealedByGiveUp);
    setTimeout(() => {
      window.open("about:blank", "_self");
      window.close();
    }, 1500);
  } else if (noCount === 2) {
    phraseEl.textContent = "Will you be my Valentine? Pleaseee 😭🙏";
  } else {
    phraseEl.textContent = "Will you be my Valentine? Please 🥺🙏";
  }
}

function goToMessage() {
  const params = playerDocId ? `?pid=${playerDocId}` : "";
  window.location.href = "message.html" + params;
}

/* ===== Floating hearts effect ===== */

const HEART_EMOJIS = ["💕", "💖", "💗", "💓", "❤️", "🩷", "💘", "💝", "🥰", "😍"];

function spawnHearts() {
  const container = $("heartsContainer");
  container.innerHTML = "";

  let count = 0;
  const total = 35;

  function addHeart() {
    if (count >= total) return;
    count++;
    const heart = document.createElement("div");
    heart.className = "floatingHeart";
    heart.textContent = HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)];
    heart.style.left = Math.random() * 100 + "%";
    heart.style.setProperty("--duration", (3 + Math.random() * 3) + "s");
    heart.style.setProperty("--rot", (Math.random() * 60 - 30) + "deg");
    heart.style.fontSize = (20 + Math.random() * 24) + "px";
    heart.addEventListener("animationend", () => heart.remove());
    container.appendChild(heart);
    setTimeout(addHeart, 120 + Math.random() * 200);
  }

  addHeart();
}

/* ===== Keyboard support ===== */

window.addEventListener("keydown", (e) => {
  // Don't hijack keys when typing in an input field
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  if (e.key === "Backspace") { e.preventDefault(); undo(); return; }
  if (e.key === "Escape") { clearAction(); return; }

  const upper = e.key.toUpperCase();
  if (upper.length === 1 && upper >= "A" && upper <= "Z") {
    // Find first unused tile matching this letter
    const item = state.pool.find((p) => !p.used && p.letter === upper);
    if (item) tapTile(item.id);
  }
});

/* ===== Event binding ===== */

$("undoBtn").addEventListener("click", undo);
$("clearBtn").addEventListener("click", clearAction);
$("skipBtn").addEventListener("click", skipWord);
$("giveUpBtn").addEventListener("click", giveUp);
$("yesBtn").addEventListener("click", handleYes);
$("noBtn").addEventListener("click", handleNo);
$("nextBtn").addEventListener("click", goToMessage);

/* ===== Start ===== */

// Don't start game until nickname is entered
const nicknameOverlay = $("nicknameOverlay");
const nicknameInput   = $("nicknameInput");
const nicknameBtn     = $("nicknameBtn");
const nicknameError   = $("nicknameError");
const gameWrap        = $("gameWrap");

let playerNickname = "";
let playerDocId = null;   // Firestore doc id so we can update it later

async function waitForFirebase() {
  if (window.__firebaseReady) return window.__firebase;
  return new Promise((resolve) => {
    window.addEventListener("firebaseReady", () => resolve(window.__firebase), { once: true });
  });
}

async function saveNickname(name) {
  try {
    const fb = await waitForFirebase();
    const uid = fb.auth.currentUser ? fb.auth.currentUser.uid : null;
    console.log("Firebase ready, saving nickname:", name, "UID:", uid);
    const docRef = await fb.addDoc(fb.collection(fb.db, "players"), {
      nickname: name,
      uid: uid,
      joinedAt: fb.serverTimestamp(),
      answer: "pending",
    });
    playerDocId = docRef.id;
    console.log("Nickname saved to Firestore! Doc ID:", docRef.id);
  } catch (e) {
    console.error("Firebase save failed:", e.code, e.message);
  }
}

async function saveAnswer(answer, noPressCount, completedGame) {
  try {
    const fb = await waitForFirebase();
    if (playerDocId) {
      // Update existing doc
      await fb.updateDoc(fb.doc(fb.db, "players", playerDocId), {
        answer: answer,
        noPressCount: noPressCount || 0,
        completedWithoutGiveUp: !!completedGame,
        answeredAt: fb.serverTimestamp(),
      });
      console.log("Answer updated:", answer);
    } else {
      // Fallback: create a new doc if we lost the reference
      const uid = fb.auth.currentUser ? fb.auth.currentUser.uid : null;
      await fb.addDoc(fb.collection(fb.db, "players"), {
        nickname: playerNickname || "unknown",
        uid: uid,
        answer: answer,
        noPressCount: noPressCount || 0,
        completedWithoutGiveUp: !!completedGame,
        answeredAt: fb.serverTimestamp(),
      });
      console.log("Answer saved (new doc):", answer);
    }
  } catch (e) {
    console.error("Firebase answer save failed:", e.code, e.message);
  }
}

async function submitNickname() {
  const name = nicknameInput.value.trim();
  if (!name) {
    nicknameError.textContent = "Please enter a nickname!";
    nicknameInput.focus();
    return;
  }
  nicknameBtn.disabled = true;
  nicknameBtn.textContent = "Loading...";
  playerNickname = name;
  await saveNickname(name);
  nicknameOverlay.classList.remove("visible");
  gameWrap.classList.remove("gameHidden");
  buildPool(activeWord());
  render();
}

nicknameBtn.addEventListener("click", submitNickname);
nicknameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitNickname();
  nicknameError.textContent = "";
});
