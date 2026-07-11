// Small, dependency-free toast notification system.
// Usage: import { showToast } from "./toast.js"; showToast("Saved!", "success");

const REGION_ID = "toast-region";
const AUTO_DISMISS_MS = 4500;

function getRegion() {
  return document.getElementById(REGION_ID);
}

/**
 * @param {string} message
 * @param {"info"|"success"|"error"} [type="info"]
 */
export function showToast(message, type = "info") {
  const region = getRegion();
  if (!region) return;

  const toast = document.createElement("div");
  toast.className = "toast" + (type === "error" ? " toast-error" : type === "success" ? " toast-success" : "");
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const icon = type === "error" ? "⚠️" : type === "success" ? "✅" : "💬";
  toast.innerHTML = `
    <span aria-hidden="true">${icon}</span>
    <span class="flex-1">${escapeHtml(message)}</span>
    <button type="button" class="toast-dismiss" aria-label="Dismiss notification">✕</button>
  `;

  const dismiss = () => {
    if (toast.dataset.leaving) return;
    toast.dataset.leaving = "true";
    toast.classList.add("is-leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  };

  toast.querySelector(".toast-dismiss").addEventListener("click", dismiss);
  region.appendChild(toast);

  const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
  toast.addEventListener("mouseenter", () => clearTimeout(timer));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
