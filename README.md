# 📌 BrainBoard
**Collaborative Brainstorming Tool — Technical Reference & User Guide**

---

## What Is BrainBoard?

BrainBoard is a web-based collaborative brainstorming tool that digitizes the classic post-it note exercise. Instead of writing tasks on physical notes and transcribing them later, team members submit tasks directly from their laptops into a shared live board. The facilitator can then use AI to automatically group the tasks into logical work areas, and the whole team can review and reorganize the results together in real time.

It was designed for cross-functional project kick-off sessions — R&D, Finance, Supply Chain, Lab Ops, Regulatory, and so on — where the goal is to rapidly map out all the work streams for a new project without any one function dominating the conversation.

---

## How a Session Works

### The Three Phases

| Phase | What Happens |
|---|---|
| **Phase 1 — Input** | All participants open the URL and submit tasks one at a time on the Participant tab. Notes are hidden from other participants until the facilitator reveals them. |
| **Phase 2 — AI Grouping** | The facilitator enters a brief project description and clicks "Suggest groupings with AI". Claude reads all notes and proposes 4–8 named work streams. |
| **Phase 3 — Review** | The grouped board is shown to everyone. The team drags notes between groups, renames groups, merges duplicates, edits tasks, and deletes redundant items. Export to CSV when done. |

### Step-by-Step for the Facilitator

1. **Before the session:** Make sure the Railway app is running (check the URL loads). Have your facilitator password ready.
2. **Share the URL:** Send participants the Railway URL (or TinyURL shortcut). Everyone opens it in a browser — no login needed for participants.
3. **Participants submit notes:** Each person types tasks on the Participant tab, one per note. They can add their name or stay anonymous. Notes are hidden by default.
4. **Optionally find duplicates:** On the Facilitator tab, click "Find duplicates" to let AI flag similar notes. Review pairs side-by-side, then merge, delete one, or keep both.
5. **Run AI grouping:** Click "Suggest groupings with AI", enter a short project description in the modal (e.g. "Diagnostic test launch — teams: R&D, Finance, Supply Chain, Lab Ops, Regulatory"), and confirm.
6. **Review with the team:** Toggle the board to Visible so everyone sees it. Drag notes between groups, rename groups by clicking the title, edit note text inline, or delete duplicates.
7. **Export:** Click "Export CSV" to download a spreadsheet with columns: Group / Task / Contributor.
8. **Reset for next session:** Click "Clear all" in the Facilitator view to wipe all notes and groups.

---

## Passwords & Credentials

You will need the following to use and maintain BrainBoard. Store these somewhere safe.

| Item | Location |
|---|---|
| **Facilitator password** | Set as `FACILITATOR_PASSWORD` in Railway environment variables |
| **Anthropic API key** | Set as `ANTHROPIC_API_KEY` in Railway environment variables (starts with `sk-ant-...`) |
| **GitHub account** | Used to store and update the source code |
| **Railway account** | Used to host the app — log in at railway.app with your GitHub account |

> ⚠️ **Never** put the API key or facilitator password directly in the code files. They must always live in Railway's environment variables only.

---

## Architecture & Dependencies

### How It Works

BrainBoard has two parts: a Node.js backend server that runs on Railway, and an HTML/JavaScript frontend that participants open in their browser. All AI calls are made server-side so the Anthropic API key is never exposed to participants.

| Component | Description |
|---|---|
| `server.js` | Node.js + Express backend. Handles all API routes, stores data in SQLite, makes calls to the Anthropic API. |
| `public/index.html` | Single-file frontend. All HTML, CSS, and JavaScript in one file. Served statically by the backend. |
| `package.json` | Declares Node.js dependencies (Express, better-sqlite3). |
| `brainboard.db` | SQLite database file created automatically on first run by Railway. Stores notes, groups, and settings. Lives on Railway's disk — **not in the repository**. |

### Node.js Dependencies

| Package | Purpose |
|---|---|
| `express` | Web server framework — handles HTTP routing |
| `better-sqlite3` | SQLite database — stores all notes and groups |

These are declared in `package.json` and installed automatically by Railway when it builds the app. You never need to run `npm install` manually.

### External Services

| Service | What It Does |
|---|---|
| **Railway** (railway.app) | Hosts the Node.js server and SQLite database. Free tier is sufficient for occasional sessions. |
| **Anthropic API** | Powers all three AI features: task grouping, duplicate detection, and merge reformulation. Billed per token — roughly $0.003 per session. |
| **GitHub** | Stores the source code. Railway pulls from GitHub on every commit to auto-deploy. |
| **Google Fonts** | Loads the Kalam handwritten font and DM Sans for the UI. Requires internet access on the browser side. |

### AI Features & Models

BrainBoard uses **`claude-sonnet-4-20250514`** for all three AI calls. If this model is deprecated in the future, you will need to update the model string in `server.js` (search for `claude-sonnet` — it appears in three places).

| Feature | What AI Does |
|---|---|
| Suggest groupings | Groups all submitted notes into 4–8 named work streams based on the project context you provide. |
| Find duplicates | Identifies pairs or groups of notes that have the same intent even if worded differently. |
| Merge reformulation | When merging duplicates, writes a single clean sentence that captures the combined intent of the duplicate notes. |

---

## Repository File Structure

Your GitHub repository should contain exactly these files:

```
brainboard/
├── server.js          ← Main backend — all API routes and AI calls
├── package.json       ← Node.js dependencies declaration
└── public/
    └── index.html     ← The entire frontend — HTML, CSS, JavaScript
```

