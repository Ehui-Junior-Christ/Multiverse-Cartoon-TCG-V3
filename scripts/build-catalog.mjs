/**
 * Générateur du catalogue de démonstration (120 cartes).
 *
 * Source unique de vérité pour les données de cartes : le fichier généré
 * `src/data/cards.json` est consommé par le moteur (client + serveur).
 * Les effets sont déclaratifs et limités au vocabulaire d'opérations supporté
 * par le moteur (`src/engine/ops.ts`) : aucune carte ne peut exécuter de code.
 *
 * Commande : npm run catalog
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const UNIVERSES = [
  { id: 'ben10', name: 'Ben 10', hue: 148, glyph: '⌬' },
  { id: 'adventure', name: 'Adventure Time', hue: 188, glyph: '❖' },
  { id: 'powerpuff', name: 'Les Super Nanas', hue: 328, glyph: '✿' },
  { id: 'titans', name: 'Teen Titans', hue: 264, glyph: '✦' },
  { id: 'bottom', name: 'Bikini Bottom', hue: 44, glyph: '≈' },
  { id: 'tomjerry', name: 'Tom & Jerry', hue: 14, glyph: '✷' },
  { id: 'scooby', name: 'Scooby-Doo', hue: 96, glyph: '❂' },
  { id: 'looney', name: 'Looney Tunes', hue: 214, glyph: '✺' },
]

const RARITIES = ['common', 'rare', 'epic', 'legendary', 'ultra']

let seq = 0
const nid = (prefix) => `${prefix}-${String(++seq).padStart(3, '0')}`

/** ATK-based tribute cost (sacrifice) — rule stored in docs/GAME_RULES.md §3. */
const tributeFor = (atk) => (atk >= 2600 ? 2 : atk >= 2000 ? 1 : 0)

/**
 * @param {object} o
 */
const character = ({ id, name, universe, pop, atk, def, rarity, text, tags = [], keywords = [], fx = [], signature }) => ({
  id,
  name,
  universe,
  category: 'character',
  rarity,
  popularity: pop,
  atk,
  def,
  tributes: tributeFor(atk),
  tags,
  keywords,
  text,
  fx,
  signature,
})

const backrow = ({ id, name, universe, category, subcategory, rarity, text, tags = [], fx = [], keywords = [], speed = 1, persistent = false, lpCost = 0 }) => ({
  id,
  name,
  universe,
  category,
  subcategory,
  rarity,
  tags,
  keywords,
  text,
  speed,
  persistent,
  lpCost,
  fx,
})

const special = ({ id, name, universe, rarity, kind, text, atk, def, pop, requires, signature }) => ({
  id,
  name,
  universe,
  category: 'special',
  subcategory: kind,
  rarity,
  popularity: pop,
  atk,
  def,
  tags: [],
  keywords: [],
  text,
  special: { kind, requires },
  signature,
})

/* ------------------------------------------------------------------ */
/* 48 personnages — 6 par univers                                      */
/* ------------------------------------------------------------------ */

