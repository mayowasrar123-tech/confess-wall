// Thin wrapper around fetch() for the confessions API.
// Every call resolves to parsed JSON or throws an Error with a user-facing message.

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    // Some responses (e.g. 204) may have no body — that's fine.
  }

  if (!res.ok) {
    throw new Error(data.error || `Something went wrong (${res.status}).`);
  }
  return data;
}

export const api = {
  getConfessions: () => request("/api/confessions"),

  postConfession: (text, category) =>
    request("/api/confessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, category }),
    }),

  reactToConfession: (id, type, previousType) =>
    request(`/api/confessions/${id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, previousType: previousType ?? null }),
    }),

  postComment: (id, text) =>
    request(`/api/confessions/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }),

  adminLogin: (key) =>
    request("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    }),

  deleteConfession: (id, key) =>
    request(`/api/confessions/${id}`, {
      method: "DELETE",
      headers: { "x-admin-key": key },
    }),

  deleteComment: (confessionId, commentId, key) =>
    request(`/api/confessions/${confessionId}/comments/${commentId}`, {
      method: "DELETE",
      headers: { "x-admin-key": key },
    }),
};
