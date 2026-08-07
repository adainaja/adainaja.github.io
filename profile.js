const usernameElement = document.getElementById("username");
const emailElement = document.getElementById("email");
const photoElement = document.getElementById("photo");
const avatarElement = document.getElementById("avatar");
const avatarFallback = document.getElementById("avatarFallback");
const joinedDateElement = document.getElementById("joinedDate");
const balanceValueElement = document.getElementById("balanceValue");
const productCountElement = document.getElementById("productCount");
const orderCountElement = document.getElementById("orderCount");
const confirmLogoutButton = document.getElementById("confirmLogout");

let currentSession = null;
let currentProfile = null;

function formatJoinedDate(value) {
  if (!value) return "Member aktif";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Member aktif";
  }

  return `Bergabung ${new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric"
  }).format(date)}`;
}

function formatBalance(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

async function getSession() {
  if (currentSession?.user) return currentSession;

  const { data, error } = await window.adaajaSupabase.auth.getSession();

  if (error) {
    throw error;
  }

  currentSession = data.session || null;
  return currentSession;
}

async function requireLogin() {
  try {
    const session = await getSession();

    if (session?.user) return session;

    localStorage.setItem("redirectAfterLogin", "profile.html");
    location.replace("login.html");
    return null;
  } catch (error) {
    console.error("Profile auth check failed:", error);
    localStorage.setItem("redirectAfterLogin", "profile.html");
    location.replace("login.html");
    return null;
  }
}

async function loadProfile(userId) {
  const { data, error } = await window.adaajaSupabase
    .from("profiles")
    .select("id, username, full_name, phone, avatar_url, bio, status, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  currentProfile = data || null;
  return currentProfile;
}

async function hasPrimaryAddress(userId) {
  const { data, error } = await window.adaajaSupabase
    .from("addresses")
    .select("id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Primary address check failed:", error);
    return false;
  }

  return Boolean(data?.id);
}

function renderIdentity(session, profile) {
  const displayName =
    profile?.username ||
    profile?.full_name ||
    session.user.user_metadata?.full_name ||
    session.user.email?.split("@")[0] ||
    "Pengguna AdaAja";

  usernameElement.textContent = displayName;
  emailElement.textContent = session.user.email || "Email belum tersedia";

  avatarFallback.textContent =
    String(displayName).charAt(0).toUpperCase();

  if (profile?.avatar_url) {
    photoElement.src = profile.avatar_url;

    photoElement.onload = () => {
      avatarElement.classList.add("has-image");
    };

    photoElement.onerror = () => {
      avatarElement.classList.remove("has-image");
      photoElement.removeAttribute("src");
    };
  } else {
    avatarElement.classList.remove("has-image");
    photoElement.removeAttribute("src");
  }

  joinedDateElement.textContent =
    formatJoinedDate(
      profile?.created_at ||
      session.user.created_at
    );
}

async function loadProductCount(userId) {
  try {
    const { count, error } = await window.adaajaSupabase
      .from("products")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("seller_id", userId);

    if (error) throw error;

    productCountElement.textContent =
      Number(count || 0);
  } catch (error) {
    console.warn("Product count failed:", error);
    productCountElement.textContent = "0";
  }
}

async function loadOrderCount(userId) {
  /*
    Orders belum menjadi bagian migrasi yang sudah kita finalkan.
    Fungsi ini mencoba membaca tabel orders jika sudah tersedia.
    Jika struktur/tabel belum siap, halaman profil tetap berjalan
    dan nilai pesanan tetap 0.
  */
  try {
    const { count, error } = await window.adaajaSupabase
      .from("orders")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("buyer_id", userId);

    if (error) throw error;

    orderCountElement.textContent =
      Number(count || 0);
  } catch (error) {
    console.warn("Order count belum tersedia:", error);
    orderCountElement.textContent = "0";
  }
}

async function loadBalance(userId) {
  /*
    Saldo belum dipastikan struktur tabelnya pada migrasi saat ini.
    Coba membaca wallets jika tabel tersebut sudah tersedia.
    Jika belum, tampilkan Rp0 tanpa memblokir halaman.
  */
  try {
    const { data, error } = await window.adaajaSupabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    balanceValueElement.textContent =
      formatBalance(data?.balance || 0);
  } catch (error) {
    console.warn("Wallet balance belum tersedia:", error);
    balanceValueElement.textContent = formatBalance(0);
  }
}

async function renderProfile() {
  const session = await requireLogin();
  if (!session?.user) return;

  try {
    const profile = await loadProfile(session.user.id);
    const addressReady = await hasPrimaryAddress(session.user.id);

    if (!profile?.username || !addressReady) {
      location.replace("complete-account.html");
      return;
    }

    renderIdentity(session, profile);

    await Promise.all([
      loadProductCount(session.user.id),
      loadOrderCount(session.user.id),
      loadBalance(session.user.id)
    ]);
  } catch (error) {
    console.error("Profile load failed:", error);

    // Bila profile row hilang tetapi Auth masih aktif, arahkan kembali
    // ke Complete Account agar data akun dapat dibuat ulang.
    if (currentSession?.user) {
      location.replace("complete-account.html");
      return;
    }

    location.replace("login.html");
  }
}

function openLogoutPanel() {
  const panel = document.getElementById("logoutPanel");

  panel.classList.add("active");
  panel.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function closeLogoutPanel() {
  const panel = document.getElementById("logoutPanel");

  panel.classList.remove("active");
  panel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panel-open");
}

async function logout() {
  confirmLogoutButton.disabled = true;
  confirmLogoutButton.textContent = "Keluar...";

  try {
    const { error } = await window.adaajaSupabase.auth.signOut({
      scope: "local"
    });

    if (error) {
      console.warn("Supabase signOut warning:", error);
    }
  } catch (error) {
    console.warn("Supabase signOut failed:", error);
  } finally {
    currentSession = null;
    currentProfile = null;

    [
      "user",
      "login_email",
      "register_email",
      "register_username",
      "register_password",
      "pending_registration_email",
      "pending_registration_name",
      "new_user",
      "redirectAfterLogin"
    ].forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    /*
      Fallback untuk membersihkan token Supabase yang mungkin masih
      tertinggal di browser jika signOut gagal karena token/server.
    */
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        localStorage.removeItem(key);
      }
    });

    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        sessionStorage.removeItem(key);
      }
    });

    location.replace("home.html?logged_out=1");
  }
}

document
  .getElementById("editProfileButton")
  .addEventListener("click", () => {
    location.href = "edit-profile.html";
  });

document
  .getElementById("settingsButton")
  .addEventListener("click", () => {
    location.href = "settings.html";
  });

document
  .getElementById("logoutButton")
  .addEventListener("click", openLogoutPanel);

document
  .getElementById("logoutBackdrop")
  .addEventListener("click", closeLogoutPanel);

document
  .getElementById("cancelLogout")
  .addEventListener("click", closeLogoutPanel);

confirmLogoutButton
  .addEventListener("click", logout);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLogoutPanel();
  }
});

/*
  Jika session berubah (misalnya logout di tab lain),
  profil ikut menyesuaikan.
*/
window.adaajaSupabase.auth.onAuthStateChange(
  (event, session) => {
    currentSession = session || null;

    if (
      event === "SIGNED_OUT" &&
      !location.pathname.endsWith("/login.html")
    ) {
      location.replace("login.html");
    }
  }
);

renderProfile();
