/**
 * API locale du prototype : catalogue, profil, collection, decks, duels.
 * Node + SQLite (node:sqlite), aucune dépendance serveur externe.
 *
 * Endpoints :
 *   GET    /api/health
 *   GET    /api/bootstrap
 *   PUT    /api/profile
 *   POST   /api/decks
 *   DELETE /api/decks/:id
 *   POST   /api/matches
 *   GET    /api/backup
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { CARDS } from '../src/engine/catalog'
import { PLAYER_DECK } from '../src/data/decks'
import { validateDeck } from '../src/engine/deck'
import { XP_REWARDS } from '../src/engine/progress'
import { EMPTY_PITY, openBoosterWithPity, packById, type PityState } from '../src/engine/economy'
import { SEED_QUANTITY } from '../src/data/seed'
import type { Deck } from '../src/engine/deck'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'data')
mkdirSync(DATA_DIR, { recursive: true })

const PORT = Number(process.env.PORT) || 8787
const DB_PATH = process.env.MV_DB ?? join(DATA_DIR, 'multiverse.db')

const db = new DatabaseSync(DB_PATH)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    jm INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS collection (
    card_id TEXT PRIMARY KEY,
    quantity INTEGER NOT NULL CHECK (quantity >= 0)
  );
  CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    main TEXT NOT NULL,
    extra TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    opponent TEXT NOT NULL,
    deck_name TEXT NOT NULL,
    result TEXT NOT NULL,
    turns INTEGER NOT NULL,
    reason TEXT NOT NULL,
    played_at TEXT NOT NULL,
    log TEXT
  );
`)

/** Ajoute une colonne si elle manque (migration douce des bases existantes). */
function ensureColumn(table: string, column: string, ddl: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
    console.log(`[api] migration : ${table}.${column}`)
  }
}

ensureColumn('matches', 'log', 'log TEXT')
ensureColumn('profile', 'pity_epic', 'pity_epic INTEGER NOT NULL DEFAULT 0')
ensureColumn('profile', 'pity_legendary', 'pity_legendary INTEGER NOT NULL DEFAULT 0')
ensureColumn('profile', 'pity_ultra', 'pity_ultra INTEGER NOT NULL DEFAULT 0')
ensureColumn('profile', 'elo', 'elo INTEGER NOT NULL DEFAULT 1000')
ensureColumn('profile', 'season_started_at', 'season_started_at TEXT')
ensureColumn('profile', 'avatar', 'avatar TEXT')

// Synchronise la collection avec le catalogue : les cartes ajoutées après la
// première initialisation sont créditées automatiquement.
{
  const insertMissing = db.prepare('INSERT OR IGNORE INTO collection (card_id, quantity) VALUES (?, ?)')
  let added = 0
  for (const card of CARDS) {
    const result = insertMissing.run(card.id, SEED_QUANTITY) as { changes?: number }
    added += result.changes ?? 0
  }
  if (added > 0) console.log(`[api] ${added} nouvelle(s) carte(s) ajoutée(s) à la collection`)
}

/* ------------------------------------------------------------------ */
/* Lecture / seed                                                      */
/* ------------------------------------------------------------------ */

interface ProfileRow {
  name: string
  avatar: string | null
  xp: number
  jm: number
  wins: number
  losses: number
  elo: number
  season_started_at: string | null
}

function readProfile() {
  const row = db
    .prepare('SELECT name, avatar, xp, jm, wins, losses, elo, season_started_at FROM profile WHERE id = 1')
    .get() as unknown as ProfileRow
  return {
    name: row.name,
    avatar: row.avatar ?? null,
    xp: row.xp,
    jm: row.jm,
    wins: row.wins,
    losses: row.losses,
    elo: row.elo,
    seasonStartedAt: row.season_started_at,
  }
}

function readCollection(): Array<{ cardId: string; quantity: number }> {
  const rows = db.prepare('SELECT card_id, quantity FROM collection ORDER BY card_id').all() as unknown as Array<{
    card_id: string
    quantity: number
  }>
  return rows.map((row) => ({ cardId: row.card_id, quantity: row.quantity }))
}

interface DeckRow {
  id: string
  name: string
  main: string
  extra: string
  updated_at: string
}

function readDecks(): Deck[] {
  const rows = db.prepare('SELECT id, name, main, extra, updated_at FROM decks ORDER BY updated_at ASC').all() as unknown as DeckRow[]
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    main: JSON.parse(row.main) as string[],
    extra: JSON.parse(row.extra) as string[],
    updatedAt: row.updated_at,
  }))
}

