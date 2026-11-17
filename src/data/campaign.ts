/** Campagne courte : 3 chapitres, duels scriptés contre des decks thématiques. */
import type { Deck } from '../engine/deck'
import type { Difficulty } from '../engine/ai'

const repeat = (ids: string[], times: number): string[] => ids.flatMap((id) => Array.from({ length: times }, () => id))

export interface CampaignMission {
  id: string
  chapter: number
  title: string
  subtitle: string
  briefing: string
  difficulty: Difficulty
  reward: number
  deck: Deck
}

const FAILLE_DECK: Deck = {
  id: 'camp-faille',
  name: 'Faille du Multivers',
  main: [
    ...repeat(
      [
        'chr-xlr8',
        'chr-surchauffe',
        'chr-quatre-bras',
        'chr-diamantane',
        'chr-waybig',
        'chr-finn',
        'chr-jake',
        'chr-marceline',
        'chr-chewing-gum',
        'chr-roi-des-glaces',
      ],
      3,
    ),
    ...repeat(['tec-grande-claque', 'tec-tarte', 'mag-flash', 'trap-filet', 'ter-lab'], 3),
  ],
  extra: ['spx-faille', 'spx-forme-ultime'],
}

const NUIT_DECK: Deck = {
  id: 'camp-nuit',
  name: 'Nuit du Dessin Animé',
  main: [
    ...repeat(
      ['chr-bugs', 'chr-daffy', 'chr-titi', 'chr-taz', 'chr-bip-bip', 'chr-vil-coyote', 'chr-tom', 'chr-jerry', 'chr-spike', 'chr-tuffy'],
      3,
    ),
    ...repeat(['tec-tarte', 'mag-ouverture', 'trap-banane', 'trap-embuscade', 'ter-nuit'], 3),
  ],
  extra: ['spx-duo', 'spx-echo'],
}

const TITANS_DECK: Deck = {
  id: 'camp-titans',
  name: 'Assaut des Titans',
  main: [
    ...repeat(
      ['chr-robin', 'chr-starfire', 'chr-raven', 'chr-cyborg', 'chr-beast-boy', 'chr-deathstroke', 'chr-bulle', 'chr-belles', 'chr-buttercup', 'chr-mojo-jojo'],
      3,
    ),
    ...repeat(['tec-masse', 'mag-tempete', 'trap-miroir', 'trap-annulation', 'ter-tour'], 3),
  ],
  extra: ['spx-trone', 'spx-heros-multivers'],
}

export const CAMPAIGN: CampaignMission[] = [
  {
    id: 'ch1-faille',
    chapter: 1,
    title: 'La Faille s’ouvre',
    subtitle: 'Bikini Bottom · niveau débutante',
    briefing:
      'Une faille relie les univers. Des créatures de Ben 10 déboulent dans une ville tranquille. Repousse la première vague pour stabiliser la zone.',
    difficulty: 'beginner',
    reward: 80,
    deck: FAILLE_DECK,
  },
  {
    id: 'ch2-nuit',
    chapter: 2,
    title: 'La Nuit du Dessin Animé',
    subtitle: 'Toonville · niveau normale',
    briefing:
      'Les Toons ont pris le contrôle du ciel. Leur terrain renforce tous leurs personnages : jouez la défense et contre-attaquez au bon moment.',
    difficulty: 'normal',
    reward: 120,
    deck: NUIT_DECK,
  },
  {
    id: 'ch3-titans',
    chapter: 3,
    title: 'Assaut des Titans',
    subtitle: 'Tour des Titans · niveau avancée',
    briefing:
      'La Tour concentre l’énergie du multivers. Le boss invoque depuis l’Extra Deck : verrouillez le plateau avant qu’il ne se renforce.',
    difficulty: 'advanced',
    reward: 200,
    deck: TITANS_DECK,
  },
]

export function missionById(id: string): CampaignMission | undefined {
  return CAMPAIGN.find((mission) => mission.id === id)
}