const characters = [
  // Ben 10
  character({
    id: 'chr-ben-tenyson', name: 'Ben Tennyson', universe: 'ben10', pop: 9, atk: 1800, def: 1400, rarity: 'rare',
    tags: ['héros', 'humain'], text: "Lorsqu'il est invoqué, piochez 1 carte.",
    fx: [{ id: 'onSummon', trigger: 'onSummon', mandatory: true, ops: [{ op: 'draw', amount: 1 }] }],
    signature: "C'est l'heure de passer en mode héros.",
  }),
  character({
    id: 'chr-quatre-bras', name: 'Quatre Bras', universe: 'ben10', pop: 8, atk: 2400, def: 1600, rarity: 'epic',
    tags: ['héros', 'alien'], keywords: ['piercing'],
    text: 'Transperce : lorsqu\'il détruit un personnage en défense, son contrôleur subit la différence de statistiques en LP.',
  }),
  character({
    id: 'chr-xlr8', name: 'XLR8', universe: 'ben10', pop: 7, atk: 1600, def: 1000, rarity: 'common',
    tags: ['héros', 'alien'], keywords: ['doubleAttack'],
    text: 'Attaque double : peut attaquer deux fois par tour.',
  }),
  character({
    id: 'chr-surchauffe', name: 'Surchauffe', universe: 'ben10', pop: 9, atk: 2100, def: 1500, rarity: 'rare',
    tags: ['héros', 'alien'], fx: [{
      id: 'burn', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 500 }],
      text: 'Une fois par tour : inflige 500 dégâts.',
    }], text: 'Une fois par tour, pendant votre Main Phase : infligez 500 dégâts à l\'adversaire.',
  }),
  character({
    id: 'chr-diamantane', name: 'Diamantane', universe: 'ben10', pop: 8, atk: 2000, def: 2200, rarity: 'rare',
    tags: ['héros', 'alien'], keywords: ['destroyImmune'],
    text: 'Immunité à la destruction : ne peut pas être détruit par des effets.',
  }),
  character({
    id: 'chr-waybig', name: 'Way Big', universe: 'ben10', pop: 12, atk: 3000, def: 2600, rarity: 'legendary',
    tags: ['héros', 'alien'], fx: [{
      id: 'impact', trigger: 'onSummon', mandatory: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 600 }],
    }], text: "Lorsqu'il est invoqué, infligez 600 dégâts à l'adversaire.",
  }),

  // Adventure Time
  character({
    id: 'chr-finn', name: 'Finn l\'humain', universe: 'adventure', pop: 9, atk: 1900, def: 1500, rarity: 'rare',
    tags: ['héros', 'humain'], fx: [{ id: 'onSummon', trigger: 'onSummon', mandatory: true, ops: [{ op: 'draw', amount: 1 }] }],
    text: "Lorsqu'il est invoqué, piochez 1 carte.",
  }),
  character({
    id: 'chr-jake', name: 'Jake le chien', universe: 'adventure', pop: 8, atk: 1700, def: 2000, rarity: 'common',
    tags: ['héros', 'créature'], fx: [{
      id: 'stretch', trigger: 'activate', speed: 1, oncePerTurn: true, target: 'source',
      ops: [{ op: 'buff', target: 'self', duration: 'turn', def: 300 }],
      text: 'Une fois par tour : +300 DEF jusqu\'à la fin du tour.',
    }], text: 'Une fois par tour : ce personnage gagne +300 DEF jusqu\'à la fin du tour.',
  }),
  character({
    id: 'chr-marceline', name: 'Marceline', universe: 'adventure', pop: 9, atk: 2200, def: 1300, rarity: 'epic',
    tags: ['héros', 'vampire'], fx: [{
      id: 'song', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'discard', who: 'opponent', amount: 1 }],
      text: "L'adversaire défausse 1 carte.",
    }], text: "Une fois par tour : l'adversaire défausse 1 carte au hasard.",
  }),
  character({
    id: 'chr-chewing-gum', name: 'Princesse Chewing-Gum', universe: 'adventure', pop: 10, atk: 1600, def: 1800, rarity: 'rare',
    tags: ['héros', 'royauté'], fx: [{ id: 'onSummon', trigger: 'onSummon', mandatory: true, ops: [{ op: 'heal', amount: 400 }] }],
    text: "Lorsqu'elle est invoquée, gagnez 400 LP.",
  }),
  character({
    id: 'chr-roi-des-glaces', name: 'Le Roi des Glaces', universe: 'adventure', pop: 8, atk: 1800, def: 1600, rarity: 'common',
    tags: ['vilain', 'glace'], fx: [{
      id: 'frost', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 300 }],
      text: 'Inflige 300 dégâts.',
    }], text: 'Une fois par tour : infligez 300 dégâts à l\'adversaire.',
  }),
  character({
    id: 'chr-lich', name: 'Le Lich', universe: 'adventure', pop: 11, atk: 2600, def: 2000, rarity: 'ultra',
    tags: ['vilain', 'mort-vivant'], fx: [{
      id: 'curse', trigger: 'onDestroyed', mandatory: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 700 }],
    }], text: "Lorsqu'il est détruit, infligez 700 dégâts à l'adversaire.",
  }),

  // Les Super Nanas
  character({
    id: 'chr-bulle', name: 'Bulle', universe: 'powerpuff', pop: 9, atk: 1900, def: 1600, rarity: 'rare',
    tags: ['héros', 'héroïne'], fx: [{ id: 'onSummon', trigger: 'onSummon', mandatory: true, ops: [{ op: 'heal', amount: 300 }] }],
    text: "Lorsqu'elle est invoquée, gagnez 300 LP.",
  }),
  character({
    id: 'chr-belles', name: 'Belles', universe: 'powerpuff', pop: 9, atk: 1800, def: 1800, rarity: 'rare',
    tags: ['héros', 'héroïne'], fx: [{
      id: 'idea', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'draw', amount: 1 }], text: 'Piochez 1 carte.',
    }], text: 'Une fois par tour : piochez 1 carte.',
  }),
  character({
    id: 'chr-buttercup', name: 'Buttercup', universe: 'powerpuff', pop: 9, atk: 2100, def: 1400, rarity: 'epic',
    tags: ['héros', 'héroïne'], keywords: ['piercing'],
    text: 'Transperce : lorsqu\'elle détruit un personnage en défense, son contrôleur subit la différence en LP.',
  }),
  character({
    id: 'chr-utonium', name: 'Professeur Utonium', universe: 'powerpuff', pop: 7, atk: 900, def: 1600, rarity: 'common',
    tags: ['savant', 'soutien'], fx: [{
      id: 'boost', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 300 }],
      text: 'Vos personnages gagnent +300 ATK jusqu\'à la fin du tour.',
    }], text: 'Une fois par tour : vos personnages gagnent +300 ATK jusqu\'à la fin du tour.',
  }),
  character({
    id: 'chr-mojo-jojo', name: 'Mojo Jojo', universe: 'powerpuff', pop: 10, atk: 2200, def: 1500, rarity: 'epic',
    tags: ['vilain', 'singe'], fx: [{
      id: 'scheme', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 500 }], text: 'Inflige 500 dégâts.',
    }], text: 'Une fois par tour : infligez 500 dégâts à l\'adversaire.',
  }),
  character({
    id: 'chr-lui', name: 'Lui', universe: 'powerpuff', pop: 11, atk: 2700, def: 2100, rarity: 'legendary',
    tags: ['vilain', 'démon'], fx: [{
      id: 'exile', trigger: 'onSummon', mandatory: true,
      ops: [{ op: 'banishTop', who: 'opponent', amount: 2 }],
    }], text: "Lorsqu'il est invoqué, bannissez les 2 cartes du dessus du deck adverse.",
  }),

  // Teen Titans
  character({
    id: 'chr-robin', name: 'Robin', universe: 'titans', pop: 9, atk: 1800, def: 1500, rarity: 'rare',
    tags: ['héros', 'humain'], fx: [{ id: 'onSummon', trigger: 'onSummon', mandatory: true, ops: [{ op: 'draw', amount: 1 }] }],
    text: "Lorsqu'il est invoqué, piochez 1 carte.",
  }),
  character({
    id: 'chr-starfire', name: 'Starfire', universe: 'titans', pop: 9, atk: 2200, def: 1400, rarity: 'epic',
    tags: ['héros', 'alien'], fx: [{
      id: 'starbolt', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 400 }], text: 'Inflige 400 dégâts.',
    }], text: 'Une fois par tour : infligez 400 dégâts à l\'adversaire.',
  }),
  character({
    id: 'chr-raven', name: 'Raven', universe: 'titans', pop: 10, atk: 1700, def: 2100, rarity: 'rare',
    tags: ['héros', 'magie'], keywords: ['destroyImmune'], fx: [{
      id: 'calm', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'heal', amount: 500 }], text: 'Gagnez 500 LP.',
    }], text: 'Immunisée à la destruction par effet. Une fois par tour : gagnez 500 LP.',
  }),
  character({
    id: 'chr-cyborg', name: 'Cyborg', universe: 'titans', pop: 8, atk: 2300, def: 1900, rarity: 'epic',
    tags: ['héros', 'machine'], keywords: ['piercing'],
    text: 'Transperce : lorsqu\'il détruit un personnage en défense, son contrôleur subit la différence en LP.',
  }),
  character({
    id: 'chr-beast-boy', name: 'Beast Boy', universe: 'titans', pop: 8, atk: 1500, def: 1200, rarity: 'common',
    tags: ['héros', 'métamorphe'], fx: [{
      id: 'shift', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'buff', target: 'self', duration: 'turn', atk: 400 }],
      text: '+400 ATK jusqu\'à la fin du tour.',
    }], text: 'Une fois par tour : ce personnage gagne +400 ATK jusqu\'à la fin du tour.',
  }),
  character({
    id: 'chr-deathstroke', name: 'Deathstroke', universe: 'titans', pop: 11, atk: 2500, def: 1900, rarity: 'legendary',
    tags: ['vilain', 'mercenaire'], fx: [{
      id: 'vendetta', trigger: 'onDestroyed', mandatory: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 800 }],
    }], text: "Lorsqu'il est détruit, infligez 800 dégâts à l'adversaire.",
  }),

  // Bikini Bottom
  character({
    id: 'chr-bob', name: 'Bob l\'éponge', universe: 'bottom', pop: 10, atk: 1200, def: 1500, rarity: 'common',
    tags: ['comique', 'héros'], fx: [{ id: 'onSummon', trigger: 'onSummon', mandatory: true, ops: [{ op: 'draw', amount: 1 }] }],
    text: "Lorsqu'il est invoqué, piochez 1 carte.",
  }),
  character({
    id: 'chr-patrick', name: 'Patrick Étoile', universe: 'bottom', pop: 9, atk: 1500, def: 1700, rarity: 'common',
    tags: ['comique', 'soutien'], fx: [{
      id: 'cheer', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', def: 300 }],
      text: 'Vos personnages gagnent +300 DEF jusqu\'à la fin du tour.',
    }], text: 'Une fois par tour : vos personnages gagnent +300 DEF jusqu\'à la fin du tour.',
  }),
  character({
    id: 'chr-carlo', name: 'Carlo', universe: 'bottom', pop: 8, atk: 1300, def: 1900, rarity: 'common',
    tags: ['comique', 'soutien'], fx: [{
      id: 'clarinet', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 200 }], text: 'Inflige 200 dégâts.',
    }], text: 'Une fois par tour : infligez 200 dégâts à l\'adversaire.',
  }),
  character({
    id: 'chr-krabs', name: 'M. Krabs', universe: 'bottom', pop: 8, atk: 1100, def: 1600, rarity: 'rare',
    tags: ['comique', 'marchand'], fx: [{ id: 'profit', trigger: 'onSummon', mandatory: true, ops: [{ op: 'heal', amount: 600 }] }],
    text: "Lorsqu'il est invoqué, gagnez 600 LP.",
  }),
  character({
    id: 'chr-plankton', name: 'Plankton', universe: 'bottom', pop: 7, atk: 1000, def: 1200, rarity: 'common',
    tags: ['vilain', 'savant'], fx: [{
      id: 'device', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 300 }], text: 'Inflige 300 dégâts.',
    }], text: 'Une fois par tour : infligez 300 dégâts à l\'adversaire.',
  }),
  character({
    id: 'chr-neptune', name: 'Roi Neptune', universe: 'bottom', pop: 11, atk: 2600, def: 2400, rarity: 'legendary',
    tags: ['royauté', 'comique'], keywords: ['destroyImmune'],
    text: 'Immunité à la destruction : ne peut pas être détruit par des effets.',
  }),

  // Tom & Jerry
  character({
    id: 'chr-tom', name: 'Tom', universe: 'tomjerry', pop: 10, atk: 1700, def: 1400, rarity: 'common',
    tags: ['comique', 'chat'], keywords: ['doubleAttack'], text: 'Attaque double : peut attaquer deux fois par tour.',
  }),
  character({
    id: 'chr-jerry', name: 'Jerry', universe: 'tomjerry', pop: 10, atk: 1200, def: 1600, rarity: 'common',
    tags: ['comique', 'souris'], keywords: ['targetImmune'],
    text: 'Ciblage impossible : ne peut pas être ciblé par les effets adverses.',
  }),
  character({
    id: 'chr-spike', name: 'Spike', universe: 'tomjerry', pop: 7, atk: 2000, def: 1700, rarity: 'rare',
    tags: ['comique', 'chien'], keywords: ['piercing'],
    text: 'Transperce : lorsqu\'il détruit un personnage en défense, son contrôleur subit la différence en LP.',
  }),
  character({
    id: 'chr-tuffy', name: 'Tuffy', universe: 'tomjerry', pop: 6, atk: 900, def: 1300, rarity: 'common',
    tags: ['comique', 'souris'], fx: [{
      id: 'plan', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'draw', amount: 1 }], text: 'Piochez 1 carte.',
    }], text: 'Une fois par tour : piochez 1 carte.',
  }),
  character({
    id: 'chr-butch', name: 'Butch le chat', universe: 'tomjerry', pop: 8, atk: 1900, def: 1500, rarity: 'rare',
    tags: ['comique', 'chat'], fx: [{
      id: 'claw', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 400 }], text: 'Inflige 400 dégâts.',
    }], text: 'Une fois par tour : infligez 400 dégâts à l\'adversaire.',
  }),
  character({
    id: 'chr-mecat', name: 'Mécat', universe: 'tomjerry', pop: 9, atk: 2400, def: 2000, rarity: 'epic',
    tags: ['comique', 'machine'], fx: [{
      id: 'selfdestruct', trigger: 'onDestroyed', mandatory: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 500 }],
    }], text: "Lorsqu'il est détruit, infligez 500 dégâts à l'adversaire.",
  }),

  // Scooby-Doo
  character({
    id: 'chr-scooby', name: 'Scooby-Doo', universe: 'scooby', pop: 11, atk: 1400, def: 1800, rarity: 'rare',
    tags: ['héros', 'chien'], keywords: ['targetImmune'],
    text: 'Ciblage impossible : ne peut pas être ciblé par les effets adverses.',
  }),
  character({
    id: 'chr-sammy', name: 'Sammy', universe: 'scooby', pop: 10, atk: 1200, def: 1500, rarity: 'common',
    tags: ['comique', 'humain'], fx: [{
      id: 'snack', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'heal', amount: 400 }], text: 'Gagnez 400 LP.',
    }], text: 'Une fois par tour : gagnez 400 LP.',
  }),
  character({
    id: 'chr-daphne', name: 'Daphné', universe: 'scooby', pop: 8, atk: 1100, def: 1400, rarity: 'common',
    tags: ['héros', 'humain'], fx: [{
      id: 'clue', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'draw', amount: 1 }], text: 'Piochez 1 carte.',
    }], text: 'Une fois par tour : piochez 1 carte.',
  }),
  character({
    id: 'chr-vera', name: 'Vera', universe: 'scooby', pop: 9, atk: 1000, def: 1700, rarity: 'rare',
    tags: ['héros', 'savant'], fx: [{
      id: 'analyse', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 200 }],
      text: 'Vos personnages gagnent +200 ATK jusqu\'à la fin du tour.',
    }], text: 'Une fois par tour : vos personnages gagnent +200 ATK jusqu\'à la fin du tour.',
  }),
  character({
    id: 'chr-fred', name: 'Fred', universe: 'scooby', pop: 8, atk: 1600, def: 1500, rarity: 'common',
    tags: ['héros', 'humain'], fx: [{
      id: 'trap', trigger: 'activate', speed: 1, oncePerTurn: true,
      ops: [{ op: 'buff', target: 'self', duration: 'turn', atk: 300 }],
      text: '+300 ATK jusqu\'à la fin du tour.',
    }], text: 'Une fois par tour : ce personnage gagne +300 ATK jusqu\'à la fin du tour.',
  }),
  character({
    id: 'chr-scrappy', name: 'Scrappy', universe: 'scooby', pop: 6, atk: 1500, def: 1100, rarity: 'common',
    tags: ['héros', 'chien'], keywords: ['doubleAttack'], text: 'Attaque double : peut attaquer deux fois par tour.',
  }),

  // Looney Tunes
  character({
    id: 'chr-bugs', name: 'Bugs Bunny', universe: 'looney', pop: 12, atk: 2000, def: 1800, rarity: 'legendary',
    tags: ['comique', 'héros'], keywords: ['targetImmune'],
    text: 'Ciblage impossible : ne peut pas être ciblé par les effets adverses.',
    signature: 'Quoi de neuf, docteur ?',
  }),
  character({
    id: 'chr-daffy', name: 'Daffy Duck', universe: 'looney', pop: 10, atk: 1700, def: 1300, rarity: 'rare',
    tags: ['comique'], keywords: ['doubleAttack'], text: 'Attaque double : peut attaquer deux fois par tour.',
  }),
  character({
    id: 'chr-titi', name: 'Titi', universe: 'looney', pop: 9, atk: 900, def: 1900, rarity: 'rare',
    tags: ['comique', 'oiseau'], keywords: ['targetImmune'],
    text: 'Ciblage impossible : ne peut pas être ciblé par les effets adverses.',
  }),
  character({
    id: 'chr-taz', name: 'Taz', universe: 'looney', pop: 9, atk: 2300, def: 1400, rarity: 'epic',
    tags: ['comique', 'créature'], keywords: ['piercing'],
    text: 'Transperce : lorsqu\'il détruit un personnage en défense, son contrôleur subit la différence en LP.',
  }),
  character({
    id: 'chr-bip-bip', name: 'Bip Bip', universe: 'looney', pop: 8, atk: 1600, def: 900, rarity: 'common',
    tags: ['comique', 'oiseau'], keywords: ['doubleAttack'], text: 'Attaque double : peut attaquer deux fois par tour.',
  }),
  character({
    id: 'chr-vil-coyote', name: 'Vil Coyote', universe: 'looney', pop: 7, atk: 1800, def: 1200, rarity: 'common',
    tags: ['comique', 'inventeur'], fx: [{
      id: 'acme', trigger: 'onDestroyed', mandatory: true,
      ops: [{ op: 'damage', who: 'opponent', amount: 400 }],
    }], text: "Lorsqu'il est détruit, infligez 400 dégâts à l'adversaire.",
  }),
]

