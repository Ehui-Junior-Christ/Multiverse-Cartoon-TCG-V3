-- ==============================================================================
-- Schema Supabase / PostgreSQL pour Multiverse Cartoon TCG
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase
-- ==============================================================================

-- 1. Table des profils utilisateurs (liée à l'auth Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  jm INTEGER NOT NULL DEFAULT 500,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  elo INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active RLS sur profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les profils sont visibles par tous les joueurs"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Les joueurs peuvent modifier leur propre profil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. Table de la collection de cartes par joueur
CREATE TABLE IF NOT EXISTS public.user_cards (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  PRIMARY KEY (user_id, card_id)
);

ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les joueurs consultent leur propre collection"
  ON public.user_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Les joueurs modifient leur propre collection"
  ON public.user_cards FOR ALL
  USING (auth.uid() = user_id);

-- 3. Table des decks par joueur
CREATE TABLE IF NOT EXISTS public.user_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  main JSONB NOT NULL DEFAULT '[]'::jsonb,
  extra JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les joueurs gèrent leurs propres decks"
  ON public.user_decks FOR ALL
  USING (auth.uid() = user_id);

-- 4. Table des matchs et historique ELO
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  opponent_name TEXT NOT NULL,
  deck_name TEXT NOT NULL,
  result TEXT NOT NULL,
  turns INTEGER NOT NULL,
  reason TEXT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les joueurs consultent leurs matchs"
  ON public.matches FOR SELECT
  USING (auth.uid() = player_id);

CREATE POLICY "Les joueurs insèrent leurs résultats de matchs"
  ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- 5. Trigger pour créer automatiquement le profil lors de l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
