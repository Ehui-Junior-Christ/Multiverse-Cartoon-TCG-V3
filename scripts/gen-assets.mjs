/**
 * Génère les illustrations placeholder (SVG) et les fonds d'interface.
 *
 * Les assets fournis par le propriétaire remplaceront ces fichiers sans
 * changement de code, en conservant les noms stables :
 *   public/assets/cards/{dossier}/{card-id}.svg|webp
 *
 * Commande : npm run assets
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cards = JSON.parse(readFileSync(resolve(ROOT, 'src/data/cards.json'), 'utf8'))
const universes = JSON.parse(readFileSync(resolve(ROOT, 'src/data/universes.json'), 'utf8'))

const FOLDER = {
  character: 'characters',
  terrain: 'terrains',
  technique: 'techniques',
  equipment: 'equipments',
  support: 'supports',
  magic: 'magics',
  trap: 'traps',
  special: 'specials',
}

const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return Math.abs(h)
}

const initials = (name) =>
  name
    .replace(/[^\p{L}\s'-]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

const palette = (hue) => {
  const h2 = (hue + 28) % 360
  return {
    deep: `hsl(${hue} 62% 9%)`,
    mid: `hsl(${hue} 74% 32%)`,
    glow: `hsl(${h2} 92% 62%)`,
    light: `hsl(${h2} 96% 78%)`,
  }
}

function art(card) {
  const u = universes.find((x) => x.id === card.universe) ?? universes[0]
  const p = palette(u.hue)
  const h = hash(card.id)
  const w = 512
  const hgt = card.category === 'terrain' ? 288 : 512
  const cx = w / 2 + ((h % 80) - 40)
  const cy = hgt * 0.46
  const r = 96 + (h % 46)
  const rings = Array.from({ length: 3 }, (_, i) => {
    const rr = r + 42 * (i + 1)
    return `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="rgba(255,255,255,${0.16 - i * 0.04})" stroke-width="${2 - i * 0.4}" stroke-dasharray="${6 + i * 4} ${10 + i * 6}" />`
  }).join('')
  const shards = Array.from({ length: 7 }, (_, i) => {
    const a = ((h >> (i * 3)) % 360) * (Math.PI / 180)
    const rad = r + 30 + (i % 4) * 34
    const x = cx + Math.cos(a) * rad
    const y = cy + Math.sin(a) * rad * 0.72
    const size = 7 + ((h >> i) % 16)
    return `<polygon points="${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}" fill="${p.light}" opacity="${0.18 + (i % 3) * 0.08}" />`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}" role="img" aria-label="Illustration placeholder de ${escapeXml(card.name)}">
  <defs>
    <radialGradient id="bg" cx="${(h % 30) + 35}%" cy="${(h % 20) + 30}%" r="85%">
      <stop offset="0%" stop-color="${p.glow}" />
      <stop offset="45%" stop-color="${p.mid}" />
      <stop offset="100%" stop-color="${p.deep}" />
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="46%" r="52%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5" />
      <stop offset="60%" stop-color="${p.light}" stop-opacity="0.12" />
      <stop offset="100%" stop-color="${p.light}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0" />
      <stop offset="100%" stop-color="#000" stop-opacity="0.72" />
    </linearGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.4" fill="#fff" opacity="0.16" />
    </pattern>
  </defs>
  <rect width="${w}" height="${hgt}" fill="url(#bg)" />
  <rect width="${w}" height="${hgt}" fill="url(#dots)" />
  <rect width="${w}" height="${hgt}" fill="url(#halo)" />
  ${rings}
  <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="rgba(8,10,26,0.42)" stroke="${p.light}" stroke-opacity="0.4" stroke-width="2" />
  <text x="${cx}" y="${cy + 26}" text-anchor="middle" font-family="Chakra Petch, Impact, sans-serif" font-size="${r * 0.52}" font-weight="700" fill="${p.light}" opacity="0.92">${escapeXml(initials(card.name))}</text>
  ${shards}
  <text x="${w / 2}" y="${hgt - 42}" text-anchor="middle" font-family="Chakra Petch, sans-serif" font-size="19" letter-spacing="5" fill="#fff" opacity="0.62">${escapeXml(u.name.toUpperCase())}</text>
  <text x="${w / 2}" y="${hgt - 18}" text-anchor="middle" font-family="Chakra Petch, sans-serif" font-size="14" letter-spacing="3" fill="#fff" opacity="0.35">${escapeXml(u.glyph)} PLACEHOLDER ${escapeXml(card.id.toUpperCase())}</text>
  <rect width="${w}" height="${hgt}" fill="url(#floor)" />
</svg>
`
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[ch]))
}

let written = 0
for (const card of cards) {
  const dir = resolve(ROOT, 'public/assets/cards', FOLDER[card.category] ?? 'misc')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, `${card.id}.svg`), art(card), 'utf8')
  written++
}

// Dos de carte + favicon
const uiDir = resolve(ROOT, 'public/assets/ui')
mkdirSync(uiDir, { recursive: true })
writeFileSync(
  resolve(uiDir, 'card-back.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="b" cx="50%" cy="45%" r="70%">
      <stop offset="0%" stop-color="#2b2f7a" />
      <stop offset="55%" stop-color="#161a45" />
      <stop offset="100%" stop-color="#070914" />
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="34" fill="url(#b)" />
  <rect x="18" y="18" width="476" height="476" rx="26" fill="none" stroke="#e6c377" stroke-opacity="0.75" stroke-width="3" />
  <rect x="32" y="32" width="448" height="448" rx="20" fill="none" stroke="#7ee7ff" stroke-opacity="0.28" stroke-width="1.5" />
  <circle cx="256" cy="240" r="86" fill="none" stroke="#e6c377" stroke-opacity="0.8" stroke-width="2" />
  <circle cx="256" cy="240" r="60" fill="none" stroke="#7ee7ff" stroke-opacity="0.55" stroke-width="1.5" stroke-dasharray="7 9" />
  <path d="M256 168 L318 240 L256 312 L194 240 Z" fill="none" stroke="#ffe9b0" stroke-opacity="0.9" stroke-width="2" />
  <text x="256" y="252" text-anchor="middle" font-family="Chakra Petch, sans-serif" font-size="30" fill="#ffe9b0" opacity="0.9">MV</text>
  <text x="256" y="418" text-anchor="middle" font-family="Chakra Petch, sans-serif" font-size="17" letter-spacing="6" fill="#9fb4ff" opacity="0.75">MULTIVERSE</text>
</svg>
`,
  'utf8',
)
writeFileSync(
  resolve(uiDir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0b0f22" />
  <path d="M32 8 L54 32 L32 56 L10 32 Z" fill="none" stroke="#e6c377" stroke-width="3" />
  <path d="M32 20 L44 32 L32 44 L20 32 Z" fill="#7ee7ff" fill-opacity="0.5" stroke="#7ee7ff" stroke-width="2" />
</svg>
`,
  'utf8',
)

console.log(`Assets générés : ${written} illustrations + dos de carte + favicon`)