/* ------------------------------------------------------------------ */
/* 16 techniques                                                       */
/* ------------------------------------------------------------------ */

const techniques = [
  backrow({ id: 'tec-grande-claque', name: 'Grande Claque Cartoon', universe: 'tomjerry', category: 'technique', rarity: 'common', text: "Infligez 400 dégâts à l'adversaire.", fx: [{ id: 'hit', trigger: 'activate', ops: [{ op: 'damage', who: 'opponent', amount: 400 }] }] }),
  backrow({ id: 'tec-masse', name: 'Masse de Dessin Animé', universe: 'looney', category: 'technique', rarity: 'rare', text: "Détruisez le personnage adverse de plus haute ATK (effet non ciblé).", fx: [{ id: 'bash', trigger: 'activate', targeting: 'untargeted', ops: [{ op: 'destroy', target: 'strongestEnemy' }] }] }),
  backrow({ id: 'tec-gag', name: 'Gag à Répétition', universe: 'looney', category: 'technique', rarity: 'common', text: "Infligez 300 dégâts à l'adversaire, puis piochez 1 carte.", fx: [{ id: 'gag', trigger: 'activate', ops: [{ op: 'damage', who: 'opponent', amount: 300 }, { op: 'draw', amount: 1 }] }] }),
  backrow({ id: 'tec-attaque-combinee', name: 'Attaque Combinée', universe: 'titans', category: 'technique', rarity: 'rare', text: "Vos personnages gagnent +400 ATK jusqu'à la fin du tour.", fx: [{ id: 'combo', trigger: 'activate', ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 400 }] }] }),
  backrow({ id: 'tec-bouclier', name: 'Bouclier Loufoque', universe: 'looney', category: 'technique', rarity: 'common', text: "Vos personnages gagnent +400 DEF jusqu'à la fin du tour.", fx: [{ id: 'guard', trigger: 'activate', ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', def: 400 }] }] }),
  backrow({ id: 'tec-ruee', name: 'Ruée Héroïque', universe: 'ben10', category: 'technique', rarity: 'rare', text: 'Votre personnage de plus haute ATK gagne +700 ATK jusqu\'à la fin du tour.', fx: [{ id: 'rush', trigger: 'activate', ops: [{ op: 'buff', target: 'strongestAlly', duration: 'turn', atk: 700 }] }] }),
  backrow({ id: 'tec-tarte', name: 'Tarte à la Crème', universe: 'tomjerry', category: 'technique', rarity: 'common', text: "Infligez 300 dégâts à l'adversaire ; il défausse 1 carte.", fx: [{ id: 'pie', trigger: 'activate', ops: [{ op: 'damage', who: 'opponent', amount: 300 }, { op: 'discard', who: 'opponent', amount: 1 }] }] }),
  backrow({ id: 'tec-pause', name: 'Pause Publicitaire', universe: 'looney', category: 'technique', rarity: 'epic', text: 'Gagnez 800 LP.', fx: [{ id: 'break', trigger: 'activate', ops: [{ op: 'heal', amount: 800 }] }] }),
  backrow({ id: 'tec-vitesse', name: 'Prise de Vitesse', universe: 'ben10', category: 'technique', rarity: 'rare', text: "Vos personnages gagnent Attaque double jusqu'à la fin du tour.", fx: [{ id: 'speed', trigger: 'activate', ops: [{ op: 'grantKeyword', target: 'allAllies', keyword: 'doubleAttack', duration: 'turn' }] }] }),
  backrow({ id: 'tec-contre', name: 'Contre-attaque Éclair', universe: 'titans', category: 'technique', rarity: 'epic', speed: 2, text: "Vitesse 2 — infligez 600 dégâts à l'adversaire.", fx: [{ id: 'counter', trigger: 'activate', speed: 2, ops: [{ op: 'damage', who: 'opponent', amount: 600 }] }] }),
  backrow({ id: 'tec-eclipse', name: 'Éclipse Dimensionnelle', universe: 'adventure', category: 'technique', rarity: 'rare', text: 'Bannissez les 2 cartes du dessus du deck adverse.', fx: [{ id: 'eclipse', trigger: 'activate', ops: [{ op: 'banishTop', who: 'opponent', amount: 2 }] }] }),
  backrow({ id: 'tec-inspiration', name: 'Inspiration Soudaine', universe: 'powerpuff', category: 'technique', rarity: 'common', text: 'Piochez 2 cartes.', fx: [{ id: 'idea', trigger: 'activate', ops: [{ op: 'draw', amount: 2 }] }] }),
  backrow({ id: 'tec-fournaise', name: 'Fournaise Cosmique', universe: 'ben10', category: 'technique', rarity: 'epic', text: "Infligez 900 dégâts à l'adversaire.", fx: [{ id: 'burn', trigger: 'activate', ops: [{ op: 'damage', who: 'opponent', amount: 900 }] }], lpCost: 500 }),
  backrow({ id: 'tec-tir', name: 'Tir de Précision', universe: 'titans', category: 'technique', rarity: 'rare', text: "Payez 1 000 LP : détruisez le personnage adverse de plus haute ATK.", fx: [{ id: 'snipe', trigger: 'activate', ops: [{ op: 'destroy', target: 'strongestEnemy' }] }], lpCost: 1000 }),
  backrow({ id: 'tec-armure', name: 'Armure de Cartoon', universe: 'scooby', category: 'technique', rarity: 'rare', text: "Vos personnages gagnent +600 DEF jusqu'à la fin du tour.", fx: [{ id: 'armor', trigger: 'activate', ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', def: 600 }] }] }),
  backrow({ id: 'tec-retour', name: 'Retour de Bâton', universe: 'looney', category: 'technique', rarity: 'epic', text: 'Renvoyez 1 personnage de votre Cimetière dans votre main.', fx: [{ id: 'return', trigger: 'activate', ops: [{ op: 'gyToHand', amount: 1 }] }] }),
]

/* ------------------------------------------------------------------ */
/* 10 équipements                                                      */
/* ------------------------------------------------------------------ */

const equip = (o) => backrow({ category: 'equipment', persistent: true, ...o })

const equipments = [
  equip({ id: 'eq-gants', name: 'Gants de Héros', universe: 'ben10', rarity: 'common', text: 'Le personnage équipé gagne +300 ATK.', fx: [{ id: 'eq', trigger: 'continuous', ops: [{ op: 'buff', target: 'equipped', duration: 'duel', atk: 300 }] }] }),
  equip({ id: 'eq-cape', name: 'Cape Flottante', universe: 'titans', rarity: 'common', text: 'Le personnage équipé gagne +400 DEF.', fx: [{ id: 'eq', trigger: 'continuous', ops: [{ op: 'buff', target: 'equipped', duration: 'duel', def: 400 }] }] }),
  equip({ id: 'eq-epee', name: 'Épée de Cartoon', universe: 'adventure', rarity: 'rare', text: 'Le personnage équipé gagne +600 ATK.', fx: [{ id: 'eq', trigger: 'continuous', ops: [{ op: 'buff', target: 'equipped', duration: 'duel', atk: 600 }] }] }),
  equip({ id: 'eq-armure', name: 'Armure de Plot', universe: 'scooby', rarity: 'rare', text: 'Le personnage équipé gagne +700 DEF.', fx: [{ id: 'eq', trigger: 'continuous', ops: [{ op: 'buff', target: 'equipped', duration: 'duel', def: 700 }] }] }),
  equip({ id: 'eq-lunettes', name: 'Lunettes du Multivers', universe: 'ben10', rarity: 'epic', text: 'Le personnage équipé gagne +200 ATK, +200 DEF et ne peut pas être ciblé par les effets.', fx: [{ id: 'eq', trigger: 'continuous', ops: [{ op: 'buff', target: 'equipped', duration: 'duel', atk: 200, def: 200 }] }], keywords: ['targetImmune'] }),
  equip({ id: 'eq-bottes', name: 'Bottes de Vitesse', universe: 'bottom', rarity: 'rare', text: 'Le personnage équipé gagne +200 ATK, +100 DEF et Attaque double.', fx: [{ id: 'eq', trigger: 'continuous', ops: [{ op: 'buff', target: 'equipped', duration: 'duel', atk: 200, def: 100 }] }], keywords: ['doubleAttack'] }),
  equip({ id: 'eq-lance', name: 'Lance Traversante', universe: 'titans', rarity: 'epic', text: 'Le personnage équipé gagne +500 ATK et Transperce.', fx: [{ id: 'eq', trigger: 'continuous', ops: [{ op: 'buff', target: 'equipped', duration: 'duel', atk: 500 }] }], keywords: ['piercing'] }),
  equip({ id: 'eq-amulette', name: 'Amulette de Résistance', universe: 'adventure', rarity: 'epic', text: 'Le personnage équipé gagne +300 ATK, +300 DEF et Immunité à la destruction par effet.', fx: [{ id: 'eq', trigger: 'continuous', ops: [{ op: 'buff', target: 'equipped', duration: 'duel', atk: 300, def: 300 }] }], keywords: ['destroyImmune'] }),
  equip({ id: 'eq-megaphone', name: 'Mégaphone de Popularité', universe: 'powerpuff', rarity: 'legendary', text: 'Le personnage équipé gagne +500 ATK et +500 DEF.', fx: [{ id: 'eq', trigger: 'continuous', ops: [{ op: 'buff', target: 'equipped', duration: 'duel', atk: 500, def: 500 }] }] }),
  equip({ id: 'eq-gadgets', name: 'Kit de Gadgets', universe: 'tomjerry', rarity: 'rare', text: 'Le personnage équipé gagne +100 ATK et +500 DEF.', fx: [{ id: 'eq', trigger: 'continuous', ops: [{ op: 'buff', target: 'equipped', duration: 'duel', atk: 100, def: 500 }] }] }),
]

/* ------------------------------------------------------------------ */
/* 10 soutiens                                                         */
/* ------------------------------------------------------------------ */

const supports = [
  backrow({ id: 'sup-fanclub', name: 'Fan-club Dévoué', universe: 'powerpuff', category: 'support', persistent: true, rarity: 'common', text: 'Continu : vos personnages gagnent +200 ATK.', fx: [{ id: 'fan', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 200 }] }] }),
  backrow({ id: 'sup-barriere', name: 'Barrière de Dessin', universe: 'scooby', category: 'support', persistent: true, rarity: 'rare', text: 'Continu : vos personnages gagnent +300 DEF.', fx: [{ id: 'bar', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', def: 300 }] }] }),
  backrow({ id: 'sup-studio', name: "Studio d'Animation", universe: 'looney', category: 'support', persistent: true, rarity: 'epic', text: 'Continu : vos personnages gagnent +300 ATK et +300 DEF.', fx: [{ id: 'studio', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 300, def: 300 }] }] }),
  backrow({ id: 'sup-sidekick', name: 'Sidekick Fidèle', universe: 'titans', category: 'support', persistent: true, rarity: 'common', text: 'Continu : vos personnages gagnent +100 ATK et +200 DEF.', fx: [{ id: 'side', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 100, def: 200 }] }] }),
  backrow({ id: 'sup-camera', name: 'Caméra Embarquée', universe: 'bottom', category: 'support', rarity: 'rare', text: 'Piochez 2 cartes.', fx: [{ id: 'cam', trigger: 'activate', ops: [{ op: 'draw', amount: 2 }] }] }),
  backrow({ id: 'sup-merch', name: 'Produits Dérivés', universe: 'bottom', category: 'support', rarity: 'common', text: 'Gagnez 500 LP.', fx: [{ id: 'merch', trigger: 'activate', ops: [{ op: 'heal', amount: 500 }] }] }),
  backrow({ id: 'sup-hype', name: 'Hype du Public', universe: 'ben10', category: 'support', rarity: 'rare', text: "Vos personnages gagnent +500 ATK jusqu'à la fin du tour.", fx: [{ id: 'hype', trigger: 'activate', ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 500 }] }] }),
  backrow({ id: 'sup-cameo', name: 'Caméo Surprise', universe: 'adventure', category: 'support', rarity: 'epic', text: "Infligez 500 dégâts à l'adversaire.", fx: [{ id: 'cameo', trigger: 'activate', ops: [{ op: 'damage', who: 'opponent', amount: 500 }] }] }),
  backrow({ id: 'sup-script', name: 'Script Parfait', universe: 'looney', category: 'support', persistent: true, rarity: 'rare', text: 'Continu : vos personnages gagnent +250 ATK.', fx: [{ id: 'script', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 250 }] }] }),
  backrow({ id: 'sup-equipe', name: 'Équipe Technique', universe: 'titans', category: 'support', persistent: true, rarity: 'common', text: 'Continu : vos personnages gagnent +250 DEF.', fx: [{ id: 'crew', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', def: 250 }] }] }),
]

/* ------------------------------------------------------------------ */
/* 12 magies                                                           */
/* ------------------------------------------------------------------ */

const magics = [
  backrow({ id: 'mag-ouverture', name: 'Ouverture du Multivers', universe: 'titans', category: 'magic', rarity: 'rare', text: 'Piochez 2 cartes.', fx: [{ id: 'open', trigger: 'activate', ops: [{ op: 'draw', amount: 2 }] }] }),
  backrow({ id: 'mag-tempete', name: "Tempête d'Encre", universe: 'bottom', category: 'magic', rarity: 'epic', text: "Infligez 700 dégâts à l'adversaire.", fx: [{ id: 'storm', trigger: 'activate', ops: [{ op: 'damage', who: 'opponent', amount: 700 }] }] }),
  backrow({ id: 'mag-rembobinage', name: 'Rembobinage', universe: 'looney', category: 'magic', rarity: 'legendary', text: 'Renvoyez 1 personnage de votre Cimetière dans votre main et gagnez 500 LP.', fx: [{ id: 'rewind', trigger: 'activate', ops: [{ op: 'gyToHand', amount: 1 }, { op: 'heal', amount: 500 }] }] }),
  backrow({ id: 'mag-gel', name: 'Gel Temporel', universe: 'adventure', category: 'magic', rarity: 'rare', speed: 2, text: "Vitesse 2 — infligez 500 dégâts à l'adversaire.", fx: [{ id: 'freeze', trigger: 'activate', speed: 2, ops: [{ op: 'damage', who: 'opponent', amount: 500 }] }] }),
  backrow({ id: 'mag-fusion', name: 'Fusion des Mondes', universe: 'ben10', category: 'magic', rarity: 'epic', text: "Vos personnages gagnent +600 ATK jusqu'à la fin du tour.", fx: [{ id: 'merge', trigger: 'activate', ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 600 }] }] }),
  backrow({ id: 'mag-vide', name: 'Vide Bannissement', universe: 'adventure', category: 'magic', rarity: 'rare', text: 'Bannissez les 3 cartes du dessus du deck adverse.', fx: [{ id: 'void', trigger: 'activate', ops: [{ op: 'banishTop', who: 'opponent', amount: 3 }] }] }),
  backrow({ id: 'mag-regeneration', name: 'Régénération Cartoon', universe: 'powerpuff', category: 'magic', rarity: 'common', text: 'Gagnez 700 LP.', fx: [{ id: 'regen', trigger: 'activate', ops: [{ op: 'heal', amount: 700 }] }] }),
  backrow({ id: 'mag-double-episode', name: 'Double Épisode', universe: 'bottom', category: 'magic', rarity: 'epic', text: 'Payez 500 LP : piochez 2 cartes.', fx: [{ id: 'double', trigger: 'activate', ops: [{ op: 'draw', amount: 2 }] }], lpCost: 500 }),
  backrow({ id: 'mag-miroir', name: 'Miroir du Multivers', universe: 'titans', category: 'magic', rarity: 'rare', text: "Vos personnages gagnent +500 DEF jusqu'à la fin du tour.", fx: [{ id: 'mirror', trigger: 'activate', ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', def: 500 }] }] }),
  backrow({ id: 'mag-gravite', name: 'Gravité Comique', universe: 'looney', category: 'magic', rarity: 'rare', text: "Payez 800 LP : détruisez le personnage adverse de plus haute ATK.", fx: [{ id: 'grav', trigger: 'activate', ops: [{ op: 'destroy', target: 'strongestEnemy' }] }], lpCost: 800 }),
  backrow({ id: 'mag-chorale', name: 'Chorale Héroïque', universe: 'powerpuff', category: 'magic', rarity: 'epic', text: "Vos personnages gagnent +400 ATK et +400 DEF jusqu'à la fin du tour.", fx: [{ id: 'chorus', trigger: 'activate', ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 400, def: 400 }] }] }),
  backrow({ id: 'mag-flash', name: "Flash d'Ouverture", universe: 'tomjerry', category: 'magic', rarity: 'common', text: "Infligez 250 dégâts à l'adversaire et piochez 1 carte.", fx: [{ id: 'flash', trigger: 'activate', ops: [{ op: 'damage', who: 'opponent', amount: 250 }, { op: 'draw', amount: 1 }] }] }),
]

/* ------------------------------------------------------------------ */
/* 8 pièges                                                            */
/* ------------------------------------------------------------------ */

const traps = [
  backrow({ id: 'trap-filet', name: 'Filet de Cartoon', universe: 'tomjerry', category: 'trap', rarity: 'common', speed: 2, text: 'Vitesse 2 — détruisez le personnage adverse de plus haute ATK.', fx: [{ id: 'net', trigger: 'activate', speed: 2, ops: [{ op: 'destroy', target: 'strongestEnemy' }] }] }),
  backrow({ id: 'trap-banane', name: 'Peau de Banane', universe: 'looney', category: 'trap', rarity: 'common', speed: 2, text: "Vitesse 2 — infligez 400 dégâts à l'adversaire.", fx: [{ id: 'slip', trigger: 'activate', speed: 2, ops: [{ op: 'damage', who: 'opponent', amount: 400 }] }] }),
  backrow({ id: 'trap-miroir', name: 'Miroir Piégé', universe: 'titans', category: 'trap', rarity: 'rare', speed: 2, text: "Vitesse 2 — infligez 700 dégâts à l'adversaire.", fx: [{ id: 'mirror', trigger: 'activate', speed: 2, ops: [{ op: 'damage', who: 'opponent', amount: 700 }] }] }),
  backrow({ id: 'trap-annulation', name: 'Annulation Cosmique', universe: 'adventure', category: 'trap', rarity: 'ultra', speed: 3, text: "Vitesse 3 (Contre) — annulez l'activation de la carte actuellement en chaîne.", fx: [{ id: 'deny', trigger: 'activate', speed: 3, ops: [{ op: 'negate' }] }] }),
  backrow({ id: 'trap-embuscade', name: 'Embuscade', universe: 'scooby', category: 'trap', rarity: 'rare', speed: 2, text: "Vitesse 2 — détruisez le personnage adverse de plus haute ATK et infligez 300 dégâts.", fx: [{ id: 'ambush', trigger: 'activate', speed: 2, ops: [{ op: 'destroy', target: 'strongestEnemy' }, { op: 'damage', who: 'opponent', amount: 300 }] }] }),
  backrow({ id: 'trap-coussin', name: 'Coussin de Secours', universe: 'bottom', category: 'trap', rarity: 'common', speed: 2, text: 'Vitesse 2 — gagnez 600 LP.', fx: [{ id: 'cushion', trigger: 'activate', speed: 2, ops: [{ op: 'heal', amount: 600 }] }] }),
  backrow({ id: 'trap-siphon', name: 'Siphon du Multivers', universe: 'powerpuff', category: 'trap', rarity: 'epic', speed: 2, text: "Vitesse 2 — infligez 500 dégâts et gagnez 500 LP.", fx: [{ id: 'drain', trigger: 'activate', speed: 2, ops: [{ op: 'damage', who: 'opponent', amount: 500 }, { op: 'heal', amount: 500 }] }] }),
  backrow({ id: 'trap-trappe', name: 'Trappe Dimensionnelle', universe: 'ben10', category: 'trap', rarity: 'epic', speed: 3, text: 'Vitesse 3 — bannissez les 2 cartes du dessus du deck adverse.', fx: [{ id: 'trapdoor', trigger: 'activate', speed: 3, ops: [{ op: 'banishTop', who: 'opponent', amount: 2 }] }] }),
]

/* ------------------------------------------------------------------ */
/* 6 terrains                                                          */
/* ------------------------------------------------------------------ */

const terrains = [
  backrow({ id: 'ter-cite', name: 'Cité du Multivers', universe: 'titans', category: 'terrain', persistent: true, rarity: 'rare', text: 'Vos personnages gagnent +300 ATK.', fx: [{ id: 'city', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 300 }] }] }),
  backrow({ id: 'ter-bikini', name: 'Bikini Bottom', universe: 'bottom', category: 'terrain', persistent: true, rarity: 'common', text: 'Vos personnages gagnent +300 DEF.', fx: [{ id: 'sea', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', def: 300 }] }] }),
  backrow({ id: 'ter-treehouse', name: 'Maison-Treehouse', universe: 'adventure', category: 'terrain', persistent: true, rarity: 'rare', text: 'Vos personnages gagnent +200 ATK et +200 DEF.', fx: [{ id: 'tree', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 200, def: 200 }] }] }),
  backrow({ id: 'ter-tour', name: 'Tour des Titans', universe: 'titans', category: 'terrain', persistent: true, rarity: 'epic', text: 'Vos personnages gagnent +400 ATK.', fx: [{ id: 'tower', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 400 }] }] }),
  backrow({ id: 'ter-lab', name: "Laboratoire de l'Omnitrix", universe: 'ben10', category: 'terrain', persistent: true, rarity: 'rare', text: 'Vos personnages gagnent +250 ATK.', fx: [{ id: 'lab', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 250 }] }] }),
  backrow({ id: 'ter-nuit', name: 'Nuit du Dessin Animé', universe: 'looney', category: 'terrain', persistent: true, rarity: 'legendary', text: 'Vos personnages gagnent +450 ATK et +250 DEF.', fx: [{ id: 'night', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 450, def: 250 }] }] }),
]

