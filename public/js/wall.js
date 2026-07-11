import { api } from "./api.js";
import { showToast } from "./toast.js";

const board = document.getElementById("board");
const emptyState = document.getElementById("empty-state");
const input = document.getElementById("confession-input");
const categorySelect = document.getElementById("category-select");
const charCount = document.getElementById("char-count");
const postBtn = document.getElementById("post-btn");
const postBtnLabel = postBtn.querySelector(".btn-label");
const sortBtns = document.querySelectorAll(".sort-btn");
const chipBtns = document.querySelectorAll(".chip");
const searchInput = document.getElementById("search-input");
const statsStrip = document.getElementById("stats-strip");
const srStatus = document.getElementById("sr-status");

const CATEGORY_EMOJI = {
  funny: "😂",
  serious: "💭",
  advice: "🆘",
  rant: "🔥",
  random: "🎲",
};

const REACTIONS = [
  { type: "heart", emoji: "❤️", label: "Love this" },
  { type: "laugh", emoji: "😂", label: "This is funny" },
  { type: "shock", emoji: "😮", label: "Shocking" },
  { type: "sad", emoji: "😢", label: "This is sad" },
];

// Apply campus personalization from config.js (loaded as a plain global script)
if (typeof window.WALL_CONFIG !== "undefined") {
  document.getElementById("board-title").textContent = window.WALL_CONFIG.name;
  document.getElementById("board-subtitle").textContent = window.WALL_CONFIG.subtitle;
  document.title = `${window.WALL_CONFIG.name} — say it anonymously`;
}

const REACTED_KEY = "confess-wall-reacted"; // { [confessionId]: reactionType }
const MAX_LENGTH = 500;
let currentSort = "new";
let currentCategory = "all";
let searchTerm = "";
let confessions = [];
let loaded = false;