function readMatches(limit = 25) {
  // Conservation des replays : 90 jours (brief §11).
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  db.prepare('DELETE FROM matches WHERE played_at < ?').run(cutoff)
  const rows = db
    .prepare('SELECT id, opponent, deck_name, result, turns, reason, played_at, log FROM matches ORDER BY played_at DESC LIMIT ?')
    .all(limit) as unknown as Array<{
    id: string
    opponent: string
    deck_name: string
    result: string
    turns: number
    reason: string
    played_at: string
    log: string | null
  }>
  return rows.map((row) => ({
    id: row.id,
    opponent: row.opponent,
    deckName: row.deck_name,
    result: row.result,
    turns: row.turns,
    reason: row.reason,
    playedAt: row.played_at,
    log: row.log ? (JSON.parse(row.log) as string[]) : undefined,
  }))
}

function readPity(): PityState {
  const row = db
    .prepare('SELECT pity_epic, pity_legendary, pity_ultra FROM profile WHERE id = 1')
    .get() as unknown as { pity_epic: number; pity_legendary: number; pity_ultra: number } | undefined
  if (!row) return { ...EMPTY_PITY }
  return { epic: row.pity_epic, legendary: row.pity_legendary, ultra: row.pity_ultra }
}

const seeded = db.prepare('SELECT id FROM profile WHERE id = 1').get()
if (!seeded) {
  db.prepare(
    'INSERT INTO profile (id, name, xp, jm, wins, losses, created_at) VALUES (1, ?, 0, 500, 0, 0, ?)',
  ).run('Duelliste', new Date().toISOString())

  const insertCard = db.prepare('INSERT OR REPLACE INTO collection (card_id, quantity) VALUES (?, ?)')
  db.exec('BEGIN')
  try {
    for (const card of CARDS) insertCard.run(card.id, SEED_QUANTITY)
    db.prepare('INSERT OR REPLACE INTO decks (id, name, main, extra, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      PLAYER_DECK.id,
      PLAYER_DECK.name,
      JSON.stringify(PLAYER_DECK.main),
      JSON.stringify(PLAYER_DECK.extra),
      new Date().toISOString(),
    )
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  console.log(`[api] base initialisée (${CARDS.length} cartes seed, ${PLAYER_DECK.main.length} cartes de deck)`)
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > 1_000_000) throw new Error('Requête trop volumineuse')
    chunks.push(buffer)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

function bootstrap() {
  return {
    profile: readProfile(),
    collection: readCollection(),
    decks: readDecks(),
    matches: readMatches(),
    pity: readPity(),
    storage: 'sqlite' as const,
  }
}

async function handleApi(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  const method = req.method ?? 'GET'

  if (pathname === '/api/health' && method === 'GET') {
    sendJson(res, 200, { ok: true, storage: 'sqlite', cards: CARDS.length, uptime: process.uptime() })
    return
  }

  if (pathname === '/api/bootstrap' && method === 'GET') {
    sendJson(res, 200, bootstrap())
    return
  }

  if (pathname === '/api/profile' && method === 'PUT') {
    const body = await readBody(req)
    const name = String(body.name ?? '').trim().slice(0, 24)
    if (!name) {
      sendJson(res, 400, { error: 'Le nom ne peut pas être vide.' })
      return
    }
    db.prepare('UPDATE profile SET name = ? WHERE id = 1').run(name)
    if (body.avatar !== undefined) {
      const avatar = typeof body.avatar === 'string' && body.avatar ? body.avatar : null
      db.prepare('UPDATE profile SET avatar = ? WHERE id = 1').run(avatar)
    }
    if (typeof body.elo === 'number' && Number.isFinite(body.elo)) {
      const elo = Math.max(0, Math.min(10000, Math.round(body.elo)))
      db.prepare('UPDATE profile SET elo = ? WHERE id = 1').run(elo)
    }
    if (typeof body.seasonStartedAt === 'string') {
      db.prepare('UPDATE profile SET season_started_at = ? WHERE id = 1').run(body.seasonStartedAt)
    }
    sendJson(res, 200, { profile: readProfile() })
    return
  }

  if (pathname === '/api/decks' && method === 'POST') {
    const body = await readBody(req)
    const id = String(body.id ?? '')
    const name = String(body.name ?? '').trim().slice(0, 40)
    const main = Array.isArray(body.main) ? (body.main as string[]) : []
    const extra = Array.isArray(body.extra) ? (body.extra as string[]) : []

    if (!/^[a-zA-Z0-9_-]{3,64}$/.test(id)) {
      sendJson(res, 400, { error: 'Identifiant de deck invalide.' })
      return
    }
    if (!name) {
      sendJson(res, 400, { error: 'Le deck doit avoir un nom.' })
      return
    }
    const validation = validateDeck(main, extra)
    if (!validation.valid) {
      sendJson(res, 400, { error: validation.errors[0] ?? 'Deck invalide.' })
      return
    }
    db.prepare(
      'INSERT INTO decks (id, name, main, extra, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, main = excluded.main, extra = excluded.extra, updated_at = excluded.updated_at',
    ).run(id, name, JSON.stringify(main), JSON.stringify(extra), new Date().toISOString())
    sendJson(res, 200, { decks: readDecks() })
    return
  }

  if (pathname.startsWith('/api/decks/') && method === 'DELETE') {
    const id = decodeURIComponent(pathname.slice('/api/decks/'.length))
    db.prepare('DELETE FROM decks WHERE id = ?').run(id)
    sendJson(res, 200, { decks: readDecks() })
    return
  }

  if (pathname === '/api/matches' && method === 'POST') {
    const body = await readBody(req)
    const result = body.result === 'win' ? 'win' : body.result === 'loss' ? 'loss' : null
    if (!result) {
      sendJson(res, 400, { error: 'Résultat invalide.' })
      return
    }
    const turns = Math.max(1, Math.min(999, Number(body.turns) || 1))
    const opponent = String(body.opponent ?? 'IA').slice(0, 60)
    const deckName = String(body.deckName ?? 'Deck').slice(0, 60)
    const reason = String(body.reason ?? '').slice(0, 120)

    const profile = readProfile()
    const xpGain = result === 'win' ? XP_REWARDS.aiWin : XP_REWARDS.aiLoss
    const jmGain = result === 'win' ? 60 : 20
    const log = Array.isArray(body.log) ? (body.log as unknown[]).slice(0, 600).map((line) => String(line).slice(0, 200)) : null
    db.prepare('UPDATE profile SET xp = xp + ?, jm = jm + ?, wins = wins + ?, losses = losses + ? WHERE id = 1').run(
      xpGain,
      jmGain,
      result === 'win' ? 1 : 0,
      result === 'win' ? 0 : 1,
    )
    db.prepare(
      'INSERT INTO matches (id, opponent, deck_name, result, turns, reason, played_at, log) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      crypto.randomUUID(),
      opponent,
      deckName,
      result,
      turns,
      reason,
      new Date().toISOString(),
      log ? JSON.stringify(log) : null,
    )

    void profile
    sendJson(res, 200, { profile: readProfile(), matches: readMatches() })
    return
  }

  if (pathname === '/api/boosters' && method === 'POST') {
    const body = await readBody(req)
    const pack = packById(String(body.kind ?? ''))
    if (!pack) {
      sendJson(res, 400, { error: 'Booster inconnu.' })
      return
    }
    const profile = readProfile()
    if (profile.jm < pack.cost) {
      sendJson(res, 400, { error: 'Jetons Multivers insuffisants.' })
      return
    }
    const universe = typeof body.universe === 'string' ? body.universe.slice(0, 40) : undefined
    const seed = Number(body.seed) || Math.floor(Math.random() * 2 ** 31)
    const result = openBoosterWithPity({ kind: pack.id, universe, seed }, readPity())

    db.exec('BEGIN')
    try {
      db.prepare('UPDATE profile SET jm = jm - ? WHERE id = 1').run(pack.cost)
      db.prepare(
        'UPDATE profile SET pity_epic = ?, pity_legendary = ?, pity_ultra = ? WHERE id = 1',
      ).run(result.pity.epic, result.pity.legendary, result.pity.ultra)
      const upsert = db.prepare(
        'INSERT INTO collection (card_id, quantity) VALUES (?, 1) ON CONFLICT(card_id) DO UPDATE SET quantity = quantity + 1',
      )
      for (const card of result.cards) upsert.run(card.id)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    sendJson(res, 200, {
      profile: readProfile(),
      collection: readCollection(),
      pity: readPity(),
      cards: result.cards.map((card) => card.id),
      bestRarity: result.bestRarity,
      pityTriggered: result.pityTriggered,
    })
    return
  }

  if (pathname === '/api/backup' && method === 'GET') {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      ...bootstrap(),
    }
    const body = JSON.stringify(payload, null, 2)
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="multiverse-tcg-backup.json"`,
      'Content-Length': Buffer.byteLength(body),
    })
    res.end(body)
    return
  }

  sendJson(res, 404, { error: `Route inconnue: ${method} ${pathname}` })
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  const dist = join(ROOT, 'dist')
  if (!existsSync(dist)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end("Build absente : lancez `npm run dev` (Vite sur 5173) ou `npm run build`.")
    return
  }

  const safePath = pathname.replace(/\.\./g, '').replace(/^\/+/, '')
  let filePath = join(dist, safePath || 'index.html')
  if (!existsSync(filePath) || safePath === '') filePath = join(dist, 'index.html')

  try {
    const data = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
    })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Introuvable')
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url.pathname).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erreur serveur'
      console.error('[api]', message)
      sendJson(res, 500, { error: message })
    })
    return
  }
  serveStatic(res, url.pathname).catch(() => {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Erreur serveur')
  })
})

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[api] Le port ${PORT} est déjà utilisé.\n` +
        '      Une ancienne instance tourne probablement encore.\n' +
        '      Libérez les ports avec :  node scripts/free-ports.mjs --kill',
    )
    process.exit(1)
  }
  console.error('[api] erreur serveur :', error.message)
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] http://127.0.0.1:${PORT} — base ${DB_PATH}`)
})

const shutdown = () => {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Exporté pour les tests d'intégration éventuels.
export { server }
