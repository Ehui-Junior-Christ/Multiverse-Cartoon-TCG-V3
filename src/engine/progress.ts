/** Progression du compte : niveaux 1..100, aucun avantage en duel. */

export const MAX_LEVEL = 100

/** XP nécessaire pour passer du niveau `level` au suivant (brief §10). */
export function xpForLevel(level: number): number {
  return 100 + 10 * (level - 1)
}

export function levelFromXp(xp: number): number {
  let level = 1
  let remaining = Math.max(0, xp)
  while (level < MAX_LEVEL && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level += 1
  }
  return level
}

export function xpProgress(xp: number): { level: number; into: number; needed: number; ratio: number } {
  let level = 1
  let remaining = Math.max(0, xp)
  while (level < MAX_LEVEL && remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level += 1
  }
  const needed = level >= MAX_LEVEL ? 0 : xpForLevel(level)
  return {
    level,
    into: remaining,
    needed,
    ratio: needed === 0 ? 1 : Math.min(1, remaining / needed),
  }
}

/** Barème de la première démo : duel IA uniquement (brief §10). */
export const XP_REWARDS = {
  aiWin: 30,
  aiLoss: 10,
} as const

/* ------------------------------------------------------------------ */
/* ELO 1v1 local (brief §10)                                           */
/* ------------------------------------------------------------------ */

export const ELO_START = 1000
export const ELO_AI_RATING = 1000
export const SEASON_WEEKS = 8

/** K dépend de l'expérience : 40 sur les 20 premiers matchs, 24 ensuite, 16 pour les vétérans. */
export function eloKFactor(matchesPlayed: number, level: number): number {
  if (matchesPlayed < 20) return 40
  if (level >= 50) return 16
  return 24
}

/** Nouveau classement après un duel. `score` = 1 victoire, 0 défaite. */
export function nextElo(current: number, score: 0 | 1, k: number, opponent = ELO_AI_RATING): number {
  const expected = 1 / (1 + 10 ** ((opponent - current) / 400))
  return Math.round(current + k * (score - expected))
}

/** Reset doux de saison : 1000 + 0,75 × (ancien − 1000). */
export function softResetElo(current: number): number {
  return Math.round(ELO_START + 0.75 * (current - ELO_START))
}

/** Vrai si la saison de 8 semaines est terminée. */
export function seasonExpired(startedAt: string | null | undefined, now = Date.now()): boolean {
  if (!startedAt) return false
  const started = new Date(startedAt).getTime()
  if (Number.isNaN(started)) return false
  return now - started >= SEASON_WEEKS * 7 * 24 * 60 * 60 * 1000
}
