/**
 * Générateur pseudo-aléatoire déterministe (LCG 32 bits).
 * L'état est stocké dans le duel : une même graine + les mêmes actions
 * produisent exactement le même duel (rejouabilité et tests).
 */

export function nextRandom(state: { rngState: number }): number {
  // Numerical Recipes LCG
  state.rngState = (Math.imul(state.rngState, 1664525) + 1013904223) >>> 0
  return state.rngState / 0x100000000
}

export function nextInt(state: { rngState: number }, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0
  return Math.floor(nextRandom(state) * maxExclusive)
}

export function shuffle<T>(state: { rngState: number }, items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextInt(state, i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function seedState(seed: number): number {
  return (seed >>> 0) || 0x9e3779b9
}
