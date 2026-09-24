-- ============================================================================
-- XELI LEVELING SYSTEM: Global Leaderboard & Security Migration
-- 1. Adds composite index on (total_exp DESC, level DESC, created_at ASC)
-- 2. Configures Row Level Security (RLS) policies:
--    - Public SELECT permission so all registered hunters are visible on leaderboard
--    - Strict UPDATE protection preventing client-side modification of total_exp, exp, level
-- 3. Database function get_global_leaderboard() for database-side ranking and Top 100
-- ============================================================================

-- 1. High-performance composite index for leaderboard ranking
CREATE INDEX IF NOT EXISTS idx_profiles_leaderboard_xp
  ON public.profiles (total_exp DESC, level DESC, created_at ASC);

-- 2. Row Level Security (RLS) policies for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2.1 Allow public read access to profile leaderboard fields
-- Both anonymous and authenticated users can view real registered users
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_leaderboard" ON public.profiles;
CREATE POLICY "profiles_select_leaderboard"
  ON public.profiles FOR SELECT
  TO public
  USING (true);

-- 2.2 Users can only update their own profile row
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2.3 Strict Database Trigger: Prevent client-side modification of XP, Level, and Rank
-- Any attempt to alter total_exp, exp, or level directly via client UPDATE is rejected.
-- XP and Level must only be modified via verified server-side SECURITY DEFINER RPCs
-- (e.g. add_exp, complete_quest, claim_challenge).
CREATE OR REPLACE FUNCTION public.protect_profile_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the update is coming from a client session (authenticated or anon)
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

-- 3. High-Performance Database Function: get_global_leaderboard
-- Calculates global rank using window functions on the database server.
-- Returns Top 100 (or paginated) + current user's exact global position even if outside Top 100.
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
  -- Total count of registered hunters (matching optional search)
  SELECT COUNT(*)
  INTO v_total_count
  FROM public.profiles
  WHERE (p_search IS NULL OR trim(p_search) = '' OR name ILIKE '%' || trim(p_search) || '%');

  -- Calculate rank with window function on server side
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

  -- If user ID provided or authenticated, find their exact global standing across entire DB
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

-- Grant execution to anon and authenticated clients
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard TO anon, authenticated;