Railway serves `public/index.html` as the default page for any browser hitting the root URL (`/`). The `brainboard.db` file is created automatically on Railway's disk and is **not** in the repository.

---

## Railway Configuration

### Environment Variables

Set these in Railway under your service → Variables tab:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key from console.anthropic.com |
| `FACILITATOR_PASSWORD` | The password you chose for facilitator access |

Railway automatically injects `PORT` — do **not** set this manually, as it caused routing issues during setup.

### Networking

In Railway, under Settings → Networking, the domain must be generated and the port must be set to **8080** (Railway injects PORT=8080 by default). This was a critical issue during initial setup — if the app ever stops responding, check that the port shown next to the domain in Railway's networking settings still matches what the app is actually listening on.

### Auto-Deploy

Railway is connected to your GitHub repository and redeploys automatically whenever you push a commit. If auto-deploy stops working, go to Settings → Source in Railway and reconnect the GitHub repo.

---

## How to Update the Code

All code changes are made through the GitHub web interface — no local tools required.

1. Go to github.com and open your brainboard repository.
2. Click the file you want to edit (e.g. `server.js` or `public/index.html`).
3. Click the **pencil icon** (Edit this file) at the top right of the file view.
4. Select all (`Ctrl+A`), delete the content, and paste the new version.
5. Click **"Commit changes"** — Railway will detect the commit and redeploy automatically within about 60 seconds.

> ⚠️ When updating files, always replace the entire file content rather than editing individual lines. This avoids accidental duplicate variable declarations and other subtle bugs that were encountered during development.

---

## Troubleshooting

### App Won't Load

| Symptom | Likely Cause & Fix |
|---|---|
| `Cannot GET /` | `public/index.html` is missing or in the wrong location. Check GitHub: `index.html` must be inside a folder named `public/` at the repo root. |
| `Application failed to respond` | The port setting in Railway Networking doesn't match what the app is listening on. Go to Railway → Settings → Networking and set the port to **8080**. |
| App loads but shows blank / crashes | Check Railway Deploy Logs for a `SyntaxError`. Usually caused by a duplicate variable declaration when editing `server.js`. Replace the entire file to fix. |
| Railway not auto-deploying | GitHub connection dropped. Go to Railway → Settings → Source, disconnect and reconnect the GitHub repo. |

### AI Features Not Working

| Symptom | Likely Cause & Fix |
|---|---|
| "AI grouping failed: Failed to fetch" | Should not happen with the Railway setup. If it does, check that the frontend is being served from the same Railway domain (not from a local file). |
| AI grouping returns an error | Check that `ANTHROPIC_API_KEY` is set correctly in Railway Variables. Also verify the key has credits at console.anthropic.com. |
| Model deprecation error | The model has been deprecated. Search for `claude-sonnet` in `server.js` and update all three occurrences to the latest Sonnet model name from docs.anthropic.com. |
| Merge AI suggestion fails silently | Falls back to simple concatenation automatically. If it happens consistently, check Railway logs for the `/api/ai/merge` endpoint error. |

### Data Issues

| Symptom | Likely Cause & Fix |
|---|---|
| Notes disappeared after redeploy | Railway's disk is ephemeral on the free tier — a redeploy can wipe the SQLite file. Always export to CSV before making code changes. Consider upgrading to a paid Railway plan or migrating to Railway's PostgreSQL add-on for persistent storage. |
| Duplicate group buttons acting on wrong group | Fixed bug — make sure you are running the latest version of `index.html` which uses stable `gid` identifiers instead of positional array indices. |
| Notes not appearing for other participants | The frontend polls for new notes every 5 seconds. Wait a few seconds. If it persists, check the browser console for `/api/notes` errors. |

---

## ⚠️ Important Note on Data Persistence

Railway's free tier uses **ephemeral disk storage**. The SQLite database file (`brainboard.db`) may be wiped when Railway redeploys the app — which happens automatically on every GitHub commit.

**Always export your session to CSV before making any code changes.** Once you commit a code update to GitHub, Railway redeploys and the notes from any active session may be lost.

For a production-grade deployment where data must survive redeploys, the database should be migrated to Railway's PostgreSQL add-on. This would require updating `server.js` to use a PostgreSQL client (`pg` package) instead of `better-sqlite3`.

---

## Running Costs

| Service | Cost |
|---|---|
| Railway hosting | Free tier covers light usage. The app may sleep after inactivity — the first request can take 10–20 seconds to wake it. Paid plan (~$5/month) keeps it always-on. |
| Anthropic API | ~$0.003 per session. A $5 credit will last hundreds of sessions. |
| GitHub | Free for private repositories. |
| Google Fonts | Free. |

---

## Quick Reference

| Item | Value / Location |
|---|---|
| App URL | Your Railway domain — check Railway → Settings → Networking |
| Facilitator password | Railway → Variables → `FACILITATOR_PASSWORD` |
| API key management | console.anthropic.com |
| Code repository | github.com → your brainboard repo |
| Railway dashboard | railway.app — log in with GitHub |
| Model to update if deprecated | Search `claude-sonnet` in `server.js` (3 occurrences) |
| Port setting | **8080** — set in Railway → Settings → Networking |
| CSV export | Facilitator tab → Phase 2 board → Export CSV button |
| Reset between sessions | Facilitator tab → Phase 1 → Clear all button |

---

*BrainBoard — built with Claude*
