"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TURN_SECONDS = exports.STARTING_HAND = exports.START_LP = exports.EXTRA_MAX = exports.MAX_COPIES = exports.DECK_MAX = exports.DECK_MIN = void 0;
exports.validateDeck = validateDeck;
exports.deckSummary = deckSummary;
/** Règles de construction de deck — partagées par le Deck Builder et le moteur. */
const catalog_1 = require("./catalog");
exports.DECK_MIN = 44;
exports.DECK_MAX = 64;
exports.MAX_COPIES = 3;
exports.EXTRA_MAX = 20;
exports.START_LP = 10_000;
exports.STARTING_HAND = 6;
exports.TURN_SECONDS = 210;
function validateDeck(main, extra) {
    const errors = [];
    const mainCount = main.length;
    const extraCount = extra.length;
    if (mainCount < exports.DECK_MIN)
        errors.push(`Le deck principal doit contenir au moins ${exports.DECK_MIN} cartes (actuellement ${mainCount}).`);
    if (mainCount > exports.DECK_MAX)
        errors.push(`Le deck principal ne peut pas dépasser ${exports.DECK_MAX} cartes (actuellement ${mainCount}).`);
    if (extraCount > exports.EXTRA_MAX)
        errors.push(`L'Extra Deck ne peut pas dépasser ${exports.EXTRA_MAX} cartes (actuellement ${extraCount}).`);
    const mainCounts = new Map();
    for (const id of main) {
        const card = catalog_1.CARD_INDEX.get(id);
        if (!card) {
            errors.push(`Carte inconnue dans le deck: ${id}`);
            continue;
        }
        if (card.category === 'special') {
            errors.push(`« ${card.name} » est une Invocation spéciale : elle appartient à l'Extra Deck.`);
            continue;
        }
        mainCounts.set(id, (mainCounts.get(id) ?? 0) + 1);
    }
    for (const [id, count] of mainCounts) {
        if (count > exports.MAX_COPIES)
            errors.push(`${(0, catalog_1.getCard)(id).name} : ${count} exemplaires (maximum ${exports.MAX_COPIES}).`);
    }
    const extraCounts = new Map();
    for (const id of extra) {
        const card = catalog_1.CARD_INDEX.get(id);
        if (!card) {
            errors.push(`Carte inconnue dans l'Extra Deck: ${id}`);
            continue;
        }
        if (card.category !== 'special') {
            errors.push(`« ${card.name} » n'est pas une Invocation spéciale : direction le deck principal.`);
            continue;
        }
        extraCounts.set(id, (extraCounts.get(id) ?? 0) + 1);
    }
    for (const [id, count] of extraCounts) {
        if (count > exports.MAX_COPIES)
            errors.push(`${(0, catalog_1.getCard)(id).name} (Extra Deck) : ${count} exemplaires (maximum ${exports.MAX_COPIES}).`);
    }
    const characterCount = main.filter((id) => catalog_1.CARD_INDEX.get(id)?.category === 'character').length;
    if (characterCount === 0)
        errors.push('Le deck doit contenir au moins un personnage.');
    return {
        valid: errors.length === 0,
        errors,
        mainCount,
        extraCount,
        uniqueMain: mainCounts.size,
        characterCount,
    };
}
function deckSummary(main, extra) {
    const cards = main.map((id) => catalog_1.CARD_INDEX.get(id)).filter((c) => Boolean(c));
    const byCategory = new Map();
    for (const c of cards)
        byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);
    return { byCategory, extraCount: extra.length };
}
