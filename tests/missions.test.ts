import { describe, expect, it } from 'vitest'
import {
  MISSIONS,
  bumpMetric,
  canClaim,
  claimMission,
  emptyProgress,
  isMissionComplete,
  missionValue,
  missionsFor,
  normalizeProgress,
  periodKey,
} from '../src/engine/missions'

describe('missions', () => {
  it('définit des missions quotidiennes et hebdomadaires positives', () => {
    expect(missionsFor('daily').length).toBeGreaterThan(0)
    expect(missionsFor('weekly').length).toBeGreaterThan(0)
    for (const mission of MISSIONS) {
      expect(mission.goal).toBeGreaterThan(0)
      expect(mission.reward).toBeGreaterThan(0)
    }
  })

  it('produit une clé de période stable par jour et par semaine', () => {
    const date = new Date('2026-03-04T12:00:00Z')
    expect(periodKey('daily', date)).toBe('2026-03-04')
    expect(periodKey('weekly', date)).toMatch(/^2026-S\d{2}$/)
    // Le même jour donne la même clé, le lendemain une autre.
    expect(periodKey('daily', new Date('2026-03-04T23:59:00Z'))).toBe('2026-03-04')
    expect(periodKey('daily', new Date('2026-03-05T00:01:00Z'))).not.toBe('2026-03-04')
  })

  it('remet la progression à zéro quand la période change', () => {
    const old = { period: '2000-01-01', counts: { duels: 3 }, claimed: ['daily-duels'] }
    const normalized = normalizeProgress(old, 'daily', new Date('2026-03-04T12:00:00Z'))
    expect(normalized.period).toBe('2026-03-04')
    expect(normalized.counts).toEqual({})
    expect(normalized.claimed).toEqual([])
  })

  it('incrémente les compteurs et complète une mission', () => {
    const mission = MISSIONS.find((entry) => entry.metric === 'duels')
    expect(mission).toBeTruthy()
    let progress = emptyProgress('daily')
    for (let i = 0; i < mission!.goal; i++) progress = bumpMetric(progress, 'duels', 1)
    expect(isMissionComplete(progress, mission!)).toBe(true)
    expect(canClaim(progress, mission!)).toBe(true)
  })

  it('ne réclame une mission qu’une seule fois', () => {
    const mission = missionsFor('daily')[0]
    let progress = emptyProgress('daily')
    for (let i = 0; i < mission.goal; i++) progress = bumpMetric(progress, mission.metric, 1)
    const first = claimMission(progress, mission)
    expect(first.reward).toBe(mission.reward)
    const second = claimMission(first.progress, mission)
    expect(second.reward).toBe(0)
  })

  it('refuse de réclamer une mission incomplète', () => {
    const mission = missionsFor('daily')[0]
    const progress = emptyProgress('daily')
    expect(canClaim(progress, mission)).toBe(false)
    expect(claimMission(progress, mission).reward).toBe(0)
  })

  it('plafonne la valeur affichée au but', () => {
    const mission = missionsFor('daily')[0]
    let progress = emptyProgress('daily')
    progress = bumpMetric(progress, mission.metric, mission.goal + 10)
    expect(missionValue(progress, mission)).toBe(mission.goal)
  })
})