/* ------------------------------------------------------------------ */
/* 10 invocations spéciales (Extra Deck)                               */
/* ------------------------------------------------------------------ */

const specials = [
  special({ id: 'spx-heros-multivers', name: 'Crossover : Héros du Multivers', universe: 'ben10', rarity: 'ultra', kind: 'crossover', atk: 3200, def: 2600, pop: 12, signature: 'Deux mondes, un seul héros.', text: 'Crossover — 2 personnages d\'univers différents, Popularité 8 minimum. Envoyez les matériaux au Cimetière. Invocation depuis l\'Extra Deck.', requires: { count: 2, minPopularity: 8, universesDiffer: true, consume: 'gy' } }),
  special({ id: 'spx-allies', name: 'Crossover : Alliés Improbables', universe: 'tomjerry', rarity: 'legendary', kind: 'crossover', atk: 2600, def: 2200, pop: 11, text: 'Crossover — 2 personnages d\'univers différents, Popularité 6 minimum. Envoyez les matériaux au Cimetière. Invocation depuis l\'Extra Deck.', requires: { count: 2, minPopularity: 6, universesDiffer: true, consume: 'gy' } }),
  special({ id: 'spx-forme-ultime', name: 'Éveil : Forme Ultime', universe: 'ben10', rarity: 'ultra', kind: 'awakening', atk: 3000, def: 2400, pop: 12, text: 'Éveil — 1 personnage de Popularité 9 minimum sur votre terrain. Le matériau va au Cimetière, l\'équipement attaché aussi. Invocation depuis l\'Extra Deck.', requires: { count: 1, minPopularity: 9, consume: 'gy' } }),
  special({ id: 'spx-instinct', name: 'Éveil : Instinct Sauvage', universe: 'adventure', rarity: 'epic', kind: 'awakening', atk: 2400, def: 2000, pop: 9, text: 'Éveil — 1 personnage de Popularité 7 minimum sur votre terrain. Le matériau va au Cimetière. Invocation depuis l\'Extra Deck.', requires: { count: 1, minPopularity: 7, consume: 'gy' } }),
  special({ id: 'spx-trone', name: 'Sacrifice : Trône de Popularité', universe: 'powerpuff', rarity: 'legendary', kind: 'sacrifice', atk: 3400, def: 2800, pop: 12, text: 'Sacrifice — 2 personnages de Popularité 7 minimum. Envoyez les matériaux au Cimetière. Invocation depuis l\'Extra Deck.', requires: { count: 2, minPopularity: 7, consume: 'gy' } }),
  special({ id: 'spx-offrande', name: 'Sacrifice : Offrande Cosmique', universe: 'titans', rarity: 'epic', kind: 'sacrifice', atk: 2600, def: 2200, pop: 10, text: 'Sacrifice — 1 personnage de Popularité 8 minimum. Envoyez le matériau au Cimetière. Invocation depuis l\'Extra Deck.', requires: { count: 1, minPopularity: 8, consume: 'gy' } }),
  special({ id: 'spx-faille', name: 'Dimensionnelle : Faille du Néant', universe: 'adventure', rarity: 'ultra', kind: 'dimensional', atk: 3100, def: 2500, pop: 11, text: 'Dimensionnelle — 2 cartes bannies minimum dans votre zone bannie. Aucun matériau consommé. Invocation depuis l\'Extra Deck.', requires: { count: 0, banishedMin: 2, consume: 'none' } }),
  special({ id: 'spx-echo', name: 'Dimensionnelle : Écho du Cimetière', universe: 'scooby', rarity: 'epic', kind: 'dimensional', atk: 2500, def: 2300, pop: 10, text: 'Dimensionnelle — 4 cartes minimum dans votre Cimetière. Aucun matériau consommé. Invocation depuis l\'Extra Deck.', requires: { count: 0, graveMin: 4, consume: 'none' } }),
  special({ id: 'spx-frequence', name: 'Résonance : Fréquence Cartoon', universe: 'looney', rarity: 'legendary', kind: 'resonance', atk: 2900, def: 2500, pop: 12, text: 'Résonance — 2 personnages partageant le tag « héros ». Envoyez les matériaux au Cimetière. Invocation depuis l\'Extra Deck.', requires: { count: 2, sharedTag: 'héros', consume: 'gy' } }),
  special({ id: 'spx-duo', name: 'Résonance : Duo Comique', universe: 'bottom', rarity: 'epic', kind: 'resonance', atk: 2400, def: 2100, pop: 10, text: 'Résonance — 2 personnages partageant le tag « comique ». Envoyez les matériaux au Cimetière. Invocation depuis l\'Extra Deck.', requires: { count: 2, sharedTag: 'comique', consume: 'gy' } }),
]