function getReactedMap() {
  try {
    return JSON.parse(localStorage.getItem(REACTED_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveReactedMap(map) {
  localStorage.setItem(REACTED_KEY, JSON.stringify(map));
}

function totalReactions(c) {
  return REACTIONS.reduce((sum, r) => sum + (c.reactions?.[r.type] || 0), 0);
}

// Deterministic pseudo-random rotation per card id, so it doesn't jitter on re-render
function rotationForId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ((hash % 7) - 3) + "deg"; // -3deg to 3deg
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function fetchConfessions() {
  try {
    const data = await api.getConfessions();
    confessions = data.confessions || [];
    loaded = true;
    updateStats();
    render();
  } catch (err) {
    loaded = true;
    board.innerHTML = "";
    board.setAttribute("aria-busy", "false");
    showToast(err.message || "Couldn't load the wall. Try refreshing.", "error");
    emptyState.hidden = false;
    emptyState.textContent = "Couldn't load the wall. Try refreshing the page.";
  }
}

function updateStats() {
  if (confessions.length === 0) {
    statsStrip.hidden = true;
    return;
  }
  const totalComments = confessions.reduce((sum, c) => sum + c.comments.length, 0);
  const totalReacts = confessions.reduce((sum, c) => sum + totalReactions(c), 0);
  statsStrip.hidden = false;
  statsStrip.textContent =
    `${confessions.length} confession${confessions.length === 1 ? "" : "s"} pinned · ` +
    `${totalReacts} reaction${totalReacts === 1 ? "" : "s"} · ` +
    `${totalComments} repl${totalComments === 1 ? "y" : "ies"}`;
}

function getFilteredSorted() {
  let list = [...confessions];

  if (currentCategory !== "all") {
    list = list.filter((c) => c.category === currentCategory);
  }
  if (searchTerm.trim()) {
    const q = searchTerm.trim().toLowerCase();
    list = list.filter((c) => c.text.toLowerCase().includes(q));
  }

  if (currentSort === "top") {
    list.sort((a, b) => totalReactions(b) - totalReactions(a));
  } else {
    list.sort((a, b) => b.createdAt - a.createdAt);
  }
  return list;
}

function render() {
  if (!loaded) return; // keep skeletons visible until first successful/failed load
  const reacted = getReactedMap();
  const list = getFilteredSorted();

  board.innerHTML = "";
  board.setAttribute("aria-busy", "false");

  if (list.length === 0) {
    emptyState.hidden = false;
    const isFiltering = currentCategory !== "all" || searchTerm.trim();
    emptyState.textContent = isFiltering
      ? "No confessions match your search or filter."
      : "The wall is empty. Be the first to pin something.";
    return;
  }
  emptyState.hidden = true;

  const frag = document.createDocumentFragment();
  list.forEach((c, i) => {
    frag.appendChild(buildCard(c, reacted, i));
  });
  board.appendChild(frag);
}

function buildCard(c, reacted, index) {
  const card = document.createElement("div");
  card.className = "confession-card";
  card.style.setProperty("--rot", rotationForId(c.id));
  card.style.animationDelay = `${Math.min(index, 8) * 40}ms`;

  const myReaction = reacted[c.id] || null;
  const isTrending = totalReactions(c) >= 5;
  const commentsHtml = c.comments
    .map((cm) => `<div class="comment-item">${escapeHtml(cm.text)}</div>`)
    .join("");

  const reactionButtons = REACTIONS.map((r) => {
    const count = c.reactions?.[r.type] || 0;
    const isActive = myReaction === r.type;
    return `
      <button
        class="reaction-btn ${isActive ? "is-active" : ""}"
        data-type="${r.type}"
        aria-pressed="${isActive}"
        aria-label="${r.label}"
        title="${r.label}"
      >
        <span class="reaction-emoji" aria-hidden="true">${r.emoji}</span>
        <span class="reaction-count">${count}</span>
      </button>`;
  }).join("");

  card.innerHTML = `
    <div class="note">
      <span class="pin-dot" aria-hidden="true"></span>
      <span class="card-category" title="${c.category}" aria-hidden="true">${CATEGORY_EMOJI[c.category] || "🎲"}</span>
      ${isTrending ? '<span class="trending-badge">🔥 trending</span>' : ""}
      <p class="card-text">${escapeHtml(c.text)}</p>
      <div class="reaction-bar" role="group" aria-label="React to this confession">
        ${reactionButtons}
      </div>
      <div class="card-meta">
        <span>${timeAgo(c.createdAt)}</span>
        <button class="icon-btn comment-toggle" data-id="${c.id}" aria-expanded="false" aria-controls="comments-${c.id}">
          <span aria-hidden="true">💬</span> ${c.comments.length}
        </button>
      </div>
      <div class="comments-section" id="comments-${c.id}" hidden>
        <div class="comments-list">${commentsHtml || '<span class="text-muted text-xs">No comments yet.</span>'}</div>
        <form class="comment-form" data-id="${c.id}">
          <label class="sr-only" for="comment-input-${c.id}">Reply anonymously</label>
          <input type="text" id="comment-input-${c.id}" class="comment-input" placeholder="Reply anonymously..." maxlength="200" required />
          <button type="submit" class="comment-submit">Send</button>
        </form>
      </div>
    </div>
  `;

  card.querySelectorAll(".reaction-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleReact(btn, c.id));
  });
  card.querySelector(".comment-toggle").addEventListener("click", (e) => toggleComments(e.currentTarget));
  card.querySelector(".comment-form").addEventListener("submit", (e) => handleComment(e, e.currentTarget));

  return card;
}

function toggleComments(btn) {
  const section = document.getElementById(`comments-${btn.dataset.id}`);
  const isHidden = section.hidden;
  section.hidden = !isHidden;
  btn.setAttribute("aria-expanded", String(isHidden));
  if (isHidden) section.querySelector("input")?.focus();
}

async function handleReact(btn, confessionId) {
  const reacted = getReactedMap();
  const previousType = reacted[confessionId] || null;
  const clickedType = btn.dataset.type;
  const newType = previousType === clickedType ? null : clickedType; // click again to remove

  const confession = confessions.find((c) => c.id === confessionId);
  if (!confession) return;

  btn.closest(".reaction-bar").querySelectorAll(".reaction-btn").forEach((b) => (b.disabled = true));
  btn.classList.add("reaction-bump");

  try {
    const data = await api.reactToConfession(confessionId, newType, previousType);
    confession.reactions = data.reactions;
    if (newType) reacted[confessionId] = newType;
    else delete reacted[confessionId];
    saveReactedMap(reacted);
    updateStats();
    render();
  } catch (err) {
    showToast(err.message, "error");
    btn.closest(".reaction-bar")?.querySelectorAll(".reaction-btn").forEach((b) => (b.disabled = false));
  }
}

async function handleComment(e, form) {
  e.preventDefault();
  const id = form.dataset.id;
  const fieldInput = form.querySelector("input");
  const text = fieldInput.value.trim();
  if (!text) {
    fieldInput.classList.add("animate-shake");
    fieldInput.addEventListener("animationend", () => fieldInput.classList.remove("animate-shake"), { once: true });
    fieldInput.focus();
    return;
  }

  const submitBtn = form.querySelector("button");
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";

  try {
    const data = await api.postComment(id, text);
    const confession = confessions.find((c) => c.id === id);
    if (confession) confession.comments.push(data.comment);
    fieldInput.value = "";
    updateStats();
    render();
    const section = document.getElementById(`comments-${id}`);
    section.hidden = false;
    section.querySelector("input")?.focus();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send";
  }
}

input.addEventListener("input", () => {
  const remaining = MAX_LENGTH - input.value.length;
  charCount.textContent = `${remaining} left`;
  charCount.classList.toggle("is-near-limit", remaining <= 40);
});

input.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    postBtn.click();
  }
});

