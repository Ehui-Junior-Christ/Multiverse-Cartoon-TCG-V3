/** Decks de démonstration — valides au regard des règles (GAME_RULES.md §3). */
import type { Deck } from '../engine/deck'

const repeat = (ids: string[], times: number): string[] => ids.flatMap((id) => Array.from({ length: times }, () => id))

/**
 * Deck joueur « Équipe Multivers » : 44 cartes, 10 personnages, agressif et lisible.
 * Extra Deck : 6 invocations spéciales couvrant les cinq mécaniques.
 */
export const PLAYER_DECK: Deck = {
  id: 'deck-starter',
  name: 'Équipe Multivers',
  main: [
    ...repeat(
      [
        'chr-ben-tenyson',
        'chr-finn',
        'chr-bulle',
        'chr-robin',
        'chr-bob',
        'chr-tom',
        'chr-scooby',
        'chr-bugs',
        'chr-surchauffe',
        'chr-xlr8',
      ],
      3,
    ),
    ...repeat(['tec-grande-claque', 'tec-tarte', 'mag-ouverture', 'mag-flash', 'trap-filet'], 2),
    ...repeat(['tec-gag', 'tec-attaque-combinee', 'eq-gants', 'ter-cite'], 1),
  ],
  extra: [
    'spx-heros-multivers',
    'spx-forme-ultime',
    'spx-trone',
    'spx-faille',
    'spx-frequence',
    'spx-duo',
  ],
}

/** Deck IA « Marée Cosmique » : 44 cartes, orienté contrôle et dégâts directs. */
export const AI_DECK: Deck = {
  id: 'deck-cosmique',
  name: 'Marée Cosmique',
  main: [
    ...repeat(
      [
        'chr-butch',
        'chr-roi-des-glaces',
        'chr-belles',
        'chr-raven',
        'chr-jake',
        'chr-chewing-gum',
        'chr-marceline',
        'chr-cyborg',
        'chr-mojo-jojo',
        'chr-deathstroke',
      ],
      3,
    ),
    ...repeat(['tec-fournaise', 'tec-masse'], 3),
    ...repeat(['mag-tempete', 'trap-miroir', 'trap-annulation'], 2),
    ...repeat(['eq-epee', 'ter-nuit'], 1),
  ],
  extra: ['spx-heros-multivers', 'spx-forme-ultime', 'spx-offrande', 'spx-echo', 'spx-frequence', 'spx-duo'],
}

export const DEMO_DECKS: Deck[] = [PLAYER_DECK, AI_DECK]