/* ------------------------------------------------------------------ */
/* Extension du catalogue — 40 cartes supplémentaires (160 au total)   */
/* ------------------------------------------------------------------ */

const extraCharacters = [
  // Ben 10
  character({
    id: 'chr-heatblast', name: 'Heatblast', universe: 'ben10', pop: 8, atk: 2000, def: 1500, rarity: 'rare',
    tags: ['héros', 'alien'], fx: [{ id: 'flame', trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'damage', who: 'opponent', amount: 400 }], text: 'Inflige 400 dégâts.' }],
    text: 'Une fois par tour : infligez 400 dégâts à l\'adversaire.',
  }),
  character({
    id: 'chr-echo-echo', name: 'Écho Écho', universe: 'ben10', pop: 7, atk: 1500, def: 1500, rarity: 'common',
    tags: ['héros', 'alien'], keywords: ['absorb'],
    text: 'Absorption : les dégâts de combat subis sont annulés.',
  }),

  // Adventure Time
  character({
    id: 'chr-bmo', name: 'BMO', universe: 'adventure', pop: 8, atk: 900, def: 1900, rarity: 'common',
    tags: ['soutien', 'robot'], fx: [{ id: 'beep', trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'buff', target: 'self', duration: 'turn', def: 400 }], text: '+400 DEF ce tour.' }],
    text: 'Une fois par tour : ce personnage gagne +400 DEF jusqu\'à la fin du tour.',
  }),
  character({
    id: 'chr-gunter', name: 'Gunther', universe: 'adventure', pop: 6, atk: 1400, def: 1200, rarity: 'common',
    tags: ['comique', 'animal'], signature: 'Wenk.',
    text: 'Aucun effet : une carte simple et fiable.',
  }),

  // Les Super Nanas
  character({
    id: 'chr-him', name: 'Lui', universe: 'powerpuff', pop: 8, atk: 2300, def: 1700, rarity: 'epic',
    tags: ['vilain', 'démon'], keywords: ['destroyImmune'],
    text: 'Immunité à la destruction : ne peut pas être détruit par des effets.',
  }),
  character({
    id: 'chr-maire', name: 'Le Maire', universe: 'powerpuff', pop: 5, atk: 700, def: 1600, rarity: 'common',
    tags: ['soutien', 'humain'], fx: [{ id: 'speech', trigger: 'onSummon', mandatory: true, ops: [{ op: 'heal', amount: 300 }] }],
    text: 'Lorsqu\'il est invoqué, gagnez 300 LP.',
  }),

  // Teen Titans
  character({
    id: 'chr-terra', name: 'Terra', universe: 'titans', pop: 7, atk: 2000, def: 1600, rarity: 'rare',
    tags: ['héros', 'humain'], fx: [{ id: 'quake', trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'damage', who: 'opponent', amount: 300 }], text: 'Inflige 300 dégâts.' }],
    text: 'Une fois par tour : infligez 300 dégâts à l\'adversaire.',
  }),
  character({
    id: 'chr-slate', name: 'Slade', universe: 'titans', pop: 9, atk: 2400, def: 1900, rarity: 'epic',
    tags: ['vilain', 'humain'], keywords: ['counterAttack'],
    text: 'Contre-attaque : détruit l\'attaquant après le calcul des dégâts.',
  }),

  // Bikini Bottom
  character({
    id: 'chr-sandy', name: 'Sandy Écureuil', universe: 'bottom', pop: 9, atk: 2000, def: 1800, rarity: 'rare',
    tags: ['héros', 'savant'], fx: [{ id: 'invent', trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 200 }], text: 'Vos personnages gagnent +200 ATK ce tour.' }],
    text: 'Une fois par tour : vos personnages gagnent +200 ATK jusqu\'à la fin du tour.',
  }),
  character({
    id: 'chr-gary', name: 'Gary', universe: 'bottom', pop: 6, atk: 800, def: 1400, rarity: 'common',
    tags: ['animal', 'comique'], signature: 'Miaou.',
    text: 'Aucun effet : un compagnon tranquille.',
  }),

  // Tom & Jerry
  character({
    id: 'chr-nibbles', name: 'Nibbles', universe: 'tomjerry', pop: 7, atk: 1400, def: 1200, rarity: 'common',
    tags: ['comique', 'animal'], keywords: ['doubleAttack'],
    text: 'Attaque double : peut attaquer deux fois par tour.',
  }),
  character({
    id: 'chr-quacker', name: 'Quacker', universe: 'tomjerry', pop: 6, atk: 1300, def: 1600, rarity: 'common',
    tags: ['comique', 'animal'], fx: [{ id: 'quack', trigger: 'onSummon', mandatory: true, ops: [{ op: 'heal', amount: 200 }] }],
    text: 'Lorsqu\'il est invoqué, gagnez 200 LP.',
  }),

  // Scooby-Doo
  character({
    id: 'chr-velma', name: 'Vera', universe: 'scooby', pop: 8, atk: 1000, def: 1800, rarity: 'rare',
    tags: ['savant', 'humain'], fx: [{ id: 'clue', trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'draw', amount: 1 }], text: 'Piochez 1 carte.' }],
    text: 'Une fois par tour : piochez 1 carte.',
  }),
  character({
    id: 'chr-fantome', name: 'Le Fantôme', universe: 'scooby', pop: 6, atk: 1500, def: 1500, rarity: 'common',
    tags: ['mort-vivant', 'vilain'], keywords: ['reflect'],
    text: 'Réflexion : les dégâts de combat subis sont renvoyés à l\'attaquant.',
  }),

  // Looney Tunes
  character({
    id: 'chr-marvin', name: 'Marvin le Martien', universe: 'looney', pop: 8, atk: 2100, def: 1600, rarity: 'epic',
    tags: ['alien', 'comique'], fx: [{ id: 'ray', trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'damage', who: 'opponent', amount: 400 }], text: 'Inflige 400 dégâts.' }],
    text: 'Une fois par tour : infligez 400 dégâts à l\'adversaire.',
  }),
  character({
    id: 'chr-porky', name: 'Porky', universe: 'looney', pop: 9, atk: 1300, def: 1500, rarity: 'rare',
    tags: ['comique', 'animal'], signature: 'C\'est tout, les amis !',
    text: 'Aucun effet : un classique du cartoon.',
  }),
]

