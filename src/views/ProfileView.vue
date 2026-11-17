<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProfileStore } from '../stores/profile'
import { XP_REWARDS } from '../engine/progress'

const store = useProfileStore()
const nameInput = ref(store.profile.name)
const saved = ref(false)
const avatarSaved = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const progress = computed(() => store.progress)

/** Replay d'un duel archivé (journal d'événements). */
const replayLog = ref<{ title: string; lines: string[]; index: number } | null>(null)

function triggerAvatarUpload() {
  fileInput.value?.click()
}

function handleAvatarFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const rawData = e.target?.result as string
    if (!rawData) return

    // Redimensionnement via Canvas pour garder une image légère et nette (~200x200)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const maxDim = 200
      let w = img.width
      let h = img.height
      if (w > h) {
        if (w > maxDim) {
          h = Math.round((h * maxDim) / w)
          w = maxDim
        }
      } else {
        if (h > maxDim) {
          w = Math.round((w * maxDim) / h)
          h = maxDim
        }
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h)
        const compressed = canvas.toDataURL('image/jpeg', 0.85)
        store.setAvatar(compressed)
        avatarSaved.value = true
        window.setTimeout(() => (avatarSaved.value = false), 2500)
      }
    }
    img.src = rawData
  }
  reader.readAsDataURL(file)
  // Reset input so same file can be re-selected if wanted
  target.value = ''
}

function removeAvatar() {
  store.setAvatar('')
  avatarSaved.value = true
  window.setTimeout(() => (avatarSaved.value = false), 2500)
}

function openReplay(match: { opponent: string; playedAt: string; log?: string[] }): void {
  if (!match.log?.length) return
  replayLog.value = {
    title: `${match.opponent} — ${new Date(match.playedAt).toLocaleString('fr-FR')}`,
    lines: match.log,
    index: match.log.length,
  }
}

function closeReplay(): void {
  replayLog.value = null
}

async function saveName() {
  const name = nameInput.value.trim()
  if (!name) return
  await store.pushProfile({ name })
  saved.value = true
  window.setTimeout(() => (saved.value = false), 2200)
}
</script>

