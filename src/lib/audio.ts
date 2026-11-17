/**
 * Effets sonores générés par Web Audio : aucun fichier audio à fournir.
 * Optionnels et désactivables (brief §12 et §14 phase 7).
 */

export type SfxKind = 'draw' | 'attack' | 'damage' | 'destroy' | 'summon' | 'win' | 'lose' | 'open'

const MUTE_KEY = 'mv-muted'

let muted = localStorage.getItem(MUTE_KEY) === '1'
let context: AudioContext | null = null

function ensureContext(): AudioContext | null {
  if (muted) return null
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      context = new Ctor()
    }
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

interface Tone {
  freq: number
  to?: number
  duration: number
  type?: OscillatorType
  gain?: number
}

const RECIPES: Record<SfxKind, Tone[]> = {
  draw: [{ freq: 620, to: 880, duration: 0.09, type: 'triangle', gain: 0.05 }],
  summon: [
    { freq: 320, to: 640, duration: 0.12, type: 'sawtooth', gain: 0.045 },
    { freq: 640, duration: 0.1, type: 'triangle', gain: 0.04 },
  ],
  attack: [{ freq: 200, to: 90, duration: 0.14, type: 'square', gain: 0.06 }],
  damage: [{ freq: 110, to: 60, duration: 0.22, type: 'sawtooth', gain: 0.07 }],
  destroy: [{ freq: 90, to: 40, duration: 0.32, type: 'square', gain: 0.07 }],
  open: [{ freq: 500, to: 900, duration: 0.14, type: 'triangle', gain: 0.05 }],
  win: [
    { freq: 523, duration: 0.12, type: 'triangle', gain: 0.06 },
    { freq: 659, duration: 0.12, type: 'triangle', gain: 0.06 },
    { freq: 784, duration: 0.2, type: 'triangle', gain: 0.06 },
  ],
  lose: [
    { freq: 392, duration: 0.16, type: 'sine', gain: 0.06 },
    { freq: 294, duration: 0.28, type: 'sine', gain: 0.06 },
  ],
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  if (muted) void context?.close().catch(() => undefined)
  if (muted) context = null
}

/** Joue un effet sonore court. Sans effet si le son est coupé ou l'API absente. */
export function playSfx(kind: SfxKind): void {
  const ctx = ensureContext()
  if (!ctx) return
  let start = ctx.currentTime
  for (const tone of RECIPES[kind]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = tone.type ?? 'sine'
    osc.frequency.setValueAtTime(tone.freq, start)
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, tone.to), start + tone.duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.05, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + tone.duration + 0.02)
    start += tone.duration * 0.8
  }
}
