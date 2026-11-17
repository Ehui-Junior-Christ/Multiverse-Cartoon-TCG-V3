"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickStrategy = pickStrategy;
exports.pickUniverse = pickUniverse;
exports.buildAutoDeck = buildAutoDeck;
/**
 * Constructeur de deck automatique.
 *
 * Le choix n'est pas aléatoire : un archétype est déduit du catalogue possédé,
 * puis chaque carte est notée selon sa synergie avec cet archétype (univers
 * dominant, tags partagés, rôles, effets) et le deck est composé par quotas.
 * Les invocations spéciales ne sont retenues que si le deck principal permet
 * réellement de remplir leurs conditions.
 *
 * Module pur : aucun accès réseau, aucun DOM, résultat déterministe à graine fixe.
 */
const catalog_1 = require("./catalog");
const deck_1 = require("./deck");
const STRATEGY_LABEL = {
    aggro: 'Agressif',
    control: 'Contrôle',
    resonance: 'Résonance',
};
const CHARACTER_CATEGORIES = ['character'];
const SPELL_CATEGORIES = ['technique', 'magic'];
void CHARACTER_CATEGORIES;
/** Petite fonction de hachage pour départager les égalités de façon déterministe. */
function tieBreak(id, seed) {
    let h = seed >>> 0;
    for (let i = 0; i < id.length; i++)
        h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
    return h;
}
function effectValue(fx, strategy) {
    if (!fx)
        return 0;
    let value = 0;
    for (const op of fx.ops) {
        switch (op.op) {
            case 'damage':
                value += op.amount / 90;
                break;
            case 'heal':
                value += op.amount / 240;
                break;
            case 'draw':
                value += 4 * op.amount;
                break;
            case 'destroy':
                value += strategy === 'control' ? 9 : 7;
                break;
            case 'discard':
                value += strategy === 'control' ? 5 : 3;
                break;
            case 'banishTop':
                value += 3 * op.amount;
                break;
            case 'buff':
                value += ((op.atk ?? 0) + (op.def ?? 0)) / 130;
                break;
            case 'setStats':
                value += ((op.atk ?? 0) + (op.def ?? 0)) / 300;
                break;
            case 'multiplyStats':
                value += strategy === 'aggro' ? 4 : 3;
                break;
            case 'grantKeyword':
                value += keywordValue(op.keyword, strategy);
                break;
            case 'gyToHand':
                value += 3 * op.amount;
                break;
            case 'negate':
                value += 6;
                break;
            default:
                break;
        }
    }
    return value;
}
function keywordValue(keyword, strategy) {
    const table = {
        aggro: { piercing: 3.5, doubleAttack: 4, counterAttack: 1.5, destroyImmune: 1, targetImmune: 1, reflect: 1, absorb: 1 },
        control: { piercing: 1, doubleAttack: 1, counterAttack: 3, destroyImmune: 4, targetImmune: 3.5, reflect: 3, absorb: 3.5 },
        resonance: { piercing: 2, doubleAttack: 2, counterAttack: 2, destroyImmune: 2, targetImmune: 2, reflect: 2, absorb: 2 },
    };
    return table[strategy][keyword] ?? 0;
}
function rarityValue(rarity) {
    return { common: 0, rare: 1, epic: 2.5, legendary: 4, ultra: 6 }[rarity];
}
function scoreCard(card, ctx) {
    let score = rarityValue(card.rarity);
    const activate = (card.fx ?? []).find((fx) => fx.trigger === 'activate');
    const continuous = (card.fx ?? []).find((fx) => fx.trigger === 'continuous');
    if (card.category === 'character') {
        const atk = card.atk ?? 0;
        const def = card.def ?? 0;
        score += atk / 90 + def / 150;
        score += (card.popularity ?? 0) * 0.25;
        if (card.universe === ctx.universe)
            score += 7;
        for (const tag of card.tags)
            score += (ctx.tags.get(tag) ?? 0) * 1.6;
        for (const keyword of card.keywords)
            score += keywordValue(keyword, ctx.strategy);
        score += effectValue(activate, ctx.strategy) * 0.7;
        score += effectValue(continuous, ctx.strategy) * 0.4;
        // Un personnage à sacrifice est excellent en aggro mais lourd ailleurs.
        if ((card.tributes ?? 0) >= 2 && ctx.strategy !== 'aggro')
            score -= 4;
    }
    else if (card.category === 'terrain') {
        score += 9 + (card.universe === ctx.universe ? 7 : 0);
        score += effectValue(continuous, ctx.strategy);
    }
    else if (card.category === 'support') {
        score += 4 + (card.universe === ctx.universe ? 2 : 0);
        score += effectValue(continuous, ctx.strategy);
    }
    else if (card.category === 'trap') {
        score += 3 + effectValue(activate, ctx.strategy);
    }
    else {
        score += effectValue(activate, ctx.strategy);
    }
    // Départage stable : la graine influence l'ordre sans écraser le score.
    score += (tieBreak(card.id, ctx.seed) % 100) / 1000;
    return score;
}
/** Déduit l'archétype à partir du catalogue possédé. */
function pickStrategy(pool) {
    let aggro = 0;
    let control = 0;
    let resonance = 0;
    for (const card of pool) {
        if (card.category !== 'character')
            continue;
        aggro += ((card.atk ?? 0) - 1800) / 200;
        control += ((card.def ?? 0) - 1800) / 200;
        for (const keyword of card.keywords) {
            if (keyword === 'piercing' || keyword === 'doubleAttack')
                aggro += 2;
            if (keyword === 'destroyImmune' || keyword === 'targetImmune' || keyword === 'absorb' || keyword === 'reflect')
                control += 2;
            if (keyword === 'counterAttack') {
                aggro += 1;
                control += 1;
            }
        }
        for (const tag of card.tags)
            resonance += 0.2;
    }
    if (aggro >= control && aggro >= resonance * 0.5)
        return 'aggro';
    if (control >= resonance * 0.5)
        return 'control';
    return 'resonance';
}
/** Univers dominant : pondéré par la puissance et le nombre de personnages. */
function pickUniverse(pool) {
    const totals = new Map();
    for (const card of pool) {
        if (card.category !== 'character')
            continue;
        const weight = 1 + (card.atk ?? 0) / 2000;
        totals.set(card.universe, (totals.get(card.universe) ?? 0) + weight);
    }
    let best = 'titans';
    let bestValue = -1;
    for (const [universe, value] of [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (value > bestValue) {
            best = universe;
            bestValue = value;
        }
    }
    return best;
}
function topTags(pool, universe) {
    const counts = new Map();
    for (const card of pool) {
        if (card.category !== 'character')
            continue;
        const weight = card.universe === universe ? 2 : 1;
        for (const tag of card.tags)
            counts.set(tag, (counts.get(tag) ?? 0) + weight);
    }
    return counts;
}
/** Quotas par rôle, recalculés pour atteindre la taille visée. */
function buildQuotas(target) {
    const terrain = 1;
    const support = Math.max(2, Math.round(target * 0.06));
    const equipment = Math.max(2, Math.round(target * 0.05));
    const trap = Math.max(3, Math.round(target * 0.09));
    const spell = Math.max(8, Math.round(target * 0.18));
    const monsters = target - terrain - support - equipment - trap - spell;
    return [
        { category: 'character', count: monsters },
        { category: 'spell', count: spell },
        { category: 'trap', count: trap },
        { category: 'support', count: support },
        { category: 'equipment', count: equipment },
        { category: 'terrain', count: terrain },
    ];
}
function takesCategory(card, slot) {
    if (slot === 'spell')
        return SPELL_CATEGORIES.includes(card.category);
    return card.category === slot;
}
/** Ajoute des copies en plusieurs passes pour varier puis renforcer. */
function fill(ordered, wanted, copies, maxCopies, take) {
    let added = 0;
    for (let round = 1; round <= deck_1.MAX_COPIES && added < wanted; round++) {
        // Aux passes 2 et 3, on ne renforce que le haut du classement.
        const limit = round === 1 ? ordered.length : Math.ceil(ordered.length * 0.6);
        for (let i = 0; i < limit && added < wanted; i++) {
            const card = ordered[i];
            if (!take(card))
                continue;
            const current = copies.get(card.id) ?? 0;
            if (current >= round)
                continue;
            if (current >= maxCopies(card))
                continue;
            copies.set(card.id, current + 1);
            added += 1;
        }
    }
}
function feasibilityOf(cards) {
    const universes = new Set();
    const tags = new Map();
    let maxPopularity = 0;
    let hasBanish = false;
    let hasDiscard = false;
    for (const card of cards) {
        universes.add(card.universe);
        if (card.category === 'character') {
            maxPopularity = Math.max(maxPopularity, card.popularity ?? 0);
            for (const tag of card.tags)
                tags.set(tag, (tags.get(tag) ?? 0) + 1);
        }
        for (const fx of card.fx ?? []) {
            for (const op of fx.ops) {
                if (op.op === 'banishTop')
                    hasBanish = true;
                if (op.op === 'discard')
                    hasDiscard = true;
            }
        }
    }
    return { universes, tags, maxPopularity, hasBanish, hasDiscard };
}
/** Vérifie qu'une invocation spéciale est réalisable avec ce deck principal. */
function specialFeasible(card, facts) {
    const req = card.special?.requires;
    if (!req)
        return { ok: false, reason: 'conditions inconnues' };
    const kind = card.special?.kind ?? 'crossover';
    if (kind === 'crossover' && req.universesDiffer && facts.universes.size < 2) {
        return { ok: false, reason: 'un seul univers dans le deck' };
    }
    if (kind === 'awakening' && (req.minPopularity ?? 0) > facts.maxPopularity) {
        return { ok: false, reason: `aucun personnage de Popularité ${req.minPopularity}+` };
    }
    if (kind === 'resonance' && req.sharedTag) {
        if ((facts.tags.get(req.sharedTag) ?? 0) < req.count) {
            return { ok: false, reason: `pas assez de personnages « ${req.sharedTag} »` };
        }
    }
    if (kind === 'dimensional') {
        if (req.banishedMin && !facts.hasBanish)
            return { ok: false, reason: 'aucun effet de bannissement' };
        if (req.graveMin && req.graveMin > 6)
            return { ok: false, reason: 'Cimetière trop lent à remplir' };
        if (req.graveMin && !facts.hasDiscard) {
            // Le Cimetière se remplit aussi par les combats et les techniques jouées.
            return { ok: req.graveMin <= 4, reason: 'Cimetière lent à remplir' };
        }
    }
    if (req.count > 0 && req.count > 3)
        return { ok: false, reason: 'trop de matériaux requis' };
    return { ok: true, reason: 'conditions réalisables' };
}
/**
 * Construit un deck cohérent et valide.
 * En cas d'impossibilité (collection trop pauvre), renvoie le meilleur effort
 * avec la liste d'erreurs de validation.
 */
function buildAutoDeck(cards, options = {}) {
    const owned = options.owned ?? (() => 3);
    const seed = options.seed ?? 1337;
    const target = Math.min(deck_1.DECK_MAX, Math.max(deck_1.DECK_MIN, options.size ?? 60));
    const pool = cards.filter((card) => card.category !== 'special' && owned(card.id) > 0);
    const ownedSpecials = cards.filter((card) => card.category === 'special' && owned(card.id) > 0);
    if (pool.length === 0) {
        return {
            deck: { id: 'auto-vide', name: 'Deck auto (vide)', main: [], extra: [] },
            report: {
                strategy: 'aggro',
                strategyLabel: STRATEGY_LABEL.aggro,
                universe: '',
                universeName: '—',
                tags: [],
                score: 0,
                monsters: 0,
                spells: 0,
                traps: 0,
                terrains: 0,
                specials: 0,
                extraReasons: [],
                notes: ['Aucune carte possédée.'],
            },
            errors: ['Collection vide.'],
        };
    }
    const strategy = options.strategy ?? pickStrategy(pool);
    const universe = options.universe ?? pickUniverse(pool);
    const tags = topTags(pool, universe);
    const ctx = { strategy, universe, tags, seed };
    const scored = pool
        .map((card) => ({ card, score: scoreCard(card, ctx) }))
        .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
    const ordered = scored.map((entry) => entry.card);
    const copies = new Map();
    const maxCopies = (card) => Math.max(1, Math.min(deck_1.MAX_COPIES, owned(card.id)));
    for (const slot of buildQuotas(target)) {
        fill(ordered, slot.count, copies, maxCopies, (card) => takesCategory(card, slot.category));
    }
    // Complète ou réduit pour respecter exactement la cible.
    let total = [...copies.values()].reduce((sum, n) => sum + n, 0);
    for (const card of ordered) {
        if (total >= target)
            break;
        const current = copies.get(card.id) ?? 0;
        if (current >= maxCopies(card))
            continue;
        copies.set(card.id, current + 1);
        total += 1;
    }
    while (total > target) {
        const weakest = [...copies.entries()]
            .filter(([, n]) => n > 0)
            .sort((a, b) => {
            const rankA = ordered.findIndex((card) => card.id === a[0]);
            const rankB = ordered.findIndex((card) => card.id === b[0]);
            return rankB - rankA;
        })[0];
        if (!weakest)
            break;
        copies.set(weakest[0], weakest[1] - 1);
        if (weakest[1] - 1 <= 0)
            copies.delete(weakest[0]);
        total -= 1;
    }
    const main = [...copies.entries()].flatMap(([id, count]) => Array.from({ length: count }, () => id));
    const mainCards = main.map((id) => (0, catalog_1.getCard)(id));
    const facts = feasibilityOf(mainCards);
    const extraReasons = [];
    const extra = [];
    for (const card of ownedSpecials) {
        if (extra.length >= deck_1.EXTRA_MAX)
            break;
        const check = specialFeasible(card, facts);
        if (!check.ok)
            continue;
        extra.push(card.id);
        extraReasons.push(`${card.name} — ${check.reason}`);
    }
    const counts = (category) => mainCards.filter((card) => takesCategory(card, category)).length;
    const scoreTotal = scored
        .filter((entry) => copies.has(entry.card.id))
        .reduce((sum, entry) => sum + entry.score * (copies.get(entry.card.id) ?? 0), 0);
    const orderedTags = [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag]) => tag);
    const notes = [
        `Archétype ${STRATEGY_LABEL[strategy]} déduit du catalogue possédé.`,
        `Univers dominant : ${universe} (bonus de synergie aux cartes de cet univers).`,
        orderedTags.length ? `Tags partagés privilégiés : ${orderedTags.join(', ')}.` : 'Aucun tag partagé notable.',
        `${extra.length} invocation(s) spéciale(s) retenue(s) selon les conditions réellement réalisables.`,
    ];
    const deck = {
        id: `auto-${strategy}-${Date.now().toString(36)}`,
        name: `Auto · ${STRATEGY_LABEL[strategy]} (${main.length})`,
        main,
        extra,
    };
    const validation = (0, deck_1.validateDeck)(main, extra);
    return {
        deck,
        report: {
            strategy,
            strategyLabel: STRATEGY_LABEL[strategy],
            universe,
            universeName: (0, catalog_1.universeOf)(universe).name,
            tags: orderedTags,
            score: Math.round(scoreTotal),
            monsters: counts('character'),
            spells: counts('spell'),
            traps: counts('trap'),
            terrains: counts('terrain'),
            specials: extra.length,
            extraReasons,
            notes,
        },
        errors: validation.errors,
    };
}
