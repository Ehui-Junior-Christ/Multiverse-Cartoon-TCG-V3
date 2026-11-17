/**
 * Construit src/data/art-manifest.json : la liste des illustrations réellement
 * présentes dans public/assets/cards.
 *
 * Déposez une image nommée `<card-id>.png|jpg|jpeg|webp|svg` dans
 * public/assets/cards/<dossier>/ puis lancez `npm run art` : la carte
 * l'affiche automatiquement. Les formats raster priment sur le SVG placeholder.
 *
 * Commande : npm run art   (aussi exécutée avant `dev` et `build`)
 */
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CARDS_DIR = resolve(ROOT, 'public/assets/cards')
const OUT = resolve(ROOT, 'src/data/art-manifest.json')

/** Priorité : une vraie illustration remplace le placeholder SVG. */
const PRIORITY = { '.webp': 5, '.jpg': 4, '.jpeg': 4, '.png': 3, '.svg': 1 }

const manifest = {}

function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full)
      continue
    }
    const ext = extname(entry).toLowerCase()
    if (!(ext in PRIORITY)) continue
    const cardId = basename(entry, ext)
    const url = '/assets/cards/' + full.slice(CARDS_DIR.length + 1).split('\\').join('/')
    const current = manifest[cardId]
    if (!current || PRIORITY[ext] > current.priority) {
      manifest[cardId] = { priority: PRIORITY[ext], url }
    }
  }
}

walk(CARDS_DIR)

const output = {}
for (const key of Object.keys(manifest).sort()) output[key] = manifest[key].url

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8')

const total = Object.keys(output).length
const real = Object.values(output).filter((url) => !url.endsWith('.svg')).length
console.log(`[art] ${total} illustrations indexées (${real} réelles, ${total - real} placeholders SVG).`)
console.log(`[art] écrit ${OUT}`)
