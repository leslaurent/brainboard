const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const FACILITATOR_PASSWORD = process.env.FACILITATOR_PASSWORD || 'facilitator';

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY environment variable is not set.');
  process.exit(1);
}

// ── DATABASE SETUP ──
const db = new Database('brainboard.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    author TEXT NOT NULL,
    color TEXT NOT NULL,
    rot REAL NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS group_notes (
    group_id TEXT NOT NULL,
    note_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (group_id, note_id)
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Ensure revealed setting exists
const revealedRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('revealed');
if (!revealedRow) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('revealed', 'false');
}

// ── MIDDLEWARE ──
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── AUTH CHECK ──
function requireFacilitator(req, res, next) {
  const auth = req.headers['x-facilitator-password'];
  if (auth !== FACILITATOR_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── ROUTES ──

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Get facilitator password (just confirms it matches — never sends it back)
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  if (password === FACILITATOR_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Incorrect password' });
  }
});

// ── NOTES ──

// Get all notes
app.get('/api/notes', (req, res) => {
  const notes = db.prepare('SELECT * FROM notes ORDER BY created_at ASC').all();
  res.json(notes);
});

// Add a note
app.post('/api/notes', (req, res) => {
  const { id, text, author, color, rot } = req.body;
  if (!id || !text) return res.status(400).json({ error: 'id and text required' });
  db.prepare('INSERT INTO notes (id, text, author, color, rot) VALUES (?, ?, ?, ?, ?)')
    .run(id, text, author || 'Anonymous', color, rot);
  res.json({ ok: true });
});

// Delete a note (facilitator only)
app.delete('/api/notes/:id', requireFacilitator, (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM group_notes WHERE note_id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Delete all notes (facilitator only)
app.delete('/api/notes', requireFacilitator, (req, res) => {
  db.prepare('DELETE FROM notes').run();
  db.prepare('DELETE FROM group_notes').run();
  db.prepare('DELETE FROM groups').run();
  res.json({ ok: true });
});

// Update note text (facilitator only)
app.patch('/api/notes/:id', requireFacilitator, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  db.prepare('UPDATE notes SET text = ? WHERE id = ?').run(text, req.params.id);
  res.json({ ok: true });
});

// ── GROUPS ──

// Get all groups with their note IDs
app.get('/api/groups', (req, res) => {
  const groups = db.prepare('SELECT * FROM groups ORDER BY position ASC').all();
  const groupsWithNotes = groups.map(g => ({
    ...g,
    noteIds: db.prepare(
      'SELECT note_id FROM group_notes WHERE group_id = ? ORDER BY position ASC'
    ).all(g.id).map(r => r.note_id)
  }));
  res.json(groupsWithNotes);
});

// Save all groups (replaces existing)
app.post('/api/groups', requireFacilitator, (req, res) => {
  const { groups } = req.body;
  if (!Array.isArray(groups)) return res.status(400).json({ error: 'groups array required' });

  db.prepare('DELETE FROM groups').run();
  db.prepare('DELETE FROM group_notes').run();

  const insertGroup = db.prepare('INSERT INTO groups (id, name, color, position) VALUES (?, ?, ?, ?)');
  const insertNote = db.prepare('INSERT INTO group_notes (group_id, note_id, position) VALUES (?, ?, ?)');

  const saveAll = db.transaction(() => {
    groups.forEach((g, i) => {
      insertGroup.run(g.id, g.name, g.color, i);
      (g.noteIds || []).forEach((nid, j) => {
        insertNote.run(g.id, nid, j);
      });
    });
  });
  saveAll();
  res.json({ ok: true });
});

// Rename a group (facilitator only)
app.patch('/api/groups/:id', requireFacilitator, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ ok: true });
});

// Delete a group (facilitator only)
app.delete('/api/groups/:id', requireFacilitator, (req, res) => {
  db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM group_notes WHERE group_id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── SETTINGS ──

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

app.patch('/api/settings', requireFacilitator, (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
  res.json({ ok: true });
});

// ── AI GROUPING ──
app.post('/api/ai/group', requireFacilitator, async (req, res) => {
  const { context } = req.body;
  const notes = db.prepare('SELECT * FROM notes ORDER BY created_at ASC').all();

  if (notes.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 notes to group.' });
  }

  const notesList = notes.map(n => `- [${n.id}] ${n.text}`).join('\n');
  const prompt = `You are helping a cross-functional project team organize brainstormed tasks into logical work areas.
${context ? '\nProject context: ' + context : ''}

Here are the tasks submitted by the team (each has an ID in brackets):
${notesList}

Group these tasks into 4–8 logical work areas / workstreams.
Return ONLY valid JSON — no explanation, no markdown fences, nothing else:
{"groups":[{"name":"Short Group Name","noteIds":["id1","id2"]},…]}

Rules:
- Every task ID must appear in exactly one group — no omissions
- Group names should be short, action-oriented (2–4 words), relevant to the project context if given
- If tasks are very similar or identical, place them in the same group`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const raw = data.content?.find(b => b.type === 'text')?.text || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in AI response');

    const parsed = JSON.parse(match[0]);
    res.json(parsed);
  } catch (err) {
    console.error('AI grouping error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── START ──
app.listen(PORT, () => {
  console.log(`BrainBoard server running on port ${PORT}`);
});
