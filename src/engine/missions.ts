/**
 * Missions quotidiennes et hebdomadaires (brief §10 : six voies d'obtention).
 * Module pur : la progression est fournie par l'appelant, la récompense est
 * décidée ici. Aucune horloge implicite hors `periodKey`.
 */

export type MissionMetric = 'wins' | 'duels' | 'boosters' | 'specials'

export type MissionScope = 'daily' | 'weekly'

export interface MissionDef {
  id: string
  scope: MissionScope
  title: string
  description: string
  metric: MissionMetric
  goal: number
  reward: number
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'daily-duels',
    scope: 'daily',
    title: 'Premier sang',
    description: 'Terminer 2 duels (victoire ou défaite).',
    metric: 'duels',
    goal: 2,
    reward: 40,
  },
  {
    id: 'daily-wins',
    scope: 'daily',
    title: 'Série du jour',
    description: 'Remporter 1 duel.',
    metric: 'wins',
    goal: 1,
    reward: 60,
  },
  {
    id: 'daily-booster',
    scope: 'daily',
    title: 'Ouverture du jour',
    description: 'Ouvrir 1 booster.',
    metric: 'boosters',
    goal: 1,
    reward: 30,
  },
  {
    id: 'weekly-duels',
    scope: 'weekly',
    title: 'Marathon',
    description: 'Terminer 8 duels cette semaine.',
    metric: 'duels',
    goal: 8,
    reward: 180,
  },
  {
    id: 'weekly-specials',
    scope: 'weekly',
    title: 'Maître des invocations',
    description: 'Réaliser 3 invocations spéciales.',
    metric: 'specials',
    goal: 3,
    reward: 220,
  },
]

/** Clé de période : jour pour les quotidiennes, semaine ISO pour les hebdomadaires. */
export function periodKey(scope: MissionScope, now = new Date()): string {
  if (scope === 'daily') {
    return now.toISOString().slice(0, 10)
  }
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-S${String(week).padStart(2, '0')}`
}

export interface MissionProgress {
  period: string
  counts: Partial<Record<MissionMetric, number>>
  claimed: string[]
}

export function emptyProgress(scope: MissionScope, now = new Date()): MissionProgress {
  return { period: periodKey(scope, now), counts: {}, claimed: [] }
}

/** Remet la progression à zéro si la période a changé. */
export function normalizeProgress(
  progress: MissionProgress | undefined,
  scope: MissionScope,
  now = new Date(),
): MissionProgress {
  const key = periodKey(scope, now)
  if (!progress || progress.period !== key) return emptyProgress(scope, now)
  return progress
}

export function missionsFor(scope: MissionScope): MissionDef[] {
  return MISSIONS.filter((mission) => mission.scope === scope)
}

export function missionValue(progress: MissionProgress, mission: MissionDef): number {
  return Math.min(mission.goal, progress.counts[mission.metric] ?? 0)
}

export function isMissionComplete(progress: MissionProgress, mission: MissionDef): boolean {
  return missionValue(progress, mission) >= mission.goal
}

export function canClaim(progress: MissionProgress, mission: MissionDef): boolean {
  return isMissionComplete(progress, mission) && !progress.claimed.includes(mission.id)
}

/** Incrémente un compteur et renvoie une nouvelle progression (immuable). */
export function bumpMetric(
  progress: MissionProgress,
  metric: MissionMetric,
  amount = 1,
): MissionProgress {
  return { ...progress, counts: { ...progress.counts, [metric]: (progress.counts[metric] ?? 0) + amount } }
}

export function claimMission(progress: MissionProgress, mission: MissionDef): { progress: MissionProgress; reward: number } {
  if (!canClaim(progress, mission)) return { progress, reward: 0 }
  return { progress: { ...progress, claimed: [...progress.claimed, mission.id] }, reward: mission.reward }
}