const extraTechniques = [
  backrow({
    id: 'tec-rayon', name: 'Rayon Cosmique', universe: 'ben10', category: 'technique', rarity: 'rare', speed: 1,
    text: 'Infligez 500 dégâts à l\'adversaire.', tags: ['attaque'],
    fx: [{ id: 'beam', trigger: 'activate', speed: 1, ops: [{ op: 'damage', who: 'opponent', amount: 500 }] }],
  }),
  backrow({
    id: 'tec-bouclier-fortune', name: 'Bouclier de Fortune', universe: 'adventure', category: 'technique', rarity: 'epic', speed: 1,
    text: 'Vos personnages ne peuvent pas être détruits par un effet ce tour.', tags: ['protection'],
    fx: [{ id: 'shield', trigger: 'activate', speed: 1, ops: [{ op: 'grantKeyword', target: 'allAllies', keyword: 'destroyImmune', duration: 'turn' }] }],
  }),
  backrow({
    id: 'tec-riposte', name: 'Riposte', universe: 'titans', category: 'technique', rarity: 'epic', speed: 1,
    text: 'Vos personnages gagnent Contre-attaque jusqu\'à la fin du tour.', tags: ['protection'],
    fx: [{ id: 'riposte', trigger: 'activate', speed: 1, ops: [{ op: 'grantKeyword', target: 'allAllies', keyword: 'counterAttack', duration: 'turn' }] }],
  }),
  backrow({
    id: 'tec-filet', name: 'Filet de Secours', universe: 'scooby', category: 'technique', rarity: 'common', speed: 1,
    text: 'L\'adversaire défausse 1 carte.', tags: ['contrôle'],
    fx: [{ id: 'net', trigger: 'activate', speed: 1, ops: [{ op: 'discard', who: 'opponent', amount: 1 }] }],
  }),
  backrow({
    id: 'tec-rafale', name: 'Rafale Comique', universe: 'looney', category: 'technique', rarity: 'rare', speed: 1,
    text: 'Vos personnages gagnent +200 ATK et +200 DEF jusqu\'à la fin du tour.', tags: ['soutien'],
    fx: [{ id: 'burst', trigger: 'activate', speed: 1, ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 200, def: 200 }] }],
  }),
]

const extraEquipments = [
  backrow({
    id: 'eq-cape-heroique', name: 'Cape Héroïque', universe: 'titans', category: 'equipment', rarity: 'common', persistent: true,
    text: 'Équipe le personnage le plus fort : +500 DEF.', tags: ['équipement'],
    fx: [{ id: 'cape', trigger: 'activate', speed: 1, ops: [{ op: 'buff', target: 'equipped', duration: 'duel', def: 500 }] }],
  }),
  backrow({
    id: 'eq-gantelets', name: 'Gantelets Renforcés', universe: 'ben10', category: 'equipment', rarity: 'rare', persistent: true,
    text: 'Équipe le personnage le plus fort : +700 ATK.', tags: ['équipement'],
    fx: [{ id: 'gauntlet', trigger: 'activate', speed: 1, ops: [{ op: 'buff', target: 'equipped', duration: 'duel', atk: 700 }] }],
  }),
  backrow({
    id: 'eq-anneau', name: 'Anneau de Résonance', universe: 'adventure', category: 'equipment', rarity: 'epic', persistent: true,
    text: 'Équipe le personnage le plus fort : il gagne Transperce.', tags: ['équipement'],
    fx: [{ id: 'ring', trigger: 'activate', speed: 1, ops: [{ op: 'grantKeyword', target: 'equipped', keyword: 'piercing', duration: 'duel' }] }],
  }),
]

const extraSupports = [
  backrow({
    id: 'sup-drapeau', name: 'Drapeau de l\'Équipe', universe: 'titans', category: 'support', rarity: 'rare', persistent: true,
    text: 'Continu : vos personnages gagnent +200 ATK.', tags: ['continu'],
    fx: [{ id: 'flag', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 200 }] }],
  }),
  backrow({
    id: 'sup-cristal', name: 'Cristal Multivers', universe: 'ben10', category: 'support', rarity: 'ultra', persistent: true,
    text: 'Continu : les ATK de vos personnages sont multipliées par 1,2.', tags: ['continu'],
    fx: [{ id: 'crystal', trigger: 'continuous', ops: [{ op: 'multiplyStats', target: 'allAllies', duration: 'duel', atk: 1.2 }] }],
  }),
  backrow({
    id: 'sup-totem', name: 'Totem Protecteur', universe: 'adventure', category: 'support', rarity: 'common', persistent: true,
    text: 'Continu : vos personnages gagnent +300 DEF.', tags: ['continu'],
    fx: [{ id: 'totem', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', def: 300 }] }],
  }),
]

const extraMagics = [
  backrow({
    id: 'mag-soin', name: 'Soin du Multivers', universe: 'powerpuff', category: 'magic', rarity: 'common', speed: 1,
    text: 'Gagnez 1 200 LP.', tags: ['soin'],
    fx: [{ id: 'heal', trigger: 'activate', speed: 1, ops: [{ op: 'heal', amount: 1200 }] }],
  }),
  backrow({
    id: 'mag-eclair', name: 'Éclair Cosmique', universe: 'ben10', category: 'magic', rarity: 'rare', speed: 1,
    text: 'Infligez 800 dégâts à l\'adversaire.', tags: ['attaque'],
    fx: [{ id: 'bolt', trigger: 'activate', speed: 1, ops: [{ op: 'damage', who: 'opponent', amount: 800 }] }],
  }),
  backrow({
    id: 'mag-force', name: 'Force du Multivers', universe: 'titans', category: 'magic', rarity: 'epic', speed: 1,
    text: 'Votre personnage le plus fort voit son ATK multipliée par 2 ce tour.', tags: ['soutien'],
    fx: [{ id: 'force', trigger: 'activate', speed: 1, ops: [{ op: 'multiplyStats', target: 'strongestAlly', duration: 'turn', atk: 2 }] }],
  }),
  backrow({
    id: 'mag-retour', name: 'Retour du Cimetière', universe: 'scooby', category: 'magic', rarity: 'rare', speed: 1,
    text: 'Ajoutez 1 personnage de votre Cimetière à votre main.', tags: ['récupération'],
    fx: [{ id: 'return', trigger: 'activate', speed: 1, ops: [{ op: 'gyToHand', amount: 1 }] }],
  }),
]

const extraTraps = [
  backrow({
    id: 'trap-piege', name: 'Piège à Loup', universe: 'tomjerry', category: 'trap', rarity: 'rare', persistent: true,
    text: 'Détruit le personnage adverse le plus fort.', tags: ['retrait'],
    fx: [{ id: 'snap', trigger: 'activate', speed: 2, ops: [{ op: 'destroy', target: 'strongestEnemy' }] }],
  }),
  backrow({
    id: 'trap-reflet', name: 'Miroir Magique', universe: 'powerpuff', category: 'trap', rarity: 'epic', persistent: true,
    text: 'Vos personnages gagnent Réflexion jusqu\'à la fin du tour.', tags: ['protection'],
    fx: [{ id: 'mirror', trigger: 'activate', speed: 2, ops: [{ op: 'grantKeyword', target: 'allAllies', keyword: 'reflect', duration: 'turn' }] }],
  }),
  backrow({
    id: 'trap-eponge', name: 'Éponge Cosmique', universe: 'bottom', category: 'trap', rarity: 'epic', persistent: true,
    text: 'Vos personnages gagnent Absorption jusqu\'à la fin du tour.', tags: ['protection'],
    fx: [{ id: 'sponge', trigger: 'activate', speed: 2, ops: [{ op: 'grantKeyword', target: 'allAllies', keyword: 'absorb', duration: 'turn' }] }],
  }),
]

const extraTerrains = [
  backrow({
    id: 'ter-foret', name: 'Forêt des Toons', universe: 'looney', category: 'terrain', rarity: 'rare', persistent: true,
    text: 'Vos personnages gagnent +200 ATK et +200 DEF.', tags: ['terrain'],
    fx: [{ id: 'forest', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 200, def: 200 }] }],
  }),
  backrow({
    id: 'ter-port', name: 'Port de Bikini Bottom', universe: 'bottom', category: 'terrain', rarity: 'common', persistent: true,
    text: 'Vos personnages gagnent +400 DEF.', tags: ['terrain'],
    fx: [{ id: 'harbor', trigger: 'continuous', ops: [{ op: 'buff', target: 'allAllies', duration: 'duel', def: 400 }] }],
  }),
]

const extraSpecials = [
  special({ id: 'spx-triade', name: 'Résonance : Triade Héroïque', universe: 'titans', rarity: 'ultra', kind: 'resonance', atk: 3200, def: 2600, pop: 12, text: 'Résonance — 3 personnages partageant le tag « héros ». Envoyez les matériaux au Cimetière.', requires: { count: 3, sharedTag: 'héros', consume: 'gy' } }),
  special({ id: 'spx-colosse', name: 'Sacrifice : Colosse du Multivers', universe: 'ben10', rarity: 'legendary', kind: 'sacrifice', atk: 3000, def: 2800, pop: 11, text: 'Sacrifice — 1 personnage sacrifié, envoyé au Cimetière.', requires: { count: 1, consume: 'gy' } }),
  special({ id: 'spx-eveil-ultime', name: 'Éveil : Forme Suprême', universe: 'adventure', rarity: 'ultra', kind: 'awakening', atk: 3300, def: 2700, pop: 12, text: 'Éveil — 1 personnage de Popularité 10+ sur le terrain. L\'ancienne forme va au Cimetière.', requires: { count: 1, minPopularity: 10, consume: 'gy' } }),
  special({ id: 'spx-crossover-2', name: 'Crossover : Alliances Brisées', universe: 'scooby', rarity: 'legendary', kind: 'crossover', atk: 2800, def: 2400, pop: 11, text: 'Crossover — 2 personnages d\'univers différents. Envoyez les matériaux au Cimetière.', requires: { count: 2, universesDiffer: true, consume: 'gy' } }),
]

/* ------------------------------------------------------------------ */
/* Extension massive — 200 cartes supplémentaires (360 au total)       */
/* ------------------------------------------------------------------ */

const NAME_A = ['Éclair', 'Onde', 'Rafale', 'Tempête', 'Bouclier', 'Miroir', 'Filet', 'Sceau', 'Murmure', 'Écho', 'Pulsion', 'Spirale', 'Éclat', 'Ombre', 'Tornade', 'Braises', 'Flux', 'Vertige', 'Ruine', 'Aurore']
const NAME_B = ['du Multivers', 'cosmique', 'du Néant', 'héroïque', 'du Chaos', 'de Bikini', 'des Toons', 'du Ciel', 'de Cristal', 'furtif', 'ancien', 'solaire']

const backrowName = (i) => `${NAME_A[i % NAME_A.length]} ${NAME_B[i % NAME_B.length]}`

