const board = document.getElementById("board");
const emptyState = document.getElementById("empty-state");
const errorMsg = document.getElementById("error-msg");
const input = document.getElementById("confession-input");
const categorySelect = document.getElementById("category-select");
const charCount = document.getElementById("char-count");
const postBtn = document.getElementById("post-btn");
const sortBtns = document.querySelectorAll(".sort-btn");

const CATEGORY_EMOJI = {
  funny: "😂",
  serious: "💭",
  advice: "🆘",
  rant: "🔥",
  random: "🎲",
};

// Apply campus personalization from config.js
if (typeof WALL_CONFIG !== "undefined") {
  document.getElementById("board-title").textContent = WALL_CONFIG.name;
  document.getElementById("board-subtitle").textContent = WALL_CONFIG.subtitle;
  document.title = `${WALL_CONFIG.name} — say it anonymously`;
}

const LIKED_KEY = "confess-wall-liked";
let currentSort = "new";
let confessions = [];

function getLikedSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveLikedSet(set) {
  localStorage.setItem(LIKED_KEY, JSON.stringify([...set]));
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

async function fetchConfessions() {
  try {
    const res = await fetch("/api/confessions");
    const data = await res.json();
    confessions = data.confessions || [];
    render();
  } catch {
    showError("Couldn't load the wall. Try refreshing.");
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
  setTimeout(() => (errorMsg.hidden = true), 4000);
}

function render() {
  const liked = getLikedSet();
  let list = [...confessions];
  if (currentSort === "top") {
    list.sort((a, b) => b.likes - a.likes);
  } else {
    list.sort((a, b) => b.createdAt - a.createdAt);
  }

  board.innerHTML = "";
  if (list.length === 0) {
    emptyState.hidden = false;
    board.appendChild(emptyState);
    return;
  }
  emptyState.hidden = true;

  list.forEach((c) => {
    const card = document.createElement("div");
    card.className = "confession-card";
    card.style.setProperty("--rot", rotationForId(c.id));

    const isLiked = liked.has(c.id);
    const isTrending = c.likes >= 5;
    const commentsHtml = c.comments
      .map(
        (cm) =>
          `<div class="comment-item">${escapeHtml(cm.text)}</div>`
      )
      .join("");

    card.innerHTML = `
      <div class="note">
        <span class="pin" aria-hidden="true"></span>
        <span class="card-category" title="${c.category}">${CATEGORY_EMOJI[c.category] || "🎲"}</span>
        ${isTrending ? '<span class="trending-badge">🔥 trending</span>' : ""}
        <p class="card-text">${escapeHtml(c.text)}</p>
        <div class="card-meta">
          <span>${timeAgo(c.createdAt)}</span>
          <div class="card-actions">
            <button class="like-btn ${isLiked ? "liked" : ""}" data-id="${c.id}">
              ${isLiked ? "❤️" : "🤍"} <span class="like-count">${c.likes}</span>
            </button>
            <button class="comment-toggle" data-id="${c.id}">💬 ${c.comments.length}</button>
          </div>
        </div>
        <div class="comments-section" id="comments-${c.id}" hidden>
          <div class="comments-list">${commentsHtml || '<span style="color:var(--muted);font-size:0.8rem;">No comments yet.</span>'}</div>
          <form class="comment-form" data-id="${c.id}">
            <input type="text" placeholder="Reply anonymously..." maxlength="200" required />
            <button type="submit">Send</button>
          </form>
        </div>
      </div>
    `;
    board.appendChild(card);
  });

  attachCardListeners();
}

function attachCardListeners() {
  board.querySelectorAll(".like-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleLike(btn));
  });
  board.querySelectorAll(".comment-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = document.getElementById(`comments-${btn.dataset.id}`);
      section.hidden = !section.hidden;
    });
  });
  board.querySelectorAll(".comment-form").forEach((form) => {
    form.addEventListener("submit", (e) => handleComment(e, form));
  });
}

async function handleLike(btn) {
  const id = btn.dataset.id;
  const liked = getLikedSet();
  if (liked.has(id)) return; // one like per browser, no unlike (keeps it simple)

  btn.disabled = true;
  try {
    const res = await fetch(`/api/confessions/${id}/like`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to like.");

    liked.add(id);
    saveLikedSet(liked);
    const confession = confessions.find((c) => c.id === id);
    if (confession) confession.likes = data.likes;
    render();
  } catch (err) {
    showError(err.message);
    btn.disabled = false;
  }
}

async function handleComment(e, form) {
  e.preventDefault();
  const id = form.dataset.id;
  const input = form.querySelector("input");
  const text = input.value.trim();
  if (!text) return;

  const submitBtn = form.querySelector("button");
  submitBtn.disabled = true;

  try {
    const res = await fetch(`/api/confessions/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to post comment.");

    const confession = confessions.find((c) => c.id === id);
    if (confession) confession.comments.push(data.comment);
    input.value = "";
    render();
    // keep the comment box open after re-render
    document.getElementById(`comments-${id}`).hidden = false;
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
  }
}

input.addEventListener("input", () => {
  const remaining = 500 - input.value.length;
  charCount.textContent = `${remaining} left`;
});

postBtn.addEventListener("click", async () => {
  const text = input.value.trim();
  if (!text) return;

  postBtn.disabled = true;
  try {
    const res = await fetch("/api/confessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, category: categorySelect.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to post.");

    confessions.push(data.confession);
    input.value = "";
    charCount.textContent = "500 left";
    render();
  } catch (err) {
    showError(err.message);
  } finally {
    postBtn.disabled = false;
  }
});

sortBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    sortBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentSort = btn.dataset.sort;
    render();
  });
});

fetchConfessions();
