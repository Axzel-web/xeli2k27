import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  "https://efkkzgsuyttdfatihfxb.supabase.co";

export const SUPABASE_ANON_KEY =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVma2t6Z3N1eXR0ZGZhdGloZnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NjMxODksImV4cCI6MjEwNTUzOTE4OX0.ZVrhRDCUSyRuCQLH_cD22qlBDhVW4bLA40sBpl8_Cj0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Check connectivity to Supabase project
 */
export async function checkSupabaseConnection() {
  const start = performance.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
    });
    const latency = Math.round(performance.now() - start);
    if (res.ok) {
      return { ok: true, latency, projectRef: "efkkzgsuyttdfatihfxb" };
    }
    return { ok: false, error: `HTTP ${res.status}`, latency };
  } catch (err) {
    return { ok: false, error: err.message || "Network unreachable" };
  }
}

/**
 * Get current session user
 */
export async function getCurrentSupabaseUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Sign up with Supabase Email & Password
 */
export async function signUpSupabase(email, password, hunterName = "Hunter") {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        hunter_name: hunterName,
      },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with Supabase Email & Password
 */
export async function signInSupabase(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out from Supabase
 */
export async function signOutSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Save Hunter State to Supabase
 * 1. Always saves to auth user metadata (guaranteed to work with zero database setup).
 * 2. Attempts upsert to 'hunter_profiles' or 'xeli_progress' if the table exists.
 */
export async function saveProgressToSupabase(state) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("No active Supabase session. Please sign in first.");
  }

  const payload = {
    updated_at: new Date().toISOString(),
    hunter_name: state.name,
    level: state.level,
    exp: state.exp,
    total_exp: state.totalExp,
    streak: state.streak,
    guild: state.guild,
    quests: state.quests,
    solved_challenges: state.solvedChallenges,
    unlocked_achievements: state.unlockedAchievements,
    activity: state.activity,
    daily_exp: state.dailyExp,
  };

  // 1. Save directly into user metadata
  const { error: metaErr } = await supabase.auth.updateUser({
    data: {
      hunter_progress: payload,
      last_synced_at: payload.updated_at,
    },
  });

  if (metaErr) {
    console.warn("Could not save to Supabase user metadata:", metaErr);
  }

  // 2. Try saving to 'hunter_profiles' table if it has been created
  try {
    const { error: tableErr } = await supabase
      .from("hunter_profiles")
      .upsert({
        user_id: user.id,
        email: user.email,
        ...payload,
      });

    if (tableErr) {
      // If table doesn't exist (PGRST205), that's fine - user metadata holds the data
      if (tableErr.code !== "PGRST205") {
        console.warn("Table sync error (table may need RLS policy or creation):", tableErr);
      }
    }
  } catch (err) {
    console.warn("Table upsert skipped:", err);
  }

  return { success: true, timestamp: payload.updated_at };
}

/**
 * Load Hunter State from Supabase
 */
export async function loadProgressFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("No active Supabase session. Please sign in first.");
  }

  // 1. First check if 'hunter_profiles' table has data
  try {
    const { data: tableData, error: tableErr } = await supabase
      .from("hunter_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tableErr && tableData) {
      return {
        name: tableData.hunter_name || user.user_metadata?.hunter_name || "Hunter",
        level: tableData.level || 1,
        exp: tableData.exp || 0,
        totalExp: tableData.total_exp || 0,
        streak: tableData.streak || 0,
        guild: tableData.guild || "Hunter Association",
        quests: tableData.quests || [],
        solvedChallenges: tableData.solved_challenges || [],
        unlockedAchievements: tableData.unlocked_achievements || [],
        activity: tableData.activity || [],
        dailyExp: tableData.daily_exp || {},
        syncedAt: tableData.updated_at,
      };
    }
  } catch (err) {
    console.warn("Table select skipped:", err);
  }

  // 2. Fall back to user metadata
  const p = user.user_metadata?.hunter_progress;
  if (p) {
    return {
      name: p.hunter_name || user.user_metadata?.hunter_name || "Hunter",
      level: p.level || 1,
      exp: p.exp || 0,
      totalExp: p.total_exp || 0,
      streak: p.streak || 0,
      guild: p.guild || "Hunter Association",
      quests: p.quests || [],
      solvedChallenges: p.solved_challenges || [],
      unlockedAchievements: p.unlocked_achievements || [],
      activity: p.activity || [],
      dailyExp: p.daily_exp || {},
      syncedAt: p.updated_at || user.user_metadata?.last_synced_at,
    };
  }

  return null;
}

// ============================================================================
// RPC FUNCTIONS CALLABLE FROM FRONTEND
// ============================================================================

/**
 * Call the add_exp RPC function
 * @param {number} amount
 * @param {string} reason
 */
export async function rpcAddExp(amount, reason = "EXP awarded") {
  const { data, error } = await supabase.rpc("add_exp", {
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

/**
 * Call the complete_quest RPC function
 * @param {string} questId UUID of the quest
 */
export async function rpcCompleteQuest(questId) {
  const { data, error } = await supabase.rpc("complete_quest", {
    p_quest_id: questId,
  });
  if (error) throw error;
  return data;
}

/**
 * Call the claim_challenge RPC function
 * @param {string} challengeId static ID like 'net-cli-modes-exploration'
 * @param {number} exp reward amount
 * @param {string} title display title
 */
export async function rpcClaimChallenge(challengeId, exp, title) {
  const { data, error } = await supabase.rpc("claim_challenge", {
    p_challenge_id: challengeId,
    p_exp: exp,
    p_title: title,
  });
  if (error) throw error;
  return data;
}

/**
 * Call the reset_progress RPC function
 */
export async function rpcResetProgress() {
  const { data, error } = await supabase.rpc("reset_progress");
  if (error) throw error;
  return data;
}

/**
 * Fetch full hunter state across all tables in a single RPC request
 */
export async function rpcGetHunterFullState() {
  const { data, error } = await supabase.rpc("get_hunter_full_state");
  if (error) throw error;
  return data;
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Get current session
 */
export async function getSupabaseSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Subscribe to auth state changes
 */
export function onSupabaseAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