const CHAR_NAMES = {
  ben10: ['Chaleur', 'Écho', 'Gravattack', 'Mégafoudre', 'Tétrax', 'Astrodactyl', 'Blitzwolfer', 'Frankenstrike', 'Ultra-V', 'Rouille', 'Pesky Dust', 'Snare-oh', 'Cristal'],
  adventure: ['Gunter', 'Pep', 'Lumpy', 'Nepter', 'Goliad', 'Lemongrab', 'Maja', 'Hunson', 'Susan Strong', 'Stormo', 'Cinnamon Bun', 'Prismo', 'BMO Junior'],
  powerpuff: ['Fuzzy Lumpkins', 'Princesse Morbucks', 'Sedusa', 'Gangreen', 'Mitch', 'Robin Snyder', 'Ms Bellum', 'Ms Keane', 'Le Narrateur', 'La Fée', 'Le Chat', 'Brick'],
  titans: ['Terra', 'Slade', 'Bumblebee', 'Aqualad', 'Speedy', 'Mas', 'Menos', 'Gizmo', 'Jinx', 'Mammoth', 'Kid Flash', 'Red Star', 'Blackfire'],
  bottom: ['Sandy', 'Gary', 'Perle Krabs', 'Mme Puff', 'L\'Homme Sirène', 'Patchy', 'Le Hollandais Volant', 'Bubble Bass', 'Karen', 'Fred le poisson', 'Le Roi des méduses', 'Capitaine Krabs'],
  tomjerry: ['Nibbles', 'Quacker', 'Tyke', 'Topsy', 'Mammy', 'Lightning', 'Meathead', 'Fluff', 'Toodles', 'Muscles', 'Riff', 'Rajah'],
  scooby: ['Vera', 'Le Fantôme', 'Scooby-Dum', 'Oncle Albert', 'Red Herring', 'Mortimer', 'Jasper', 'Simone', 'Marcel', 'Le Gardien', 'La Momie', 'Le Lagon'],
  looney: ['Marvin le Martien', 'Porky', 'Sam le Pirate', 'Elmer', 'Gossamer', 'Sylvestre', 'Mémé', 'Speedy Gonzales', 'Pépé le Putois', 'Charlie le Coq', 'Michigan J. Frog', 'Ralph le Loup', 'Foghorn'],
}

const ROLE_CYCLE = ['bruiser', 'guardian', 'trickster', 'support']

const ROLE_COPY = {
  bruiser: 'Bruyant au combat',
  guardian: 'Solide en défense',
  trickster: 'Imprévisible',
  support: 'Soutien de l\'équipe',
}

function generatedCharacters() {
  const out = []
  let index = 0
  for (const universe of UNIVERSES) {
    for (const name of CHAR_NAMES[universe.id] ?? []) {
      const role = ROLE_CYCLE[index % ROLE_CYCLE.length]
      const v = index % 3
      const id = `chr-x${String(index + 1).padStart(3, '0')}`
      const popularity = 4 + ((index * 5) % 9)
      let atk
      let def
      let rarity
      const keywords = []
      let fx = []
      let text

      if (role === 'bruiser') {
        atk = 2100 + v * 200
        def = 1400 + v * 100
        fx = [{ id: `burn${index}`, trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'damage', who: 'opponent', amount: 300 + v * 100 }], text: `Inflige ${300 + v * 100} dégâts.` }]
        text = `Une fois par tour : infligez ${300 + v * 100} dégâts à l'adversaire.`
        if (index % 2 === 0) keywords.push('piercing')
      } else if (role === 'guardian') {
        atk = 1200 + v * 150
        def = 2000 + v * 200
        fx = [{ id: `guard${index}`, trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', def: 200 + v * 100 }], text: `Vos personnages gagnent +${200 + v * 100} DEF ce tour.` }]
        text = `Une fois par tour : vos personnages gagnent +${200 + v * 100} DEF jusqu'à la fin du tour.`
        if (index % 3 === 0) keywords.push('targetImmune')
        else if (index % 3 === 1) keywords.push('destroyImmune')
      } else if (role === 'trickster') {
        atk = 1700 + v * 100
        def = 1500 + v * 100
        fx = v === 0
          ? [{ id: `trick${index}`, trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'discard', who: 'opponent', amount: 1 }], text: 'L\'adversaire défausse 1 carte.' }]
          : [{ id: `trick${index}`, trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'draw', amount: 1 }], text: 'Piochez 1 carte.' }]
        text = v === 0 ? 'Une fois par tour : l\'adversaire défausse 1 carte au hasard.' : 'Une fois par tour : piochez 1 carte.'
        keywords.push(v === 0 ? 'doubleAttack' : v === 1 ? 'absorb' : 'reflect')
      } else {
        atk = 800 + v * 200
        def = 1600 + v * 100
        fx = index % 2 === 0
          ? [{ id: `aid${index}`, trigger: 'onSummon', mandatory: true, ops: [{ op: 'heal', amount: 300 + v * 100 }] }]
          : [{ id: `aid${index}`, trigger: 'activate', speed: 1, oncePerTurn: true, ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 150 + v * 50 }], text: `Vos personnages gagnent +${150 + v * 50} ATK ce tour.` }]
        text = index % 2 === 0 ? `Lorsqu'il est invoqué, gagnez ${300 + v * 100} LP.` : `Une fois par tour : vos personnages gagnent +${150 + v * 50} ATK jusqu'à la fin du tour.`
        if (index % 4 === 0) keywords.push('counterAttack')
      }

      rarity = index % 17 === 0 ? 'ultra' : atk >= 2500 ? 'legendary' : atk >= 2000 ? 'epic' : atk >= 1500 ? 'rare' : 'common'
      out.push(character({ id, name, universe: universe.id, pop: popularity, atk, def, rarity, text, tags: [ROLE_COPY[role]], keywords, fx }))
      index += 1
    }
  }
  return out
}

function generatedTechniques() {
  const recipes = [
    () => ({ text: 'Infligez 500 dégâts à l\'adversaire.', ops: [{ op: 'damage', who: 'opponent', amount: 500 }] }),
    () => ({ text: 'Infligez 600 dégâts à l\'adversaire ; il défausse 1 carte.', ops: [{ op: 'damage', who: 'opponent', amount: 600 }, { op: 'discard', who: 'opponent', amount: 1 }] }),
    () => ({ text: 'Piochez 2 cartes.', ops: [{ op: 'draw', amount: 2 }] }),
    () => ({ text: 'Gagnez 900 LP.', ops: [{ op: 'heal', amount: 900 }] }),
    () => ({ text: 'Vos personnages gagnent +300 ATK jusqu\'à la fin du tour.', ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 300 }] }),
    () => ({ text: 'Vos personnages gagnent Attaque double jusqu\'à la fin du tour.', ops: [{ op: 'grantKeyword', target: 'allAllies', keyword: 'doubleAttack', duration: 'turn' }] }),
    () => ({ text: 'Détruisez le personnage adverse de plus haute ATK.', ops: [{ op: 'destroy', target: 'strongestEnemy' }] }),
    () => ({ text: 'Bannissez les 2 cartes du dessus du deck adverse.', ops: [{ op: 'banishTop', who: 'opponent', amount: 2 }] }),
    () => ({ text: 'Renvoyez 1 personnage de votre Cimetière dans votre main.', ops: [{ op: 'gyToHand', amount: 1 }] }),
    () => ({ text: 'Vos personnages gagnent +400 DEF jusqu\'à la fin du tour.', ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', def: 400 }] }),
  ]
  return Array.from({ length: 20 }, (_, i) => {
    const recipe = recipes[i % recipes.length]()
    const untargeted = i % recipes.length === 6 && i % 2 === 1
    return backrow({
      id: `tec-x${String(i + 1).padStart(3, '0')}`,
      name: backrowName(i),
      universe: UNIVERSES[i % UNIVERSES.length].id,
      category: 'technique',
      rarity: ['common', 'rare', 'epic', 'legendary'][i % 4],
      speed: 1,
      text: untargeted ? recipe.text.replace('Détruisez', 'Détruisez (effet non ciblé)') : recipe.text,
      fx: [{ id: `tecx${i}`, trigger: 'activate', speed: 1, targeting: untargeted ? 'untargeted' : undefined, ops: recipe.ops }],
    })
  })
}

function generatedEquipments() {
  return Array.from({ length: 12 }, (_, i) => {
    const atk = [0, 200, 300, 400][i % 4]
    const def = [300, 400, 500, 600][i % 4]
    const keyword = i % 5 === 0 ? 'piercing' : i % 5 === 2 ? 'doubleAttack' : i % 5 === 4 ? 'destroyImmune' : null
    const ops = []
    if (atk) ops.push({ op: 'buff', target: 'equipped', duration: 'duel', atk })
    if (def) ops.push({ op: 'buff', target: 'equipped', duration: 'duel', def })
    if (keyword) ops.push({ op: 'grantKeyword', target: 'equipped', keyword, duration: 'duel' })
    const parts = []
    if (atk) parts.push(`+${atk} ATK`)
    if (def) parts.push(`+${def} DEF`)
    if (keyword) parts.push({ piercing: 'Transperce', doubleAttack: 'Attaque double', destroyImmune: 'Immunité à la destruction' }[keyword])
    return backrow({
      id: `eq-x${String(i + 1).padStart(3, '0')}`,
      name: backrowName(i + 3),
      universe: UNIVERSES[i % UNIVERSES.length].id,
      category: 'equipment',
      rarity: ['common', 'rare', 'epic', 'legendary'][i % 4],
      persistent: true,
      text: `Équipe le personnage le plus fort : ${parts.join(', ')}.`,
      fx: [{ id: `eqx${i}`, trigger: 'activate', speed: 1, ops }],
    })
  })
}

function generatedSupports() {
  return Array.from({ length: 12 }, (_, i) => {
    const mode = i % 4
    const ops =
      mode === 0
        ? [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 150 + (i % 3) * 50 }]
        : mode === 1
          ? [{ op: 'buff', target: 'allAllies', duration: 'duel', def: 200 + (i % 3) * 100 }]
          : mode === 2
            ? [{ op: 'multiplyStats', target: 'allAllies', duration: 'duel', atk: 1.1 }]
            : [{ op: 'buff', target: 'allAllies', duration: 'duel', atk: 100, def: 100 }]
    const text =
      mode === 0
        ? `Continu : vos personnages gagnent +${150 + (i % 3) * 50} ATK.`
        : mode === 1
          ? `Continu : vos personnages gagnent +${200 + (i % 3) * 100} DEF.`
          : mode === 2
            ? 'Continu : les ATK de vos personnages sont multipliées par 1,1.'
            : 'Continu : vos personnages gagnent +100 ATK et +100 DEF.'
    return backrow({
      id: `sup-x${String(i + 1).padStart(3, '0')}`,
      name: backrowName(i + 5),
      universe: UNIVERSES[i % UNIVERSES.length].id,
      category: 'support',
      rarity: ['common', 'rare', 'epic', 'ultra'][i % 4],
      persistent: true,
      text,
      fx: [{ id: `supx${i}`, trigger: 'continuous', ops }],
    })
  })
}

