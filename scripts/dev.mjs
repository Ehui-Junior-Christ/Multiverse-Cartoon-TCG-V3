/**
 * Lance l'API locale (SQLite, 8787) et Vite (5173) ensemble.
 *
 * Robuste aux anciennes instances :
 *  - si l'API répond déjà sur 8787, elle est réutilisée ;
 *  - si Vite ne peut pas prendre 5173, son URL réelle est affichée ;
 *  - l'arrêt d'un service n'entraîne pas l'arrêt de l'autre.
 */
import { spawn } from 'node:child_process'
import net from 'node:net'

const API_PORT = 8787
const WEB_PORT = 5173
const children = []
let stopping = false

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    const done = (value) => {
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(800)
    socket.on('connect', () => done(true))
    socket.on('timeout', () => done(false))
    socket.on('error', () => done(false))
  })
}

async function apiHealthy() {
  try {
    const response = await fetch(`http://127.0.0.1:${API_PORT}/api/health`)
    return response.ok
  } catch {
    return false
  }
}

function run(name, command, extraEnv = {}) {
  const child = spawn(command, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1', ...extraEnv },
  })
  children.push({ name, child })
  child.on('exit', (code) => {
    if (stopping) return
    console.log(`\n[dev] ${name} s'est arrêté (code ${code}). Les autres services continuent.`)
  })
  return child
}

function shutdown() {
  if (stopping) return
  stopping = true
  for (const { child } of children) {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

if (await apiHealthy()) {
  console.log(`[dev] API déjà active sur ${API_PORT} — réutilisation de l'instance existante.`)
} else if (await portOpen(API_PORT)) {
  console.log(
    `[dev] Le port ${API_PORT} est occupé par un autre programme.\n` +
      '      Libérez-le avec :  node scripts/free-ports.mjs --kill',
  )
} else {
  run('api', 'npx tsx server/index.ts')
}

if (await portOpen(WEB_PORT)) {
  console.log(
    `[dev] Le port ${WEB_PORT} est occupé : Vite va choisir un autre port.\n` +
      '      Pour repartir proprement :  node scripts/free-ports.mjs --kill',
  )
}

run('web', 'npx vite')

console.log(`
  ✦ MULTIVERSE CARTOON TCG — prototype local
  Interface : http://localhost:${WEB_PORT}   (ou le port affiché par Vite ci-dessous)
  API       : http://127.0.0.1:${API_PORT}/api/health
`)
