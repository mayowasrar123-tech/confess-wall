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

This uses a JSON file as a simple database. On its own, that file lives
next to your code — which means **every time you redeploy (push new
code), the file gets wiped and confessions disappear.**

**Fix: attach a Railway Volume so data survives redeploys.**

1. In your Railway service, go to the **Settings** tab
2. Scroll to **Volumes** → click **"+ New Volume"**
3. Set the mount path to `/data`
4. Go to the **Variables** tab → add a new variable:
   - Name: `DATA_DIR`
   - Value: `/data`
5. Redeploy

The code already supports this (`DATA_DIR` env var) — once set, `data.json`
lives on the persistent volume instead of the container's throwaway disk,
so it survives every future code update.

**If you skip this:** the app still works fine, but treat confessions as
temporary — they'll vanish the next time you push a change.

## Deploying

Same process as SiteCheck:
1. Push to GitHub
2. Connect the repo on Render or Railway
3. Start command: `node server.js`
4. No build command needed (or `npm install`, which will just no-op)

## Moderation: the admin panel

Visit `/admin.html` (e.g. `http://localhost:3000/admin.html`, or your live
URL + `/admin.html`) to see every confession and comment with delete
buttons. It's protected by a password.

**Set your own password before sharing this with anyone:**
- Locally: run with `ADMIN_KEY=yourpassword node server.js`
- On Railway: go to your service → **Variables** → add `ADMIN_KEY` with
  whatever password you want → redeploy

If you don't set it, it defaults to `changeme` — **don't leave it that
way** once you share the link, since the admin page URL is technically
guessable by anyone with the domain.

This isn't bank-grade security (it's a single shared password, not
individual accounts), but it's enough to let you quietly remove
anything mean-spirited, identifying, or harmful without needing to
touch the server files directly.

## Personalizing it for your campus

Edit `public/config.js` — that's the only file you need to touch:

```js
const WALL_CONFIG = {
  name: "LAUTECH Wall",
  subtitle: "Say what you can't say anywhere else. No names. No login.",
};
```

Change `name` and `subtitle` to whatever fits your school/group, then
redeploy (push to GitHub, Railway picks it up automatically).

## Moderation note

There's no content filtering beyond length limits and basic character
stripping right now. If you share this publicly (not just with a small
trusted group), consider adding:
- A simple profanity filter
- A "report" button so people can flag harmful posts
- Manual review before posts go live (slower, but safer for anything
  public-facing)

For a small friend-group/class rollout, the admin panel above is
probably enough — but worth knowing before opening it up more widely.
