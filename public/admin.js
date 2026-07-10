const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
const keyInput = document.getElementById("admin-key-input");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const list = document.getElementById("admin-list");
const countLabel = document.getElementById("count-label");

const SESSION_KEY = "confess-wall-admin-key";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function tryLogin(key) {
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) return false;
    return true;
  } catch {
    return false;
  }
}

async function loadConfessions(key) {
  const res = await fetch("/api/confessions");
  const data = await res.json();
  const list = [...data.confessions].sort((a, b) => b.createdAt - a.createdAt);
  render(list, key);
}

function render(confessions, key) {
  countLabel.textContent = `${confessions.length} confession(s) on the wall`;
  list.innerHTML = "";
  confessions.forEach((c) => {
    const card = document.createElement("div");
    card.className = "admin-card";
    const commentsHtml = c.comments
      .map(
        (cm) => `
        <div class="admin-comment-row" data-comment-id="${cm.id}">
          <span>${escapeHtml(cm.text)}</span>
          <button class="mini-delete" data-confession="${c.id}" data-comment="${cm.id}">delete</button>
        </div>`
      )
      .join("");

    card.innerHTML = `
      <div class="admin-card-top">
        <span>${c.category} · ${new Date(c.createdAt).toLocaleString()}</span>
        <span>❤️ ${c.likes} · 💬 ${c.comments.length}</span>
      </div>
      <p class="admin-card-text">${escapeHtml(c.text)}</p>
      <div class="admin-card-actions">
        <button class="delete-btn" data-id="${c.id}">Delete confession</button>
      </div>
      ${commentsHtml ? `<div class="admin-comments">${commentsHtml}</div>` : ""}
    `;
    list.appendChild(card);
  });

  list.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this confession and all its comments?")) return;
      await fetch(`/api/confessions/${btn.dataset.id}`, {
        method: "DELETE",
        headers: { "x-admin-key": key },
      });
      loadConfessions(key);
    });
  });

  list.querySelectorAll(".mini-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch(
        `/api/confessions/${btn.dataset.confession}/comments/${btn.dataset.comment}`,
        { method: "DELETE", headers: { "x-admin-key": key } }
      );
      loadConfessions(key);
    });
  });
}

function enterPanel(key) {
  sessionStorage.setItem(SESSION_KEY, key);
  loginScreen.hidden = true;
  adminPanel.hidden = false;
  loadConfessions(key);
}

loginBtn.addEventListener("click", async () => {
  const key = keyInput.value.trim();
  if (!key) return;
  loginBtn.disabled = true;
  const ok = await tryLogin(key);
  loginBtn.disabled = false;
  if (ok) {
    enterPanel(key);
  } else {
    loginError.textContent = "Wrong key.";
    loginError.hidden = false;
  }
});

keyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

// Auto-login if a key is already stored for this session
const storedKey = sessionStorage.getItem(SESSION_KEY);
if (storedKey) {
  tryLogin(storedKey).then((ok) => {
    if (ok) enterPanel(storedKey);
  });
}
