# The Wall — Anonymous Confession Board

Post anonymously, react with emoji, reply with anonymous comments, search
and filter the wall. No accounts, no login, no tracking of who wrote what.

## Running locally

```bash
npm install    # fetches Tailwind CSS and compiles public/tailwind.css
node server.js
```

Visit `http://localhost:3000`.

The backend still only uses Node's built-in modules (`http`, `fs`, `crypto`) —
`npm install` is only needed now to build the CSS. A pre-built
`public/tailwind.css` is already committed, so the site works even if you
skip this step; `npm install` just regenerates it from `src/input.css`.

If you change any class names in `public/*.html` or `public/js/*.js`, rebuild
the CSS with:

```bash
npm run build:css       # one-off build
npm run watch:css       # rebuilds automatically as you edit
```

## What's new

- **Multiple reactions** (❤️ 😂 😮 😢) instead of a single like — pick one
  per confession, click it again to remove it, or switch to a different one.
- **Search** — a live text search box filters the wall as you type.
- **Category filters** — pill buttons to show only Funny/Serious/Advice/Rant/
  Random, combinable with search and with the Newest/Most reactions sort.
- **Live stats strip** under the header (confessions pinned · reactions ·
  replies), and a stats bar + the same search/filter/sort tools in the admin
  panel, plus a per-confession reaction breakdown for moderators.
- Old data isn't broken: confessions saved before this update (which only
  had a single `likes` number) are migrated automatically the first time
  the server reads them — that count becomes their ❤️ reaction total.

## How it works

- `server.js` — the backend. Stores everything in a single `data.json`
  file on disk (created automatically on first post). Handles posting,
  reacting, and commenting, plus basic rate-limiting per IP (1 post per
  20s, 1 comment per 5s) so it can't be spammed.
- `public/` — the website itself. A corkboard where each confession
  shows up as a pinned paper note, built with Tailwind CSS.
  - `public/index.html`, `public/admin.html` — markup
  - `public/js/wall.js`, `public/js/admin.js` — page logic (ES modules):
    search, filtering, sorting, reactions, and moderation all live here
  - `public/js/api.js` — shared fetch wrapper for the backend API
  - `public/js/toast.js` — reusable toast notification component
  - `public/tailwind.css` — compiled CSS (source: `src/input.css` + `tailwind.config.js`)

## Deploying (Railway)

1. Push to GitHub
2. Connect the repo on Railway
3. Build command: `npm install` (this also compiles the CSS via the
   `postinstall`/`build` script — no extra config needed)
4. Start command: `node server.js`

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

## About the redesign

The frontend is now built with **Tailwind CSS** and refactored into small
ES modules (`public/js/`) instead of one big script. There's no React/shadcn
here — the original site is plain HTML/CSS/JS served directly by the Node
server with no build tooling, and shadcn's components only exist for React.
Rewriting it in React would mean a totally different stack (bundler, JSX,
a build/deploy step) just to reuse a component library, so instead this
keeps your fast, dependency-light Node setup and gets the same result —
modern utility-first styling, reusable components, toasts, loading states,
animations, and accessibility — without the added complexity. If you'd
rather go full React + shadcn later (e.g. if you add more interactive
screens), that's a bigger follow-up project, not a tweak to this one.

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