<template>
  <div class="profile">
    <div class="section-title">
      <h1>Profil</h1>
      <span>Progression du compte — aucun avantage en duel</span>
    </div>

    <div class="profile__grid">
      <section class="panel">
        <div class="panel__head"><h2>Duelliste</h2></div>
        <div class="panel__body">
          <div class="profile__identity">
            <div class="profile__avatar-container">
              <div
                class="avatar avatar--interactive"
                :title="store.profile.avatar ? 'Cliquer pour changer la photo' : 'Ajouter une photo de profil'"
                @click="triggerAvatarUpload"
              >
                <img
                  v-if="store.profile.avatar"
                  :src="store.profile.avatar"
                  alt="Photo de profil"
                  class="avatar__img"
                />
                <span v-else>{{ store.profile.name.slice(0, 2).toUpperCase() }}</span>
                <div class="avatar__overlay">
                  <span class="avatar__overlay-icon">📷</span>
                </div>
              </div>

              <button
                v-if="store.profile.avatar"
                class="avatar__delete-btn"
                type="button"
                title="Supprimer la photo"
                @click="removeAvatar"
              >
                ✕
              </button>

              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="handleAvatarFile"
              />
            </div>

            <div style="flex: 1; min-width: 0">
              <label class="field-label" for="player-name">Nom affiché</label>
              <div style="display: flex; gap: 8px">
                <input id="player-name" v-model="nameInput" class="input" maxlength="24" />
                <button class="btn btn--sm" type="button" @click="saveName">OK</button>
                <button
                  class="btn btn--sm btn--ghost"
                  type="button"
                  title="Choisir une photo"
                  @click="triggerAvatarUpload"
                >
                  📷 Photo
                </button>
              </div>
              <p v-if="saved" class="hint" style="color: var(--ok)">Nom enregistré.</p>
              <p v-if="avatarSaved" class="hint" style="color: var(--cyan)">Photo de profil mise à jour !</p>
            </div>
          </div>

          <div class="profile__level">
            <div class="profile__levelhead">
              <span>Niveau {{ progress.level }}</span>
              <span>{{ progress.level >= 100 ? 'Maximum' : `${progress.into} / ${progress.needed} XP` }}</span>
            </div>
            <div class="xpbar"><div class="xpbar__fill" :style="{ width: `${progress.ratio * 100}%` }" /></div>
            <p class="hint" style="margin-top: 8px">
              {{ store.profile.xp }} XP au total. Gain : +{{ XP_REWARDS.aiWin }} XP par victoire contre l'IA, +{{ XP_REWARDS.aiLoss }} XP par duel terminé.
            </p>
          </div>

          <div class="profile__stats">
            <div class="deckstat"><span>Victoires</span><b>{{ store.profile.wins }}</b></div>
            <div class="deckstat"><span>Défaites</span><b>{{ store.profile.losses }}</b></div>
            <div class="deckstat"><span>Classement</span><b>{{ store.elo }}</b></div>
            <div class="deckstat"><span>Jetons JM</span><b>{{ store.profile.jm }}</b></div>
            <div class="deckstat"><span>Cartes</span><b>{{ store.ownedCount }}</b></div>
            <div class="deckstat"><span>Duels</span><b>{{ store.matchesPlayed }}</b></div>
          </div>

          <p class="hint" style="margin-top: 12px">
            ELO 1v1 local (départ 1000). K = 40 sur les 20 premiers duels, puis 24 (16 pour les
            niveaux 50+). Saison de 8 semaines, reset doux 1000 + 0,75 × (ELO − 1000).
          </p>

          <p class="hint" style="margin-top: 14px">
            Les Jetons Multivers (JM) ne servent jamais pendant un duel et aucune boutique n'est active dans cette version.
          </p>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head">
          <h2>Sauvegarde locale</h2>
          <span class="chip" :class="store.offline ? 'chip--warn' : 'chip--ok'">
            {{ store.offline ? 'Navigateur' : 'SQLite' }}
          </span>
        </div>
        <div class="panel__body">
          <p class="hint">
            Profil, collection, decks et historique sont stockés localement dans
            <code>data/multiverse.db</code> (SQLite). Exportez un instantané JSON pour archiver une version.
          </p>
          <div style="display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap">
            <button class="btn btn--gold" type="button" @click="store.exportBackup()">⤓ Exporter la sauvegarde</button>
            <button class="btn" type="button" @click="store.load()">↻ Recharger depuis la base</button>
          </div>
          <p class="hint" style="margin-top: 14px">
            Restauration : arrêtez l'application et remplacez <code>data/multiverse.db</code> par une copie, ou
            utilisez <code>npm run backup</code>. La procédure complète est dans le README.
          </p>
          <p v-if="store.offline" class="notice" style="margin-top: 12px">
            <span>⚠</span>
            <span>
              API locale injoignable ({{ store.loadingError ?? 'connexion refusée' }}). Les données sont conservées dans ce
              navigateur ; lancez <code>npm run dev</code> pour retrouver la base SQLite.
            </span>
          </p>
        </div>
      </section>
    </div>

    <section class="panel" style="margin-top: 18px">
      <div class="panel__head">
        <h2>Historique des duels</h2>
        <span class="chip">{{ store.matches.length }}</span>
      </div>
      <div class="panel__body">
        <p v-if="!store.matches.length" class="hint">Aucun duel terminé pour l'instant. Lancez un duel contre l'IA.</p>
        <table v-else class="matches">
          <thead>
            <tr>
              <th>Date</th>
              <th>Adversaire</th>
              <th>Deck</th>
              <th>Résultat</th>
              <th>Tours</th>
              <th>Motif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="match in store.matches" :key="match.id">
              <td>{{ new Date(match.playedAt).toLocaleString('fr-FR') }}</td>
              <td>{{ match.opponent }}</td>
              <td>{{ match.deckName }}</td>
              <td>
                <span class="chip" :class="match.result === 'win' ? 'chip--ok' : 'chip--warn'">
                  {{ match.result === 'win' ? 'Victoire' : 'Défaite' }}
                </span>
              </td>
              <td>{{ match.turns }}</td>
              <td>{{ match.reason }}</td>
              <td>
                <button
                  v-if="match.log?.length"
                  class="btn btn--sm"
                  type="button"
                  title="Revoir le duel"
                  @click="openReplay(match)"
                >
                  ⟲
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Replay d'un duel archivé -->
    <div v-if="replayLog" class="modal" @click.self="closeReplay">
      <div class="panel replay">
        <div class="panel__head">
          <h2>Replay</h2>
          <button class="btn btn--sm" type="button" style="margin-left: auto" @click="closeReplay">Fermer</button>
        </div>
        <div class="panel__body">
          <p class="hint">{{ replayLog.title }}</p>
          <div class="replay__controls">
            <button class="btn btn--sm" type="button" @click="replayLog.index = Math.max(0, replayLog.index - 1)">◀</button>
            <button class="btn btn--sm" type="button" @click="replayLog.index = Math.min(replayLog.lines.length, replayLog.index + 1)">▶</button>
            <button class="btn btn--sm" type="button" @click="replayLog.index = 0">⟲ Début</button>
            <button class="btn btn--sm btn--gold" type="button" @click="replayLog.index = replayLog.lines.length">Tout</button>
            <span class="hint">{{ replayLog.index }} / {{ replayLog.lines.length }}</span>
          </div>
          <ol class="log replay__log">
            <li v-for="(line, index) in replayLog.lines.slice(0, replayLog.index)" :key="index" class="log__item">
              <span class="log__icon" aria-hidden="true">·</span>
              <span class="log__text">{{ line }}</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  </div>
</template>
