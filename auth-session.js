/**
 * AdaAja — Supabase Auth Session Utilities
 * Menyediakan kompatibilitas sementara untuk halaman lama
 * yang masih membaca localStorage dengan key "user".
 */
(() => {
  const client = window.adaajaSupabase;

  if (!client) {
    throw new Error("Supabase client belum diinisialisasi.");
  }

  function buildLegacyUser(authUser, profile = {}) {
    return {
      user_id: authUser.id,
      email: authUser.email || "",
      email_verified: Boolean(authUser.email_confirmed_at),
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
      const {
        data: { user },
        error
      } = await client.auth.getUser();

      if (error) {
        throw error;
      }

      currentUser = user;
    }

    if (!currentUser) {
      localStorage.removeItem("user");
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
      throw error;
    }

    return session;
  }

  async function getCurrentUser() {
    const {
      data: { user },
      error
    } = await client.auth.getUser();

    if (error) {
      throw error;
    }

    return user;
  }

  async function signOut() {
    const { error } = await client.auth.signOut();

    localStorage.removeItem("user");
    localStorage.removeItem("supabase_user_id");

    if (error) {
      throw error;
    }
  }

  async function requireAuth(redirectPage = "login.html") {
    const session = await getSession();

    if (session?.user) {
      return session.user;
    }

    const currentPage =
      location.pathname.split("/").pop() +
      location.search +
      location.hash;

    localStorage.setItem("redirectAfterLogin", currentPage);
    location.href = redirectPage;
    return null;
  }

  window.AdaAjaAuth = {
    getSession,
    getCurrentUser,
    syncLegacyUser,
    fetchOwnProfile,
    signOut,
    requireAuth
  };

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      localStorage.removeItem("user");
      localStorage.removeItem("supabase_user_id");
      return;
    }

    if (
      session?.user &&
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
