<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const pseudo = ref('')
const password = ref('')
const confirmPassword = ref('')
const formError = ref<string | null>(null)
const successMsg = ref<string | null>(null)

async function handleSubmit() {
  formError.value = null
  successMsg.value = null

  if (!email.value || !password.value) {
    formError.value = 'Veuillez remplir tous les champs obligatoires.'
    return
  }

  if (mode.value === 'register') {
    if (!pseudo.value) {
      formError.value = 'Veuillez choisir un pseudo de duelliste.'
      return
    }
    if (password.value.length < 6) {
      formError.value = 'Le mot de passe doit comporter au moins 6 caractères.'
      return
    }
    if (password.value !== confirmPassword.value) {
      formError.value = 'Les mots de passe ne correspondent pas.'
      return
    }

    try {
      await auth.register(email.value, password.value, pseudo.value)
      successMsg.value = 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.'
      mode.value = 'login'
    } catch (e: any) {
      formError.value = e.message || "Échec de l'inscription."
    }
  } else {
    try {
      await auth.login(email.value, password.value)
      router.push('/')
    } catch (e: any) {
      formError.value = e.message || 'Échec de la connexion. Vérifiez votre email et mot de passe.'
    }
  }
}
</script>

<template>
  <div class="auth-view">
    <div class="auth-card">
      <div class="auth-card__header">
        <h1 class="auth-card__title">
          {{ mode === 'login' ? 'Connexion Duelliste' : 'Rejoindre le Multivers' }}
        </h1>
        <p class="auth-card__subtitle">
          {{ mode === 'login' ? 'Accédez à votre collection et combattez en ligne.' : 'Créez votre compte pour enregistrer vos cartes et affronter d’autres joueurs.' }}
        </p>
      </div>

      <!-- Avertissement si Supabase n'est pas encore lié dans .env -->
      <div v-if="!auth.isConfigured" class="notice notice--warn auth-card__notice">
        <span>⚠</span>
        <div>
          <b>Supabase non configuré :</b>
          Ajoutez vos clés <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans le fichier <code>.env</code>.
        </div>
      </div>

      <div v-if="formError" class="notice notice--error auth-card__notice">
        <span>✖</span>
        <span>{{ formError }}</span>
      </div>

      <div v-if="successMsg" class="notice notice--ok auth-card__notice">
        <span>✔</span>
        <span>{{ successMsg }}</span>
      </div>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div v-if="mode === 'register'" class="form-group">
          <label for="pseudo">Pseudo Duelliste</label>
          <input
            id="pseudo"
            v-model.trim="pseudo"
            type="text"
            placeholder="Ex: YugiCartoon, BenMaster..."
            required
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <label for="email">Adresse Email</label>
          <input
            id="email"
            v-model.trim="email"
            type="email"
            placeholder="duelliste@multiverse.tcg"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
            autocomplete="current-password"
          />
        </div>

        <div v-if="mode === 'register'" class="form-group">
          <label for="confirmPassword">Confirmer le mot de passe</label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            placeholder="••••••••"
            required
            autocomplete="new-password"
          />
        </div>

        <button
          type="submit"
          class="btn btn--gold auth-form__submit"
          :disabled="auth.loading || !auth.isConfigured"
        >
          {{ auth.loading ? 'Patientez...' : (mode === 'login' ? 'Se connecter' : 'Créer mon compte') }}
        </button>
      </form>

      <div class="auth-card__footer">
        <span v-if="mode === 'login'">Pas encore de compte ?</span>
        <span v-else>Déjà un compte ?</span>
        <button
          type="button"
          class="auth-card__toggle-btn"
          @click="mode = mode === 'login' ? 'register' : 'login'; formError = null;"
        >
          {{ mode === 'login' ? 'Créer un compte' : 'Se connecter' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-view {
  min-height: calc(100vh - 120px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  background: linear-gradient(180deg, rgba(16, 22, 54, 0.95), rgba(8, 10, 24, 0.98));
  border: 1px solid rgba(126, 231, 255, 0.25);
  border-radius: 20px;
  padding: 32px 28px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(126, 231, 255, 0.1);
  backdrop-filter: blur(10px);
}

.auth-card__header {
  text-align: center;
  margin-bottom: 24px;
}

.auth-card__title {
  font-family: var(--font-display);
  font-size: 24px;
  letter-spacing: 0.05em;
  color: var(--gold-bright);
  margin: 0 0 8px;
}

.auth-card__subtitle {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.4;
  margin: 0;
}

.auth-card__notice {
  margin-bottom: 20px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
}

.form-group input {
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line);
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 10px rgba(230, 195, 119, 0.25);
}

.auth-form__submit {
  margin-top: 10px;
  width: 100%;
  padding: 12px;
  font-size: 15px;
}

.auth-card__footer {
  margin-top: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.auth-card__toggle-btn {
  background: none;
  border: none;
  color: var(--gold-bright);
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  transition: opacity 0.2s;
}

.auth-card__toggle-btn:hover {
  opacity: 0.8;
}
</style>