function generatedMagics() {
  const recipes = [
    () => ({ text: 'Infligez 700 dégâts à l\'adversaire.', ops: [{ op: 'damage', who: 'opponent', amount: 700 }] }),
    () => ({ text: 'Gagnez 1 000 LP.', ops: [{ op: 'heal', amount: 1000 }] }),
    () => ({ text: 'Piochez 1 carte.', ops: [{ op: 'draw', amount: 1 }] }),
    () => ({ text: 'Détruisez le personnage adverse de plus haute ATK.', ops: [{ op: 'destroy', target: 'strongestEnemy' }] }),
    () => ({ text: 'Votre personnage le plus fort voit son ATK multipliée par 1,5 ce tour.', ops: [{ op: 'multiplyStats', target: 'strongestAlly', duration: 'turn', atk: 1.5 }] }),
    () => ({ text: 'Renvoyez 1 personnage de votre Cimetière dans votre main.', ops: [{ op: 'gyToHand', amount: 1 }] }),
    () => ({ text: 'Vos personnages gagnent +250 ATK et +250 DEF jusqu\'à la fin du tour.', ops: [{ op: 'buff', target: 'allAllies', duration: 'turn', atk: 250, def: 250 }] }),
  ]
  return Array.from({ length: 18 }, (_, i) => {
    const recipe = recipes[i % recipes.length]()
    return backrow({
      id: `mag-x${String(i + 1).padStart(3, '0')}`,
      name: backrowName(i + 2),
      universe: UNIVERSES[i % UNIVERSES.length].id,
      category: 'magic',
      rarity: ['common', 'rare', 'epic', 'legendary'][i % 4],
      speed: 1,
      text: recipe.text,
      fx: [{ id: `magx${i}`, trigger: 'activate', speed: 1, ops: recipe.ops }],
    })
  })
}

function generatedTraps() {
  const recipes = [
    () => ({ text: 'Infligez 400 dégâts à l\'adversaire.', ops: [{ op: 'damage', who: 'opponent', amount: 400 }] }),
    () => ({ text: 'Détruisez le personnage adverse de plus haute ATK.', ops: [{ op: 'destroy', target: 'strongestEnemy' }] }),
    () => ({ text: 'Vos personnages gagnent Immunité à la destruction jusqu\'à la fin du tour.', ops: [{ op: 'grantKeyword', target: 'allAllies', keyword: 'destroyImmune', duration: 'turn' }] }),
    () => ({ text: 'Vos personnages gagnent Réflexion jusqu\'à la fin du tour.', ops: [{ op: 'grantKeyword', target: 'allAllies', keyword: 'reflect', duration: 'turn' }] }),
    () => ({ text: 'Vos personnages gagnent Absorption jusqu\'à la fin du tour.', ops: [{ op: 'grantKeyword', target: 'allAllies', keyword: 'absorb', duration: 'turn' }] }),
    () => ({ text: 'L\'adversaire défausse 1 carte.', ops: [{ op: 'discard', who: 'opponent', amount: 1 }] }),
  ]
  return Array.from({ length: 12 }, (_, i) => {
    const recipe = recipes[i % recipes.length]()
    return backrow({
      id: `trap-x${String(i + 1).padStart(3, '0')}`,
      name: backrowName(i + 1),
      universe: UNIVERSES[i % UNIVERSES.length].id,
      category: 'trap',
      rarity: ['common', 'rare', 'epic', 'legendary'][i % 4],
      persistent: true,
      text: recipe.text,
      fx: [{ id: `trapx${i}`, trigger: 'activate', speed: 2, ops: recipe.ops }],
    })
  })
}

function generatedTerrains() {
  return Array.from({ length: 6 }, (_, i) => {
    const atk = [200, 300, 400][i % 3]
    const def = [200, 300, 400][i % 3]
    const ops = i % 2 === 0
      ? [{ op: 'buff', target: 'allAllies', duration: 'duel', atk, def }]
      : [{ op: 'buff', target: 'allAllies', duration: 'duel', atk }]
    const text = i % 2 === 0
      ? `Vos personnages gagnent +${atk} ATK et +${def} DEF.`
      : `Vos personnages gagnent +${atk} ATK.`
    return backrow({
      id: `ter-x${String(i + 1).padStart(3, '0')}`,
      name: backrowName(i + 7),
      universe: UNIVERSES[i % UNIVERSES.length].id,
      category: 'terrain',
      rarity: ['common', 'rare', 'epic', 'legendary'][i % 4],
      persistent: true,
      text,
      fx: [{ id: `terx${i}`, trigger: 'continuous', ops }],
    })
  })
}

function generatedSpecials() {
  const kinds = ['crossover', 'awakening', 'sacrifice', 'dimensional', 'resonance']
  const kindLabel = { crossover: 'Crossover', awakening: 'Éveil', sacrifice: 'Sacrifice', dimensional: 'Dimensionnelle', resonance: 'Résonance' }
  return Array.from({ length: 20 }, (_, i) => {
    const kind = kinds[i % kinds.length]
    const universe = UNIVERSES[i % UNIVERSES.length].id
    const atk = 2400 + (i % 5) * 200
    const def = 2100 + (i % 4) * 150
    const pop = 8 + (i % 5)
    let requires
    let detail
    if (kind === 'crossover') {
      requires = { count: 2, universesDiffer: true, consume: 'gy' }
      detail = '2 personnages d\'univers différents. Envoyez les matériaux au Cimetière.'
    } else if (kind === 'awakening') {
      requires = { count: 1, minPopularity: 8 + (i % 3), consume: 'gy' }
      detail = `1 personnage de Popularité ${8 + (i % 3)}+ sur le terrain. L'ancienne forme va au Cimetière.`
    } else if (kind === 'sacrifice') {
      requires = { count: 1 + (i % 2), consume: 'gy' }
      detail = `${1 + (i % 2)} personnage(s) sacrifié(s), envoyé(s) au Cimetière.`
    } else if (kind === 'dimensional') {
      requires = { count: 0, graveMin: 3 + (i % 3), consume: 'none' }
      detail = `${3 + (i % 3)} cartes minimum dans votre Cimetière. Aucun matériau consommé.`
    } else {
      requires = { count: 2, sharedTag: i % 2 === 0 ? 'héros' : 'comique', consume: 'gy' }
      detail = `2 personnages partageant le tag « ${i % 2 === 0 ? 'héros' : 'comique'} ». Envoyez les matériaux au Cimetière.`
    }
    return special({
      id: `spx-x${String(i + 1).padStart(3, '0')}`,
      name: `${kindLabel[kind]} : ${backrowName(i + 4)}`,
      universe,
      rarity: ['rare', 'epic', 'legendary', 'ultra'][i % 4],
      kind,
      atk,
      def,
      pop: Math.min(12, pop),
      text: `${kindLabel[kind]} — ${detail} Invocation depuis l'Extra Deck.`,
      requires,
    })
  })
}

const massiveCharacters = generatedCharacters()
const massiveTechniques = generatedTechniques()
const massiveEquipments = generatedEquipments()
const massiveSupports = generatedSupports()
const massiveMagics = generatedMagics()
const massiveTraps = generatedTraps()
const massiveTerrains = generatedTerrains()
const massiveSpecials = generatedSpecials()

export const CARDS = [
  ...characters,
  ...techniques,
  ...equipments,
  ...supports,
  ...magics,
  ...traps,
  ...terrains,
  ...specials,
  ...extraCharacters,
  ...extraTechniques,
  ...extraEquipments,
  ...extraSupports,
  ...extraMagics,
  ...extraTraps,
  ...extraTerrains,
  ...extraSpecials,
  ...massiveCharacters,
  ...massiveTechniques,
  ...massiveEquipments,
  ...massiveSupports,
  ...massiveMagics,
  ...massiveTraps,
  ...massiveTerrains,
  ...massiveSpecials,
].map((c) => ({
  version: 1,
  status: 'published',
  ...c,
}))

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const OP_NAMES = new Set(['damage', 'heal', 'draw', 'buff', 'setStats', 'multiplyStats', 'destroy', 'discard', 'banishTop', 'grantKeyword', 'gyToHand', 'negate'])
const TARGETS = new Set(['self', 'equipped', 'allAllies', 'strongestAlly', 'strongestEnemy'])
const TRIGGERS = new Set(['activate', 'onSummon', 'onDestroyed', 'continuous'])
const KEYWORDS = new Set(['piercing', 'doubleAttack', 'destroyImmune', 'targetImmune', 'counterAttack', 'reflect', 'absorb'])
const KINDS = new Set(['crossover', 'awakening', 'sacrifice', 'dimensional', 'resonance'])

function validate(cards) {
  const errors = []
  const ids = new Set()
  const counts = {}
  for (const c of cards) {
    if (ids.has(c.id)) errors.push(`id dupliqué: ${c.id}`)
    ids.add(c.id)
    if (!RARITIES.includes(c.rarity)) errors.push(`${c.id}: rareté inconnue ${c.rarity}`)
    if (!UNIVERSES.some((u) => u.id === c.universe)) errors.push(`${c.id}: univers inconnu ${c.universe}`)
    counts[c.category] = (counts[c.category] ?? 0) + 1
    if (/niveau|mana|énergie|energie|stamina/i.test(`${c.name} ${c.text}`)) {
      errors.push(`${c.id}: vocabulaire interdit (niveau/énergie/mana) dans le texte`)
    }
    if (c.category === 'character') {
      if (!(c.popularity >= 1 && c.popularity <= 12)) errors.push(`${c.id}: popularité hors 1..12`)
      if (!Number.isFinite(c.atk) || !Number.isFinite(c.def)) errors.push(`${c.id}: ATK/DEF manquantes`)
    }
    for (const k of c.keywords ?? []) if (!KEYWORDS.has(k)) errors.push(`${c.id}: mot-clé inconnu ${k}`)
    for (const e of c.fx ?? []) {
      if (!TRIGGERS.has(e.trigger)) errors.push(`${c.id}: déclencheur inconnu ${e.trigger}`)
      if (e.speed != null && ![1, 2, 3].includes(e.speed)) errors.push(`${c.id}: vitesse invalide`)
      for (const op of e.ops ?? []) {
        if (!OP_NAMES.has(op.op)) errors.push(`${c.id}: opération inconnue ${op.op}`)
        if (op.op === 'buff' && op.target && !TARGETS.has(op.target)) errors.push(`${c.id}: cible inconnue ${op.target}`)
      }
    }
    if (c.category === 'special') {
      if (!KINDS.has(c.special?.kind)) errors.push(`${c.id}: type d'invocation inconnu`)
    }
  }
  const expected = { character: 164, technique: 41, equipment: 25, support: 25, magic: 34, trap: 23, terrain: 14, special: 34 }
  for (const [k, v] of Object.entries(expected)) {
    if (counts[k] !== v) errors.push(`catégorie ${k}: ${counts[k]} cartes au lieu de ${v}`)
  }
  if (cards.length !== 360) errors.push(`total ${cards.length} cartes au lieu de 360`)
  return errors
}

const errors = validate(CARDS)
if (errors.length) {
  console.error('Catalogue invalide:\n' + errors.join('\n'))
  process.exit(1)
}

const outCandidates = [resolve(ROOT, 'src/data/cards.json')]
mkdirSync(resolve(ROOT, 'src/data'), { recursive: true })
for (const out of outCandidates) {
  writeFileSync(out, JSON.stringify(CARDS, null, 2) + '\n', 'utf8')
}
writeFileSync(
  resolve(ROOT, 'src/data/universes.json'),
  JSON.stringify(UNIVERSES, null, 2) + '\n',
  'utf8',
)
const summary = Object.entries(CARDS.reduce((acc, c) => ((acc[c.category] = (acc[c.category] ?? 0) + 1), acc), {}))
  .map(([k, v]) => `${k}=${v}`)
  .join(' ')
console.log(`Catalogue généré : ${CARDS.length} cartes (${summary})`)

