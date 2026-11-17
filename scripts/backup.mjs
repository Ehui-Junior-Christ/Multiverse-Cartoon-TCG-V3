/**
 * Sauvegarde locale de la base SQLite.
 *  - copie binaire de data/multiverse.db dans data/backups/
 *  - export JSON lisible (profil, collection, decks, duels)
 *
 * Commande : npm run backup
 * Restauration : arrêter l'application, puis remplacer data/multiverse.db
 * par la copie souhaitée (voir README).
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DB_PATH = process.env.MV_DB ?? join(ROOT, 'data', 'multiverse.db')
const BACKUP_DIR = join(ROOT, 'data', 'backups')

if (!existsSync(DB_PATH)) {
  console.error(`Aucune base à sauvegarder : ${DB_PATH}`)
  process.exit(1)
}

mkdirSync(BACKUP_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const binaryCopy = join(BACKUP_DIR, `multiverse-${stamp}.db`)
copyFileSync(DB_PATH, binaryCopy)

const db = new DatabaseSync(DB_PATH, { readOnly: true })
const dump = {
  exportedAt: new Date().toISOString(),
  profile: db.prepare('SELECT name, xp, jm, wins, losses FROM profile WHERE id = 1').get(),
  collection: db.prepare('SELECT card_id, quantity FROM collection').all(),
  decks: db
    .prepare('SELECT id, name, main, extra, updated_at FROM decks')
    .all()
    .map((row) => ({ ...row, main: JSON.parse(row.main), extra: JSON.parse(row.extra) })),
  matches: db.prepare('SELECT * FROM matches ORDER BY played_at DESC').all(),
}
const jsonCopy = join(BACKUP_DIR, `multiverse-${stamp}.json`)
writeFileSync(jsonCopy, JSON.stringify(dump, null, 2), 'utf8')
db.close()

console.log(`Sauvegarde binaire : ${binaryCopy}`)
console.log(`Export JSON       : ${jsonCopy}`)
