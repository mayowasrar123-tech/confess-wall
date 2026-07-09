# The Wall — Anonymous Confession Board

Post anonymously, react with likes, reply with anonymous comments. No accounts,
no login, no tracking of who wrote what.

## Running locally

```bash
node server.js
```

Visit `http://localhost:3000`.

**No npm install needed** — this only uses Node's built-in modules
(`http`, `fs`, `crypto`), same as SiteCheck.

## How it works

- `server.js` — the backend. Stores everything in a single `data.json`
  file on disk (created automatically on first post). Handles posting,
  liking, and commenting, plus basic rate-limiting per IP (1 post per
  20s, 1 comment per 5s) so it can't be spammed.
- `public/` — the website itself. A corkboard where each confession
  shows up as a pinned paper note.

## ⚠️ Important: storage caveat before deploying

This uses a JSON file as a simple database. That's fine for a small
project like this, but:

- **On Render/Railway free tiers, the filesystem can reset on redeploy
  or restart.** This means confessions could disappear if the service
  restarts. For a fun project among classmates this is usually an
  acceptable tradeoff — but know that it's not permanent storage.
- If you want it to persist properly long-term, the next step up would
  be a small real database (like SQLite with a persistent disk, or a
  free-tier Postgres instance) — worth doing once people are actually
  using it regularly.

## Deploying

Same process as SiteCheck:
1. Push to GitHub
2. Connect the repo on Render or Railway
3. Start command: `node server.js`
4. No build command needed (or `npm install`, which will just no-op)

## Moderation note

There's no content filtering beyond length limits and basic character
stripping right now. If you share this publicly (not just with a small
trusted group), consider adding:
- A simple profanity filter
- A "report" button so people can flag harmful posts
- Manual review before posts go live (slower, but safer for anything
  public-facing)

For a small friend-group/class rollout, none of this is strictly
required — but worth knowing before opening it up more widely.