postBtn.addEventListener("click", async () => {
  const text = input.value.trim();
  if (!text) {
    input.classList.add("animate-shake");
    input.addEventListener("animationend", () => input.classList.remove("animate-shake"), { once: true });
    input.focus();
    showToast("Write something before pinning it.", "error");
    return;
  }
  if (text.length > MAX_LENGTH) {
    showToast(`Keep it under ${MAX_LENGTH} characters.`, "error");
    return;
  }

  postBtn.disabled = true;
  const originalLabel = postBtnLabel.innerHTML;
  postBtnLabel.innerHTML = '<span class="spinner" aria-hidden="true"></span> Pinning…';

  try {
    const data = await api.postConfession(text, categorySelect.value);
    confessions.push(data.confession);
    input.value = "";
    charCount.textContent = `${MAX_LENGTH} left`;
    charCount.classList.remove("is-near-limit");
    currentSort = "new";
    sortBtns.forEach((b) => {
      const isNew = b.dataset.sort === "new";
      b.classList.toggle("is-active", isNew);
      b.setAttribute("aria-selected", String(isNew));
    });
    updateStats();
    render();
    srStatus.textContent = "Confession posted.";
    showToast("Pinned to the wall.", "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    postBtn.disabled = false;
    postBtnLabel.innerHTML = originalLabel;
  }
});

sortBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    sortBtns.forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("is-active");
    btn.setAttribute("aria-selected", "true");
    currentSort = btn.dataset.sort;
    render();
  });
});

chipBtns.forEach((chip) => {
  chip.addEventListener("click", () => {
    chipBtns.forEach((c) => {
      c.classList.remove("is-active");
      c.setAttribute("aria-pressed", "false");
    });
    chip.classList.add("is-active");
    chip.setAttribute("aria-pressed", "true");
    currentCategory = chip.dataset.category;
    render();
  });
});

searchInput.addEventListener(
  "input",
  debounce((e) => {
    searchTerm = e.target.value;
    render();
  }, 200)
);

fetchConfessions();
