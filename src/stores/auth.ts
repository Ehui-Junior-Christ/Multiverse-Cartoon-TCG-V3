import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isConfigured = ref(isSupabaseConfigured)

  const isAuthenticated = computed(() => Boolean(user.value))
  const username = computed(() => {
    if (!user.value) return 'Joueur Local'
    return user.value.user_metadata?.username || user.value.email?.split('@')[0] || 'Joueur'
  })

  async function init() {
    if (!supabase) return
    try {
      loading.value = true
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      user.value = data.session?.user ?? null

      supabase.auth.onAuthStateChange((_event, currentSession) => {
        session.value = currentSession
        user.value = currentSession?.user ?? null
      })
    } catch (e: any) {
      console.warn('[auth] Erreur initialisation session:', e)
    } finally {
      loading.value = false
    }
  }

  async function register(email: string, password: string, pseudo: string) {
    if (!supabase) {
      throw new Error("Supabase n'est pas encore configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.")
    }
    error.value = null
    loading.value = true
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: pseudo,
          },
        },
      })
      if (err) throw err
      user.value = data.user
      session.value = data.session
      return data
    } catch (e: any) {
      error.value = e.message || "Erreur lors de l'inscription"
      throw e
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string) {
    if (!supabase) {
      throw new Error("Supabase n'est pas encore configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.")
    }
    error.value = null
    loading.value = true
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (err) throw err
      user.value = data.user
      session.value = data.session
      return data
    } catch (e: any) {
      error.value = e.message || 'Identifiants incorrects'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    if (!supabase) return
    loading.value = true
    try {
      await supabase.auth.signOut()
      user.value = null
      session.value = null
    } catch (e: any) {
      console.warn('[auth] Erreur déconnexion:', e)
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    session,
    loading,
    error,
    isConfigured,
    isAuthenticated,
    username,
    init,
    register,
    login,
    logout,
  }
})
