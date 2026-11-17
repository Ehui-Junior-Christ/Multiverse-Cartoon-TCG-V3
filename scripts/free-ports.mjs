/**
 * Libère les ports du prototype occupés par d'anciennes instances Node.
 *
 *   node scripts/free-ports.mjs            # affiche l'état
 *   node scripts/free-ports.mjs --kill     # arrête les anciennes instances node
 *
 * Seuls les processus `node.exe` sont arrêtés : un autre programme qui
 * utiliserait ces ports est signalé mais jamais tué.
 */
import { execFileSync } from 'node:child_process'

const PORTS = [8787, 5173]
const shouldKill = process.argv.includes('--kill')

function listListeners() {
  let output = ''
  try {
    output = execFileSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true })
  } catch {
    console.log('[ports] netstat indisponible sur ce système — vérification ignorée.')
    return []
  }
  const found = new Map()
  for (const line of output.split(/\r?\n/)) {
    if (!/LISTENING/.test(line)) continue
    const parts = line.trim().split(/\s+/)
    const local = parts[1] ?? ''
    const pid = Number(parts[parts.length - 1])
    const port = Number(local.slice(local.lastIndexOf(':') + 1))
    if (!PORTS.includes(port) || !pid) continue
    found.set(`${port}:${pid}`, { port, pid, address: local })
  }
  return [...found.values()]
}

function processName(pid) {
  try {
    const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
    })
    const match = out.match(/"([^"]+)"/)
    return match ? match[1] : '?'
  } catch {
    return '?'
  }
}

const listeners = listListeners()
if (!listeners.length) {
  console.log('[ports] 8787 et 5173 sont libres.')
  process.exit(0)
}

let killed = 0
for (const listener of listeners) {
  const name = processName(listener.pid)
  const isNode = /^node(\.exe)?$/i.test(name)
  console.log(`[ports] port ${listener.port} occupé par PID ${listener.pid} (${name})`)
  if (!shouldKill) continue
  if (!isNode) {
    console.log(`[ports] ${name} n'est pas Node : non arrêté. Fermez-le manuellement.`)
    continue
  }
  try {
    execFileSync('taskkill', ['/F', '/T', '/PID', String(listener.pid)], { stdio: 'ignore', windowsHide: true })
    killed += 1
    console.log(`[ports] PID ${listener.pid} arrêté.`)
  } catch {
    console.log(`[ports] impossible d'arrêter le PID ${listener.pid}.`)
  }
}

if (shouldKill) console.log(`[ports] ${killed} ancienne(s) instance(s) arrêtée(s).`)
else console.log('[ports] Relancez avec --kill pour arrêter les anciennes instances node.')
