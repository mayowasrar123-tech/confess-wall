const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
// DATA_DIR lets you point storage at a persistent Railway Volume (e.g. "/data").
// Without it, data.json lives next to the code and gets wiped on redeploy.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, "data.json");

// Set this in Railway's Variables tab (Settings > Variables) to something only
// you know. Without setting it, it defaults to "changeme" — change it before
// sharing the admin link with anyone.
const ADMIN_KEY = process.env.ADMIN_KEY || "changeme";

const MAX_CONFESSION_LENGTH = 500;
const MAX_COMMENT_LENGTH = 200;
const POST_COOLDOWN_MS = 20 * 1000; // 1 post per 20s per IP
const COMMENT_COOLDOWN_MS = 5 * 1000;

// ---- Security headers, applied to every response ----
// CSP allows Google Fonts (which the site actually uses) and otherwise
// keeps everything restricted to same-origin.
const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; " +
    "style-src 'self' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; " +
    "script-src 'self'; " +
    "connect-src 'self'; " +
    "img-src 'self'; " +
    "frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function applySecurityHeaders(res) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(key, value);
  }
}

// ---- Simple JSON-file "database" with a write queue to avoid corruption ----
let writeQueue = Promise.resolve();

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    // Migrate confessions created before the reactions system existed:
    // they only have a numeric `likes` field, not a `reactions` object.
    for (const c of data.confessions || []) {
      if (!c.reactions) {
        c.reactions = { ...EMPTY_REACTIONS, heart: typeof c.likes === "number" ? c.likes : 0 };
      }
    }
    return data;
  } catch {
    return { confessions: [] };
  }
}

function saveData(data) {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), (err) => {
          if (err) reject(err);
          else resolve();
        });
      })
  );
  return writeQueue;
}

// ---- Very light rate limiting, in-memory, by IP ----
const lastPostByIp = new Map();
const lastCommentByIp = new Map();

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function isRateLimited(map, ip, cooldownMs) {
  const last = map.get(ip);
  const now = Date.now();
  if (last && now - last < cooldownMs) {
    return Math.ceil((cooldownMs - (now - last)) / 1000);
  }
  map.set(ip, now);
  return 0;
}

// Basic cleanup so these maps don't grow forever
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [ip, t] of lastPostByIp) if (t < cutoff) lastPostByIp.delete(ip);
  for (const [ip, t] of lastCommentByIp) if (t < cutoff) lastCommentByIp.delete(ip);
}, 5 * 60 * 1000);

function sanitize(text) {
  return String(text)
    .replace(/[<>]/g, "") // strip angle brackets, belt-and-suspenders against the frontend already escaping
    .trim();
}

const VALID_CATEGORIES = ["funny", "serious", "advice", "rant", "random"];
const VALID_REACTIONS = ["heart", "laugh", "shock", "sad"];
const EMPTY_REACTIONS = { heart: 0, laugh: 0, shock: 0, sad: 0 };

function jsonResponse(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 20000) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// ---- Route handlers ----

function handleGetConfessions(req, res) {
  const data = loadData();
  const sorted = [...data.confessions].sort((a, b) => b.createdAt - a.createdAt);
  jsonResponse(res, 200, { confessions: sorted });
}

async function handlePostConfession(req, res) {
  const ip = getIp(req);
  const waitSec = isRateLimited(lastPostByIp, ip, POST_COOLDOWN_MS);
  if (waitSec) {
    return jsonResponse(res, 429, {
      error: `Slow down — you can post again in ${waitSec}s.`,
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return jsonResponse(res, 400, { error: "Invalid request body." });
  }

  const text = sanitize(body.text || "");
  const category = VALID_CATEGORIES.includes(body.category) ? body.category : "random";

  if (!text) return jsonResponse(res, 400, { error: "Confession can't be empty." });
  if (text.length > MAX_CONFESSION_LENGTH) {
    return jsonResponse(res, 400, {
      error: `Keep it under ${MAX_CONFESSION_LENGTH} characters.`,
    });
  }

  const data = loadData();
  const confession = {
    id: crypto.randomUUID(),
    text,
    category,
    createdAt: Date.now(),
    reactions: { ...EMPTY_REACTIONS },
    comments: [],
  };
  data.confessions.push(confession);
  await saveData(data);

  jsonResponse(res, 201, { confession });
}

async function handleReact(req, res, id) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return jsonResponse(res, 400, { error: "Invalid request body." });
  }

  const type = body.type === null ? null : body.type;
  const previousType = body.previousType === null ? null : body.previousType;

  if (type !== null && !VALID_REACTIONS.includes(type)) {
    return jsonResponse(res, 400, { error: "Invalid reaction type." });
  }
  if (previousType !== null && !VALID_REACTIONS.includes(previousType)) {
    return jsonResponse(res, 400, { error: "Invalid previous reaction type." });
  }

  const data = loadData();
  const confession = data.confessions.find((c) => c.id === id);
  if (!confession) return jsonResponse(res, 404, { error: "Confession not found." });

  if (previousType && previousType !== type && confession.reactions[previousType] > 0) {
    confession.reactions[previousType] -= 1;
  }
  if (type && type !== previousType) {
    confession.reactions[type] += 1;
  }

  await saveData(data);
  jsonResponse(res, 200, { reactions: confession.reactions });
}

