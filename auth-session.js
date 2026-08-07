/**
 * AdaAja — Supabase Auth Session Utilities
 * Final session layer for password-based Supabase Auth.
 */
(() => {
  const client = window.adaajaSupabase;

  if (!client) {
    throw new Error("Supabase client belum diinisialisasi.");
  }

  const LEGACY_KEYS = [
    "user",
    "supabase_user_id",
    "login_email",
    "register_email",
    "register_username",
    "register_password",
    "pending_registration_email",
    "pending_registration_name",
    "new_user"
  ];

  function clearLegacyAuthState() {
    LEGACY_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }

  function clearSupabaseStorageFallback() {
    for (const storage of [localStorage, sessionStorage]) {
      Object.keys(storage).forEach((key) => {
        if (
          key.startsWith("sb-") &&
          (
            key.endsWith("-auth-token") ||
            key.includes("auth-token")
          )
        ) {
          storage.removeItem(key);
        }
      });
    }
  }

  function buildLegacyUser(authUser, profile = {}) {
    return {
      user_id: authUser.id,
      email: authUser.email || "",
      username:
        profile.username ||
        authUser.user_metadata?.username ||
        "",
      nama_lengkap:
        profile.full_name ||
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        "",
      foto_profile:
        profile.avatar_url ||
        authUser.user_metadata?.avatar_url ||
        authUser.user_metadata?.picture ||
        "",
      phone: profile.phone || authUser.phone || "",
      role: "buyer",
      status: profile.status || "active",
      provider:
        authUser.app_metadata?.provider ||
        "email"
    };
  }

  async function fetchOwnProfile(userId) {
    const { data, error } = await client
      .from("profiles")
      .select(
        "id, username, full_name, phone, avatar_url, bio, status, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("Profil belum dapat dibaca:", error.message);
      return null;
    }

    return data;
  }

  async function syncLegacyUser(authUser = null) {
    let currentUser = authUser;

    if (!currentUser) {
      currentUser = await getCurrentUser();
    }

    if (!currentUser) {
      localStorage.removeItem("user");
      localStorage.removeItem("supabase_user_id");
      return null;
    }

    const profile = await fetchOwnProfile(currentUser.id);
    const legacyUser = buildLegacyUser(currentUser, profile || {});

    localStorage.setItem("user", JSON.stringify(legacyUser));
    localStorage.setItem("supabase_user_id", currentUser.id);

    return legacyUser;
  }

  async function getSession() {
    const {
      data: { session },
      error
    } = await client.auth.getSession();

    if (error) {
      return null;
    }

    return session || null;
  }

  /**
   * Source of truth for "is this user actually logged in?"
   * getUser() validates the auth user rather than trusting a cached local session.
   */
  async function getCurrentUser() {
    try {
      const {
        data: { user },
        error
      } = await client.auth.getUser();

      if (error) {
        const message = String(error.message || "").toLowerCase();

        if (
          message.includes("auth session missing") ||
          message.includes("session missing") ||
          message.includes("invalid refresh token") ||
          message.includes("refresh token")
        ) {
          clearLegacyAuthState();
          return null;
        }

        throw error;
      }

      if (!user) {
        clearLegacyAuthState();
        return null;
      }

      return user;
    } catch (error) {
      console.warn("Validasi user gagal:", error.message);
      return null;
    }
  }

  async function isAuthenticated() {
    const user = await getCurrentUser();
    return Boolean(user);
  }

  async function signOut() {
    /*
      Jangan redirect sebelum SIGNED_OUT/cleanup selesai.
      scope local cukup untuk logout browser/perangkat ini.
    */
    try {
      const { error } = await client.auth.signOut({ scope: "local" });

      if (error) {
        console.warn("Supabase signOut:", error.message);
      }
    } catch (error) {
      console.warn("Supabase signOut gagal:", error.message);
    }

    clearLegacyAuthState();
    clearSupabaseStorageFallback();

    /*
      Verifikasi setelah cleanup. Jika SDK masih memegang state di memory,
      panggil signOut sekali lagi setelah storage dibersihkan.
    */
    try {
      const {
        data: { session }
      } = await client.auth.getSession();

      if (session) {
        await client.auth.signOut({ scope: "local" }).catch(() => {});
        clearSupabaseStorageFallback();
      }
    } catch {
      // Tidak ada session = kondisi logout yang diharapkan.
    }

    return true;
  }

  async function requireAuth(redirectPage = "login.html") {
    const user = await getCurrentUser();

    if (user) {
      return user;
    }

    const currentPage =
      location.pathname.split("/").pop() +
      location.search +
      location.hash;

    localStorage.setItem("redirectAfterLogin", currentPage);
    location.replace(redirectPage);
    return null;
  }

  window.AdaAjaAuth = {
    getSession,
    getCurrentUser,
    isAuthenticated,
    syncLegacyUser,
    fetchOwnProfile,
    signOut,
    requireAuth,
    clearLegacyAuthState
  };

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session?.user) {
      clearLegacyAuthState();
      return;
    }

    if (
      ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)
    ) {
      window.setTimeout(() => {
        syncLegacyUser(session.user).catch((error) => {
          console.warn("Gagal menyinkronkan sesi:", error.message);
        });
      }, 0);
    }
  });
})();
