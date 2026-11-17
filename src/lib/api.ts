/** Client de l'API locale (serveur Node + SQLite sur le port 8787). */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!response.ok) {
    let message = `Erreur ${response.status}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      /* corps non JSON */
    }
    throw new Error(message)
  }
  return (await response.json()) as T
}

export const api = {
  bootstrap: <T>() => request<T>('/api/bootstrap'),
  saveProfile: <T>(body: { name: string; avatar?: string | null; elo?: number; seasonStartedAt?: string | null }) =>
    request<T>('/api/profile', { method: 'PUT', body: JSON.stringify(body) }),
  saveDeck: <T>(deck: { id: string; name: string; main: string[]; extra: string[] }) =>
    request<T>('/api/decks', { method: 'POST', body: JSON.stringify(deck) }),
  deleteDeck: <T>(id: string) => request<T>(`/api/decks/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  recordMatch: <T>(body: { result: 'win' | 'loss'; turns: number; opponent: string; deckName: string; reason: string; log?: string[] }) =>
    request<T>('/api/matches', { method: 'POST', body: JSON.stringify(body) }),
  openBooster: <T>(body: { kind: string; universe?: string; seed: number }) =>
    request<T>('/api/boosters', { method: 'POST', body: JSON.stringify(body) }),
  health: <T>() => request<T>('/api/health'),
}


