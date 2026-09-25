-- ============================================================================
-- XELI LEVELING SYSTEM — Complete Supabase PostgreSQL Schema & Backend
-- Includes: Tables, Triggers, RLS Policies, Cleanup Routines, and RPCs
-- ============================================================================

-- Enable pgcrypto / uuid generation extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. HELPER FUNCTION: Compute Hunter Rank from Level
-- E: 1–20, D: 21–40, C: 41–60, B: 61–80, A: 81–95, S: 96–100
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_hunter_rank(p_level INT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level >= 96 THEN 'S'
    WHEN p_level >= 81 THEN 'A'
    WHEN p_level >= 61 THEN 'B'
    WHEN p_level >= 41 THEN 'C'
    WHEN p_level >= 21 THEN 'D'
    ELSE 'E'
  END;
$$;

-- Helper function: Required EXP per level: 151 + 3 * level * level (Matches XELI client engine; exactly 1,000,000 EXP to reach Level 100)
CREATE OR REPLACE FUNCTION public.get_exp_required(p_level INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level >= 100 THEN 0
    WHEN p_level = 99 THEN 152 + 3 * p_level * p_level
    ELSE 151 + 3 * p_level * p_level
  END;
$$;

-- Trigger helper: auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. TABLES DEFINITION
-- ============================================================================

-- Table 1: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Hunter' CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 30),
  avatar_url TEXT,
  bio TEXT CHECK (bio IS NULL OR char_length(bio) <= 140),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  theme TEXT NOT NULL DEFAULT 'retro',
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 100),
  exp INT NOT NULL DEFAULT 0 CHECK (exp >= 0),
  total_exp INT NOT NULL DEFAULT 0 CHECK (total_exp >= 0),
  streak INT NOT NULL DEFAULT 0 CHECK (streak >= 0),
  last_active_day DATE,
  sound_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions in case table already exists
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'retro',
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_bio;
ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_bio CHECK (bio IS NULL OR char_length(bio) <= 140);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_name;
ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_name CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 30);

-- Table 2: quests
CREATE TABLE IF NOT EXISTS public.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  exp INT NOT NULL DEFAULT 25 CHECK (exp >= 0),
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Table 3: solved_challenges
CREATE TABLE IF NOT EXISTS public.solved_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,
  solved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_challenge UNIQUE (user_id, challenge_id)
);

-- Table 4: daily_exp (GitHub-style contribution heatmap)
CREATE TABLE IF NOT EXISTS public.daily_exp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  exp_earned INT NOT NULL DEFAULT 0 CHECK (exp_earned >= 0),
  CONSTRAINT uq_user_day UNIQUE (user_id, day)
);