async function handleComment(req, res, id) {
  const ip = getIp(req);
  const waitSec = isRateLimited(lastCommentByIp, ip, COMMENT_COOLDOWN_MS);
  if (waitSec) {
    return jsonResponse(res, 429, {
      error: `Slow down — you can comment again in ${waitSec}s.`,
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    return jsonResponse(res, 400, { error: "Invalid request body." });
  }

  const text = sanitize(body.text || "");
  if (!text) return jsonResponse(res, 400, { error: "Comment can't be empty." });
  if (text.length > MAX_COMMENT_LENGTH) {
    return jsonResponse(res, 400, {
      error: `Keep comments under ${MAX_COMMENT_LENGTH} characters.`,
    });
  }

  const data = loadData();
  const confession = data.confessions.find((c) => c.id === id);
  if (!confession) return jsonResponse(res, 404, { error: "Confession not found." });

  const comment = { id: crypto.randomUUID(), text, createdAt: Date.now() };
  confession.comments.push(comment);
  await saveData(data);

  jsonResponse(res, 201, { comment });
}

function checkAdminAuth(req) {
  const key = req.headers["x-admin-key"];
  return key && key === ADMIN_KEY;
}

async function handleDeleteConfession(req, res, id) {
  if (!checkAdminAuth(req)) {
    return jsonResponse(res, 401, { error: "Not authorized." });
  }
  const data = loadData();
  const before = data.confessions.length;
  data.confessions = data.confessions.filter((c) => c.id !== id);
  if (data.confessions.length === before) {
    return jsonResponse(res, 404, { error: "Confession not found." });
  }
  await saveData(data);
  jsonResponse(res, 200, { deleted: true });
}

async function handleDeleteComment(req, res, confessionId, commentId) {
  if (!checkAdminAuth(req)) {
    return jsonResponse(res, 401, { error: "Not authorized." });
  }
  const data = loadData();
  const confession = data.confessions.find((c) => c.id === confessionId);
  if (!confession) return jsonResponse(res, 404, { error: "Confession not found." });

  const before = confession.comments.length;
  confession.comments = confession.comments.filter((cm) => cm.id !== commentId);
  if (confession.comments.length === before) {
    return jsonResponse(res, 404, { error: "Comment not found." });
  }
  await saveData(data);
  jsonResponse(res, 200, { deleted: true });
}

async function handleAdminLogin(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch {
    return jsonResponse(res, 400, { error: "Invalid request." });
  }
  if (body.key === ADMIN_KEY) {
    return jsonResponse(res, 200, { ok: true });
  }
  jsonResponse(res, 401, { error: "Wrong key." });
}

// ---- Static file serving ----
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

function serveStatic(req, res) {
  let filePath = req.url === "/" ? "/index.html" : req.url;
  filePath = path.join(PUBLIC_DIR, decodeURIComponent(filePath.split("?")[0]));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath);
    const headers = { "Content-Type": MIME[ext] || "application/octet-stream" };
    // HTML always revalidates so a redeploy is picked up immediately; CSS/JS/config
    // are safe to cache briefly since they're versioned by redeploy, not by filename.
    headers["Cache-Control"] = ext === ".html" ? "no-cache" : "public, max-age=3600";
    res.writeHead(200, headers);
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res);
  const url = req.url.split("?")[0];

  if (req.method === "GET" && url === "/api/confessions") {
    return handleGetConfessions(req, res);
  }
  if (req.method === "POST" && url === "/api/confessions") {
    return handlePostConfession(req, res);
  }
  const reactMatch = url.match(/^\/api\/confessions\/([a-f0-9-]+)\/react$/);
  if (req.method === "POST" && reactMatch) {
    return handleReact(req, res, reactMatch[1]);
  }
  const commentMatch = url.match(/^\/api\/confessions\/([a-f0-9-]+)\/comments$/);
  if (req.method === "POST" && commentMatch) {
    return handleComment(req, res, commentMatch[1]);
  }
  if (req.method === "DELETE" && reactMatch === null) {
    const deleteConfessionMatch = url.match(/^\/api\/confessions\/([a-f0-9-]+)$/);
    if (deleteConfessionMatch) {
      return handleDeleteConfession(req, res, deleteConfessionMatch[1]);
    }
    const deleteCommentMatch = url.match(
      /^\/api\/confessions\/([a-f0-9-]+)\/comments\/([a-f0-9-]+)$/
    );
    if (deleteCommentMatch) {
      return handleDeleteComment(req, res, deleteCommentMatch[1], deleteCommentMatch[2]);
    }
  }
  if (req.method === "POST" && url === "/api/admin/login") {
    return handleAdminLogin(req, res);
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Confession Wall running on http://localhost:${PORT}`);
  console.log(`Storing data in: ${DATA_FILE}`);
});
