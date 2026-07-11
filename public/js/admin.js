import { api } from "./api.js";
import { showToast } from "./toast.js";

const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const adminPanel = document.getElementById("admin-panel");
const keyInput = document.getElementById("admin-key-input");
const loginBtn = document.getElementById("login-btn");
const loginBtnLabel = loginBtn.querySelector(".btn-label");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const list = document.getElementById("admin-list");
const countLabel = document.getElementById("count-label");
const statsBar = document.getElementById("stats-bar");
const searchInput = document.getElementById("admin-search-input");
const categoryFilter = document.getElementById("admin-category-filter");
const sortSelect = document.getElementById("admin-sort-select");
const modalRoot = document.getElementById("modal-root");

const SESSION_KEY = "confess-wall-admin-key";
const REACTIONS = [
  { type: "heart", emoji: "❤️" },
  { type: "laugh", emoji: "😂" },
  { type: "shock", emoji: "😮" },
  { type: "sad", emoji: "😢" },
];

let allConfessions = [];
let adminKey = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function totalReactions(c) {
  return REACTIONS.reduce((sum, r) => sum + (c.reactions?.[r.type] || 0), 0);
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Accessible confirm dialog, replaces window.confirm().
 * Resolves true/false. Traps focus, closes on Escape or backdrop click.
 */
function confirmModal({ title, message, confirmLabel = "Delete" }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.setAttribute("role", "presentation");
    overlay.innerHTML = `
      <div class="modal-box" role="alertdialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-desc">
        <h2 id="modal-title">${escapeHtml(title)}</h2>
        <p id="modal-desc">${escapeHtml(message)}</p>
        <div class="modal-actions">
          <button type="button" class="modal-btn-cancel" id="modal-cancel">Cancel</button>
          <button type="button" class="modal-btn-confirm" id="modal-confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    modalRoot.appendChild(overlay);

    const cancelBtn = overlay.querySelector("#modal-cancel");
    const confirmBtn = overlay.querySelector("#modal-confirm");
    const previouslyFocused = document.activeElement;

    function close(result) {
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      resolve(result);
    }

    function onKeydown(e) {
      if (e.key === "Escape") close(false);
      if (e.key === "Tab") {
        e.preventDefault();
        (document.activeElement === confirmBtn ? cancelBtn : confirmBtn).focus();
      }
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    cancelBtn.addEventListener("click", () => close(false));
    confirmBtn.addEventListener("click", () => close(true));
    document.addEventListener("keydown", onKeydown);

    confirmBtn.focus();
  });
}

async function tryLogin(key) {
  try {
    await api.adminLogin(key);
    return true;
  } catch {
    return false;
  }
}

async function loadConfessions() {
  list.setAttribute("aria-busy", "true");
  try {
    const data = await api.getConfessions();
    allConfessions = data.confessions || [];
    renderStats();
    renderList();
  } catch (err) {
    list.innerHTML = `<p class="desk-empty">${escapeHtml(err.message || "Couldn't load confessions.")}</p>`;
    showToast(err.message || "Couldn't load confessions.", "error");
  } finally {
    list.setAttribute("aria-busy", "false");
  }
}

function renderStats() {
  if (allConfessions.length === 0) {
    statsBar.hidden = true;
    return;
  }
  const totalComments = allConfessions.reduce((sum, c) => sum + c.comments.length, 0);
  const totalReacts = allConfessions.reduce((sum, c) => sum + totalReactions(c), 0);
  statsBar.hidden = false;
  statsBar.innerHTML = `
    <div class="stat-chip"><strong>${allConfessions.length}</strong> confessions</div>
    <div class="stat-chip"><strong>${totalReacts}</strong> reactions</div>
    <div class="stat-chip"><strong>${totalComments}</strong> comments</div>
  `;
}

function getFilteredSorted() {
  let filtered = [...allConfessions];

  const category = categoryFilter.value;
  if (category !== "all") {
    filtered = filtered.filter((c) => c.category === category);
  }

  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(
      (c) =>
        c.text.toLowerCase().includes(q) ||
        c.comments.some((cm) => cm.text.toLowerCase().includes(q))
    );
  }

  const sort = sortSelect.value;
  if (sort === "reactions") {
    filtered.sort((a, b) => totalReactions(b) - totalReactions(a));
  } else if (sort === "comments") {
    filtered.sort((a, b) => b.comments.length - a.comments.length);
  } else {
    filtered.sort((a, b) => b.createdAt - a.createdAt);
  }
  return filtered;
}

function renderList() {
  countLabel.textContent = `${allConfessions.length} confession(s) on the wall`;
  const filtered = getFilteredSorted();
  list.innerHTML = "";

  if (allConfessions.length === 0) {
    list.innerHTML = `<p class="desk-empty">Nothing to moderate — the wall is empty.</p>`;
    return;
  }
  if (filtered.length === 0) {
    list.innerHTML = `<p class="desk-empty">No confessions match your search or filter.</p>`;
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach((c) => frag.appendChild(buildAdminCard(c)));
  list.appendChild(frag);
}

function buildAdminCard(c) {
  const card = document.createElement("div");
  card.className = "desk-item-card";

  const reactionsHtml = REACTIONS.filter((r) => (c.reactions?.[r.type] || 0) > 0)
    .map((r) => `<span class="desk-reaction-chip">${r.emoji} ${c.reactions[r.type]}</span>`)
    .join("");

  const commentsHtml = c.comments
    .map(
      (cm) => `
      <div class="desk-comment-row" data-comment-id="${cm.id}">
        <span>${escapeHtml(cm.text)}</span>
        <button class="desk-mini-delete" data-confession="${c.id}" data-comment="${cm.id}">Delete</button>
      </div>`
    )
    .join("");

  card.innerHTML = `
    <div class="desk-card-top">
      <span>${escapeHtml(c.category)} · ${new Date(c.createdAt).toLocaleString()}</span>
      <span class="desk-reaction-summary">${reactionsHtml || '<span class="text-desk-muted">No reactions yet</span>'} · 💬 ${c.comments.length}</span>
    </div>
    <p class="desk-card-text">${escapeHtml(c.text)}</p>
    <div class="desk-card-actions">
      <button class="desk-btn-danger" data-id="${c.id}">Delete confession</button>
    </div>
    ${commentsHtml ? `<div class="desk-comments">${commentsHtml}</div>` : ""}
  `;

  card.querySelector(".desk-btn-danger").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const ok = await confirmModal({
      title: "Delete this confession?",
      message: "This will permanently remove the confession and all of its comments.",
      confirmLabel: "Delete",
    });
    if (!ok) return;

    btn.disabled = true;
    try {
      await api.deleteConfession(c.id, adminKey);
      showToast("Confession deleted.", "success");
      loadConfessions();
    } catch (err) {
      showToast(err.message, "error");
      btn.disabled = false;
    }
  });

  card.querySelectorAll(".desk-mini-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const target = e.currentTarget;
      const ok = await confirmModal({
        title: "Delete this comment?",
        message: "This will permanently remove the comment.",
        confirmLabel: "Delete",
      });
      if (!ok) return;

      target.disabled = true;
      try {
        await api.deleteComment(target.dataset.confession, target.dataset.comment, adminKey);
        showToast("Comment deleted.", "success");
        loadConfessions();
      } catch (err) {
        showToast(err.message, "error");
        target.disabled = false;
      }
    });
  });

  return card;
}

function enterPanel(key) {
  adminKey = key;
  sessionStorage.setItem(SESSION_KEY, key);
  loginScreen.hidden = true;
  adminPanel.hidden = false;
  loadConfessions();
}

function exitPanel() {
  adminKey = null;
  sessionStorage.removeItem(SESSION_KEY);
  adminPanel.hidden = true;
  loginScreen.hidden = false;
  keyInput.value = "";
  keyInput.focus();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = keyInput.value.trim();
  if (!key) {
    keyInput.classList.add("animate-shake");
    keyInput.addEventListener("animationend", () => keyInput.classList.remove("animate-shake"), { once: true });
    keyInput.focus();
    return;
  }

  loginBtn.disabled = true;
  const originalLabel = loginBtnLabel.innerHTML;
  loginBtnLabel.innerHTML = '<span class="spinner" aria-hidden="true"></span> Checking…';
  loginError.hidden = true;

  const ok = await tryLogin(key);

  loginBtn.disabled = false;
  loginBtnLabel.innerHTML = originalLabel;

  if (ok) {
    enterPanel(key);
  } else {
    loginError.textContent = "Wrong key. Try again.";
    loginError.hidden = false;
    keyInput.classList.add("animate-shake");
    keyInput.addEventListener("animationend", () => keyInput.classList.remove("animate-shake"), { once: true });
    keyInput.focus();
  }
});

logoutBtn.addEventListener("click", exitPanel);
searchInput.addEventListener("input", debounce(renderList, 200));
categoryFilter.addEventListener("change", renderList);
sortSelect.addEventListener("change", renderList);

// Auto-login if a key is already stored for this session
const storedKey = sessionStorage.getItem(SESSION_KEY);
if (storedKey) {
  tryLogin(storedKey).then((ok) => {
    if (ok) enterPanel(storedKey);
    else sessionStorage.removeItem(SESSION_KEY);
  });
}
