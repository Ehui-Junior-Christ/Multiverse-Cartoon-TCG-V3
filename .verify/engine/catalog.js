"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPECIAL_LABEL = exports.RARITY_ORDER = exports.RARITY_LABEL = exports.CATEGORY_LABEL = exports.CARD_INDEX = exports.UNIVERSES = exports.CARDS = void 0;
exports.getCard = getCard;
exports.universeOf = universeOf;
exports.artUrl = artUrl;
/** Accès au catalogue (données déclaratives générées par scripts/build-catalog.mjs). */
const cards_json_1 = __importDefault(require("../data/cards.json"));
const universes_json_1 = __importDefault(require("../data/universes.json"));
const art_manifest_json_1 = __importDefault(require("../data/art-manifest.json"));
exports.CARDS = cards_json_1.default;
exports.UNIVERSES = universes_json_1.default;
/** Illustrations réelles trouvées dans public/assets/cards (généré par `npm run art`). */
const ART_MANIFEST = art_manifest_json_1.default;
exports.CARD_INDEX = new Map(exports.CARDS.map((c) => [c.id, c]));
function getCard(id) {
    const card = exports.CARD_INDEX.get(id);
    if (!card)
        throw new Error(`Carte inconnue: ${id}`);
    return card;
}
exports.CATEGORY_LABEL = {
    character: 'Personnage',
    technique: 'Technique',
    equipment: 'Équipement',
    support: 'Soutien',
    magic: 'Magie',
    trap: 'Piège',
    terrain: 'Terrain',
    special: 'Invocation spéciale',
};
exports.RARITY_LABEL = {
    common: 'Common',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
    ultra: 'Ultra Legendary',
};
exports.RARITY_ORDER = {
    common: 0,
    rare: 1,
    epic: 2,
    legendary: 3,
    ultra: 4,
};
exports.SPECIAL_LABEL = {
    crossover: 'Crossover',
    awakening: 'Éveil',
    sacrifice: 'Sacrifice',
    dimensional: 'Dimensionnelle',
    resonance: 'Résonance',
};
function universeOf(id) {
    return exports.UNIVERSES.find((u) => u.id === id) ?? { id, name: id, hue: 220, glyph: '✧' };
}
const FOLDER = {
    character: 'characters',
    terrain: 'terrains',
    technique: 'techniques',
    equipment: 'equipments',
    support: 'supports',
    magic: 'magics',
    trap: 'traps',
    special: 'specials',
};
/**
 * Noms de fichiers stables : remplacer le placeholder par l'asset final suffit.
 * `scripts/art-manifest.mjs` indexe les fichiers présents et les formats raster
 * priment sur le SVG placeholder.
 */
function artUrl(card) {
    return ART_MANIFEST[card.id] ?? `/assets/cards/${FOLDER[card.category]}/${card.id}.svg`;
}