-- Table 5: activity_log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 6: unlocked_achievements
CREATE TABLE IF NOT EXISTS public.unlocked_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_achievement UNIQUE (user_id, achievement_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quests_user_id ON public.quests(user_id);
CREATE INDEX IF NOT EXISTS idx_solved_challenges_user_id ON public.solved_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_exp_user_day ON public.daily_exp(user_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_created ON public.activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unlocked_achievements_user_id ON public.unlocked_achievements(user_id);

-- Trigger for auto-updating profiles.updated_at
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger for maintaining maximum 30 rows per user in activity_log
CREATE OR REPLACE FUNCTION public.trim_activity_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.activity_log
  WHERE id IN (
    SELECT id
    FROM public.activity_log
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 30
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trim_activity_log ON public.activity_log;
CREATE TRIGGER trg_trim_activity_log
  AFTER INSERT ON public.activity_log
  FOR EACH ROW
  EXECUTE FUNCTION public.trim_activity_log();

-- ============================================================================
-- 3. AUTH HOOK: Auto-create row in `profiles` on new signup (Email or Google OAuth)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  -- Grab name from Google metadata (full_name or name) or custom sign-up metadata, fallback to email prefix or 'Hunter'
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'hunter_name',
    split_part(NEW.email, '@', 1),
    'Hunter'
  );

  INSERT INTO public.profiles (id, name, level, exp, total_exp, streak, sound_enabled)
  VALUES (NEW.id, v_name, 1, 0, 0, 0, true)
  ON CONFLICT (id) DO UPDATE
  SET name = COALESCE(EXCLUDED.name, public.profiles.name);

  -- Default starter quest for every newly awakened hunter
  INSERT INTO public.quests (user_id, title, notes, category, exp, done)
  VALUES (
    NEW.id,
    'System Awakening: First Quest',
    'Log your initial task to activate your Hunter rank license.',
    'Training',
    50,
    false
  )
  ON CONFLICT DO NOTHING;

  -- Log initial awakening activity
  INSERT INTO public.activity_log (user_id, text)
  VALUES (
    NEW.id,
    'Awakened as E-Rank Hunter into the XELI Leveling System via ' ||
    COALESCE(NEW.raw_app_meta_data->>'provider', 'credentials') || '.'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solved_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_exp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlocked_achievements ENABLE ROW LEVEL SECURITY;

-- 4.1 Profiles policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- 4.2 Quests policies
DROP POLICY IF EXISTS "quests_all_own" ON public.quests;
CREATE POLICY "quests_all_own"
  ON public.quests FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4.3 Solved Challenges policies
DROP POLICY IF EXISTS "solved_challenges_all_own" ON public.solved_challenges;
CREATE POLICY "solved_challenges_all_own"
  ON public.solved_challenges FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4.4 Daily EXP policies
DROP POLICY IF EXISTS "daily_exp_all_own" ON public.daily_exp;
CREATE POLICY "daily_exp_all_own"
  ON public.daily_exp FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4.5 Activity Log policies
DROP POLICY IF EXISTS "activity_log_all_own" ON public.activity_log;
CREATE POLICY "activity_log_all_own"
  ON public.activity_log FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4.6 Unlocked Achievements policies
DROP POLICY IF EXISTS "unlocked_achievements_all_own" ON public.unlocked_achievements;
CREATE POLICY "unlocked_achievements_all_own"
  ON public.unlocked_achievements FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 5. BUSINESS LOGIC (Stored Procedures / RPCs)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC 1: add_exp(p_amount INT, p_reason TEXT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_exp(p_amount INT, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile public.profiles%ROWTYPE;
  v_old_level INT;
  v_new_level INT;
  v_current_exp INT;
  v_total_exp INT;
  v_streak INT;
  v_last_day DATE;
  v_today DATE := CURRENT_DATE;
  v_req_exp INT;
  v_leveled_up BOOLEAN := false;
  v_levels_gained INT := 0;
  v_old_rank TEXT;
  v_new_rank TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'EXP amount must be greater than zero';
  END IF;

  -- Lock row for update
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hunter profile not found for user %', v_user_id;
  END IF;

  v_old_level := v_profile.level;
  v_new_level := v_profile.level;
  v_current_exp := v_profile.exp + p_amount;
  v_total_exp := v_profile.total_exp + p_amount;
  v_streak := v_profile.streak;
  v_last_day := v_profile.last_active_day;

  -- 1. Level-up calculation loop
  -- Required EXP = 100 + (level - 1) * 35
  -- Max level = 100
  LOOP
    IF v_new_level >= 100 THEN
      v_new_level := 100;
      v_current_exp := 0; -- clamped at max level
      EXIT;
    END IF;

    v_req_exp := public.get_exp_required(v_new_level);

    IF v_current_exp >= v_req_exp THEN
      v_current_exp := v_current_exp - v_req_exp;
      v_new_level := v_new_level + 1;
      v_leveled_up := true;
      v_levels_gained := v_levels_gained + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  -- 2. Streak update logic
  IF v_last_day IS NULL THEN
    v_streak := 1;
  ELSIF v_last_day = v_today THEN
    -- Already active today, streak stays intact
    v_streak := v_streak;
  ELSIF v_last_day = v_today - 1 THEN
    -- Active yesterday: increment streak
    v_streak := v_streak + 1;
  ELSE
    -- Missed more than a day: reset streak to 1
    v_streak := 1;
  END IF;

  -- 3. Update profiles table
  UPDATE public.profiles
  SET
    level = v_new_level,
    exp = v_current_exp,
    total_exp = v_total_exp,
    streak = v_streak,
    last_active_day = v_today,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- 4. Upsert into daily_exp for GitHub-style activity contribution
  INSERT INTO public.daily_exp (user_id, day, exp_earned)
  VALUES (v_user_id, v_today, p_amount)
  ON CONFLICT (user_id, day)
  DO UPDATE SET exp_earned = public.daily_exp.exp_earned + EXCLUDED.exp_earned;

  -- 5. Record activity log
  INSERT INTO public.activity_log (user_id, text)
  VALUES (v_user_id, COALESCE(p_reason, 'Gained ' || p_amount || ' EXP'));

  IF v_leveled_up THEN
    INSERT INTO public.activity_log (user_id, text)
    VALUES (v_user_id, '⚡ LEVEL UP! Reached Level ' || v_new_level || ' (' || public.get_hunter_rank(v_new_level) || '-Rank)');
  END IF;

  -- Check and award milestones
  IF v_new_level >= 100 THEN
    INSERT INTO public.unlocked_achievements (user_id, achievement_id)
    VALUES (v_user_id, 'level-100')
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  IF v_streak >= 7 THEN
    INSERT INTO public.unlocked_achievements (user_id, achievement_id)
    VALUES (v_user_id, 'streak-7')
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
  END IF;

  v_old_rank := public.get_hunter_rank(v_old_level);
  v_new_rank := public.get_hunter_rank(v_new_level);

  -- 6. Return composite JSON
  RETURN jsonb_build_object(
    'success', true,
    'exp_added', p_amount,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'current_exp', v_current_exp,
    'required_exp', public.get_exp_required(v_new_level),
    'total_exp', v_total_exp,
    'streak', v_streak,
    'leveled_up', v_leveled_up,
    'levels_gained', v_levels_gained,
    'old_rank', v_old_rank,
    'new_rank', v_new_rank,
    'rank_up', (v_old_rank <> v_new_rank)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 2: complete_quest(p_quest_id UUID)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_quest(p_quest_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_quest public.quests%ROWTYPE;
  v_exp_res JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_quest
  FROM public.quests
  WHERE id = p_quest_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quest not found or does not belong to user';
  END IF;

  IF v_quest.done THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Quest is already completed',
      'quest_id', p_quest_id
    );
  END IF;

  -- Mark as done
  UPDATE public.quests
  SET done = true, completed_at = NOW()
  WHERE id = p_quest_id;

  -- Add EXP via business logic RPC
  v_exp_res := public.add_exp(v_quest.exp, 'Quest cleared: ' || v_quest.title);

  -- Award first-quest achievement if applicable
  INSERT INTO public.unlocked_achievements (user_id, achievement_id)
  VALUES (v_user_id, 'first-quest')
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'quest_id', p_quest_id,
    'title', v_quest.title,
    'exp_reward', v_quest.exp,
    'progress', v_exp_res
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 3: claim_challenge(p_challenge_id TEXT, p_exp INT, p_title TEXT)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_challenge(
  p_challenge_id TEXT,
  p_exp INT,
  p_title TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_exp_res JSONB;
  v_inserted_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert challenge if not yet solved
  INSERT INTO public.solved_challenges (user_id, challenge_id, solved_at)
  VALUES (v_user_id, p_challenge_id, NOW())
  ON CONFLICT (user_id, challenge_id) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    -- Already solved before
    RETURN jsonb_build_object(
      'success', false,
      'already_solved', true,
      'challenge_id', p_challenge_id,
      'message', 'Challenge was already claimed previously.'
    );
  END IF;

  -- Add EXP
  v_exp_res := public.add_exp(p_exp, 'Trial cleared: ' || COALESCE(p_title, p_challenge_id));

  RETURN jsonb_build_object(
    'success', true,
    'already_solved', false,
    'challenge_id', p_challenge_id,
    'exp_reward', p_exp,
    'progress', v_exp_res
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 4: reset_progress()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_progress()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Delete dependent user records
  DELETE FROM public.quests WHERE user_id = v_user_id;
  DELETE FROM public.solved_challenges WHERE user_id = v_user_id;
  DELETE FROM public.daily_exp WHERE user_id = v_user_id;
  DELETE FROM public.activity_log WHERE user_id = v_user_id;
  DELETE FROM public.unlocked_achievements WHERE user_id = v_user_id;

  -- 2. Reset profile back to Level 1
  UPDATE public.profiles
  SET
    level = 1,
    exp = 0,
    total_exp = 0,
    streak = 0,
    last_active_day = NULL,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- 3. Add default starter quest
  INSERT INTO public.quests (user_id, title, notes, category, exp, done)
  VALUES (
    v_user_id,
    'System Awakening: First Quest',
    'Log your initial task to activate your Hunter rank license.',
    'Training',
    50,
    false
  );

  -- 4. Initial reset log
  INSERT INTO public.activity_log (user_id, text)
  VALUES (v_user_id, 'Hunter progress was reset back to Level 1.');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Hunter status and history reset successfully.'
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 5: get_hunter_full_state()
-- Fetches user profile, rank, quests, solved challenges, heatmap,
-- activity log, and achievements in 1 single network request!
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hunter_full_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile RECORD;
  v_quests JSONB;
  v_challenges JSONB;
  v_daily JSONB;
  v_activity JSONB;
  v_achievements JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Profile
  SELECT
    p.id,
    p.name,
    p.avatar_url,
    p.bio,
    p.timezone,
    p.theme,
    p.email_notifications,
    p.level,
    p.exp,
    public.get_exp_required(p.level) AS exp_required,
    p.total_exp,
    p.streak,
    p.last_active_day,
    p.sound_enabled,
    public.get_hunter_rank(p.level) AS rank,
    p.created_at,
    p.updated_at
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user_id;

  -- Quests (ordered: unfinished first, then newest)
  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.done ASC, q.created_at DESC), '[]'::jsonb)
  INTO v_quests
  FROM public.quests q
  WHERE q.user_id = v_user_id;

  -- Solved challenges list of IDs
  SELECT COALESCE(jsonb_agg(sc.challenge_id), '[]'::jsonb)
  INTO v_challenges
  FROM public.solved_challenges sc
  WHERE sc.user_id = v_user_id;

  -- Daily EXP heatmap object: { "YYYY-MM-DD": exp_earned }
  SELECT COALESCE(jsonb_object_agg(de.day::text, de.exp_earned), '{}'::jsonb)
  INTO v_daily
  FROM public.daily_exp de
  WHERE de.user_id = v_user_id;

  -- Activity log (last 30 items)
  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_activity
  FROM (
    SELECT id, text, created_at
    FROM public.activity_log
    WHERE user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 30
  ) a;

  -- Unlocked achievements
  SELECT COALESCE(jsonb_agg(ua.achievement_id), '[]'::jsonb)
  INTO v_achievements
  FROM public.unlocked_achievements ua
  WHERE ua.user_id = v_user_id;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'quests', v_quests,
    'solved_challenges', v_challenges,
    'daily_exp', v_daily,
    'activity_log', v_activity,
    'unlocked_achievements', v_achievements
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 6: get_my_profile()
-- Returns full profile row for current authenticated user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile public.profiles%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', v_user_id;
  END IF;

  RETURN v_profile;
END;
$$;

-- ----------------------------------------------------------------------------
-- RPC 7: update_my_profile(...)
-- Modifies profile fields (name, avatar, bio, timezone, theme, email notifications)
-- Protected stats (id, level, exp, total_exp, streak) CANNOT be altered here.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL,
  p_theme TEXT DEFAULT NULL,
  p_email_notifications BOOLEAN DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_updated public.profiles%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate name if passed
  IF p_name IS NOT NULL THEN
    IF char_length(trim(p_name)) = 0 THEN
      RAISE EXCEPTION 'Hunter name cannot be empty';
    END IF;
    IF char_length(p_name) > 30 THEN
      RAISE EXCEPTION 'Hunter name must be at most 30 characters';
    END IF;
  END IF;

  -- Validate bio if passed
  IF p_bio IS NOT NULL AND char_length(p_bio) > 140 THEN
    RAISE EXCEPTION 'Bio must be at most 140 characters (received %)', char_length(p_bio);
  END IF;

  UPDATE public.profiles
  SET
    name = CASE WHEN p_name IS NOT NULL THEN trim(p_name) ELSE name END,
    avatar_url = CASE WHEN p_avatar_url IS NOT NULL THEN NULLIF(trim(p_avatar_url), '') ELSE avatar_url END,
    bio = CASE WHEN p_bio IS NOT NULL THEN NULLIF(p_bio, '') ELSE bio END,
    timezone = CASE WHEN p_timezone IS NOT NULL THEN p_timezone ELSE timezone END,
    theme = CASE WHEN p_theme IS NOT NULL THEN p_theme ELSE theme END,
    email_notifications = CASE WHEN p_email_notifications IS NOT NULL THEN p_email_notifications ELSE email_notifications END,
    updated_at = NOW()
  WHERE id = v_user_id
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', v_user_id;
  END IF;

  RETURN v_updated;
END;
$$;

-- ============================================================================
-- 7.1 TARGETED EXP & LEVEL RECOVERY FOR HUNTER ACCOUNTS
-- ============================================================================

-- Account 1: axzelbaril931@gmail.com / xeligirl910@gmail.com (id: a0c2b12e-6892-4016-8d29-d39c32f6f9c7)
-- Reconciles 11 completed trials (1,905 Total EXP) to Level 9 and 125 EXP
UPDATE public.profiles
SET
  level = 9,
  exp = 125,
  total_exp = GREATEST(total_exp, 1905),
  updated_at = NOW()
WHERE id = 'a0c2b12e-6892-4016-8d29-d39c32f6f9c7'
   OR id IN (
     SELECT id FROM auth.users 
     WHERE email IN ('axzelbaril931@gmail.com', 'xeligirl910@gmail.com')
   );

-- Account 2: axzelbaril460@gmail.com (id: f4b12bd2-f26a-4f98-aef2-1e883b9f1934)
-- Reconciles 18,050 Total EXP to Level 24 (Rank D), 1,605/1,879 EXP, streak 5
UPDATE public.profiles
SET
  level = 24,
  exp = 1605,
  total_exp = 18050,
  streak = 5,
  last_active_day = '2026-09-23',
  updated_at = NOW()
WHERE id = 'f4b12bd2-f26a-4f98-aef2-1e883b9f1934'
   OR id IN (
     SELECT id FROM auth.users 
     WHERE email = 'axzelbaril460@gmail.com'
   );

-- Activity Matrix Migration: August 25 - September 24, 2026 (59 submissions across 20 active days = 18,050 Total EXP)
INSERT INTO public.daily_exp (user_id, day, exp_earned)
SELECT u.id, d.day, d.exp_earned
FROM (
  SELECT id FROM public.profiles 
  WHERE id = 'f4b12bd2-f26a-4f98-aef2-1e883b9f1934'
     OR id IN (SELECT id FROM auth.users WHERE email = 'axzelbaril460@gmail.com')
) u
CROSS JOIN (
  VALUES
    ('2026-08-25'::date, 300),
    ('2026-08-26'::date, 610),
    ('2026-08-27'::date, 920),
    ('2026-08-30'::date, 310),
    ('2026-08-31'::date, 610),
    ('2026-09-01'::date, 920),
    ('2026-09-04'::date, 920),
    ('2026-09-05'::date, 920),
    ('2026-09-07'::date, 920),
    ('2026-09-08'::date, 920),
    ('2026-09-09'::date, 1220),
    ('2026-09-10'::date, 920),
    ('2026-09-11'::date, 920),
    ('2026-09-14'::date, 920),
    ('2026-09-15'::date, 920),
    ('2026-09-17'::date, 920),
    ('2026-09-18'::date, 1220),
    ('2026-09-21'::date, 920),
    ('2026-09-22'::date, 920),
    ('2026-09-23'::date, 1820)
) AS d(day, exp_earned)
ON CONFLICT (user_id, day) DO UPDATE
SET exp_earned = EXCLUDED.exp_earned;

-- ============================================================================
-- 8. GLOBAL LEADERBOARD & SECURITY ENHANCEMENTS
-- ============================================================================

-- Composite index on total_exp, level, created_at for fast ranking
CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard_xp
  ON public.profiles (total_exp DESC, level DESC, created_at ASC);

-- Public SELECT permission so all real registered users can be queried for the leaderboard
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_leaderboard" ON public.profiles;
CREATE POLICY "profiles_select_leaderboard"
  ON public.profiles FOR SELECT
  TO public
  USING (true);

-- Trigger to prevent client-side tampering of total_exp, exp, and level
CREATE OR REPLACE FUNCTION public.protect_profile_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF current_user <> 'postgres' AND (current_setting('role', true) = 'authenticated' OR current_setting('role', true) = 'anon') THEN
    IF NEW.total_exp IS DISTINCT FROM OLD.total_exp OR
       NEW.exp IS DISTINCT FROM OLD.exp OR
       NEW.level IS DISTINCT FROM OLD.level THEN
      RAISE EXCEPTION 'Security Policy Violation: Direct client-side modification of XP and Level is prohibited. Progress must be earned through verified quests and trials.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_stats ON public.profiles;
CREATE TRIGGER trg_protect_profile_stats
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_stats();

-- Database RPC function: get_global_leaderboard
CREATE OR REPLACE FUNCTION public.get_global_leaderboard(
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_top_users JSONB;
  v_my_standing JSONB := NULL;
  v_total_count INT := 0;
  v_limit INT := LEAST(GREATEST(p_limit, 1), 100);
  v_offset INT := GREATEST(p_offset, 0);
BEGIN
  SELECT COUNT(*)
  INTO v_total_count
  FROM public.profiles
  WHERE (p_search IS NULL OR trim(p_search) = '' OR name ILIKE '%' || trim(p_search) || '%');

  WITH ranked_users AS (
    SELECT
      p.id,
      p.name,
      p.avatar_url,
      p.level,
      p.total_exp,
      p.streak,
      public.get_hunter_rank(p.level) AS rank_letter,
      p.created_at,
      p.updated_at,
      ROW_NUMBER() OVER (
        ORDER BY p.total_exp DESC, p.level DESC, p.created_at ASC
      ) AS global_rank
    FROM public.profiles p
    WHERE (p_search IS NULL OR trim(p_search) = '' OR p.name ILIKE '%' || trim(p_search) || '%')
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'global_rank', u.global_rank,
        'name', u.name,
        'avatar_url', u.avatar_url,
        'level', u.level,
        'total_exp', u.total_exp,
        'streak', u.streak,
        'rank_letter', u.rank_letter,
        'created_at', u.created_at,
        'is_current_user', (v_user_id IS NOT NULL AND u.id = v_user_id)
      )
    ),
    '[]'::jsonb
  )
  INTO v_top_users
  FROM (
    SELECT *
    FROM ranked_users
    ORDER BY global_rank ASC
    LIMIT v_limit OFFSET v_offset
  ) u;

  IF v_user_id IS NOT NULL THEN
    WITH ranked_all AS (
      SELECT
        p.id,
        p.name,
        p.avatar_url,
        p.level,
        p.total_exp,
        p.streak,
        public.get_hunter_rank(p.level) AS rank_letter,
        p.created_at,
        ROW_NUMBER() OVER (
          ORDER BY p.total_exp DESC, p.level DESC, p.created_at ASC
        ) AS global_rank
      FROM public.profiles p
    )
    SELECT jsonb_build_object(
      'id', r.id,
      'global_rank', r.global_rank,
      'name', r.name,
      'avatar_url', r.avatar_url,
      'level', r.level,
      'total_exp', r.total_exp,
      'streak', r.streak,
      'rank_letter', r.rank_letter,
      'created_at', r.created_at,
      'is_current_user', true
    )
    INTO v_my_standing
    FROM ranked_all r
    WHERE r.id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'users', v_top_users,
    'my_standing', v_my_standing,
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_leaderboard TO anon, authenticated;
