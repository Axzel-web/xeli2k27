-- ============================================================================
-- XELI Leveling System: Profile Settings Migration
-- Adds profile customization columns, check constraints, RLS policies,
-- auto-updating timestamp trigger, and secure RPC functions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTEND THE `profiles` TABLE
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'retro',
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ----------------------------------------------------------------------------
-- 2. VALIDATION CHECK CONSTRAINTS
-- ----------------------------------------------------------------------------
-- Bio: optional, max 140 characters
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_bio;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_bio
  CHECK (bio IS NULL OR char_length(bio) <= 140);

-- Name: required, non-empty, max 30 characters
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_name;
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_name
  CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 30);

-- ----------------------------------------------------------------------------
-- 3. AUTO-UPDATE TRIGGER FOR `updated_at`
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4.1 Users can only SELECT their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 4.2 Users can only UPDATE their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4.3 Explicitly ensure NO DELETE policy exists on profiles
-- Client-side deletion is prohibited; account deletion must pass through
-- the secure delete_my_account Edge Function using the Service Role.
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_any" ON public.profiles;

-- ----------------------------------------------------------------------------
-- 5. RPC FUNCTION: get_my_profile()
-- Returns the full profile row for auth.uid()
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
-- 6. RPC FUNCTION: update_my_profile(...)
-- Updates profile fields for the authenticated user without allowing
-- modification of system gameplay stats (id, level, exp, total_exp, streak).
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

  -- Update only provided fields.
  -- Protected columns (id, level, exp, total_exp, streak) are never touched here.
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
