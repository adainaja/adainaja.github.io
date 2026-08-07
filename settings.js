const SETTINGS_KEY = "adaaja_app_settings_v1";

const pushNotifications = document.getElementById("pushNotifications");
const emailNotifications = document.getElementById("emailNotifications");
const promoNotifications = document.getElementById("promoNotifications");
const personalization = document.getElementById("personalization");
const logoutPanel = document.getElementById("logoutPanel");
const loadingOverlay = document.getElementById("loadingOverlay");
const loaderTitle = document.getElementById("loaderTitle");
const loaderSubtitle = document.getElementById("loaderSubtitle");
const toast = document.getElementById("toast");

let currentUser = null;
let currentProfile = null;
let toastTimer = null;

function setLoading(active, title = "Memuat pengaturan", subtitle = "Mohon tunggu sebentar...") {
  loaderTitle.textContent = title;
  loaderSubtitle.textContent = subtitle;
  loadingOverlay.classList.toggle("active", active);
  loadingOverlay.setAttribute("aria-hidden", active ? "false" : "true");
  document.body.classList.toggle("loading", active);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

async function requireUser() {
  const user = await window.AdaAjaAuth.getCurrentUser();

  if (!user) {
    localStorage.setItem("redirectAfterLogin", "settings.html");
    location.replace("login.html");
    return null;
  }

  currentUser = user;
  return user;
}

function getLocalSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLocalSettings() {
  const data = {
    push_notifications: pushNotifications.checked,
    email_notifications: emailNotifications.checked,
    promo_notifications: promoNotifications.checked,
    personalization: personalization.checked
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  showToast("Preferensi berhasil disimpan.");
}

function applyLocalSettings() {
  const data = getLocalSettings();

  pushNotifications.checked =
    data.push_notifications !== false;

  emailNotifications.checked =
    data.email_notifications !== false;

  promoNotifications.checked =
    Boolean(data.promo_notifications);

  personalization.checked =
    data.personalization !== false;
}

async function loadAccount() {
  const user = await requireUser();
  if (!user) return;

  setLoading(true);

  try {
    const { data, error } = await window.adaajaSupabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    currentProfile = data || {};

    const displayName =
      currentProfile.username ||
      currentProfile.full_name ||
      user.email?.split("@")[0] ||
      "Pengguna AdaAja";

    document.getElementById("heroName").textContent = displayName;
    document.getElementById("heroEmail").textContent =
      user.email || "Email belum tersedia";

    const avatar = document.getElementById("heroAvatar");

    if (currentProfile.avatar_url) {
      avatar.innerHTML =
        `<img src="${currentProfile.avatar_url}" alt="${displayName}">`;
    } else {
      document.getElementById("heroAvatarFallback").textContent =
        String(displayName).charAt(0).toUpperCase();
    }

    applyLocalSettings();
  } catch (error) {
    console.error("Settings load failed:", error);
    showToast(error.message || "Pengaturan gagal dimuat.");
  } finally {
    setLoading(false);
  }
}

[
  pushNotifications,
  emailNotifications,
  promoNotifications,
  personalization
].forEach((input) => {
  input.addEventListener("change", saveLocalSettings);
});

document.getElementById("changePasswordButton").addEventListener("click", async () => {
  const user = await requireUser();
  if (!user?.email) return;

  setLoading(
    true,
    "Menyiapkan keamanan",
    "Mengirim instruksi perubahan password..."
  );

  try {
    const { error } = await window.adaajaSupabase.auth.resetPasswordForEmail(
      user.email,
      {
        redirectTo: new URL("reset-password.html", location.href).href
      }
    );

    if (error) throw error;

    showToast("Instruksi perubahan password dikirim ke email.");
  } catch (error) {
    console.error("Reset password failed:", error);
    showToast(error.message || "Instruksi password gagal dikirim.");
  } finally {
    setLoading(false);
  }
});

function openLogoutPanel() {
  logoutPanel.classList.add("active");
  logoutPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function closeLogoutPanel() {
  logoutPanel.classList.remove("active");
  logoutPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panel-open");
}

document.getElementById("logoutButton").addEventListener("click", openLogoutPanel);
document.getElementById("logoutBackdrop").addEventListener("click", closeLogoutPanel);
document.getElementById("cancelLogout").addEventListener("click", closeLogoutPanel);

document.getElementById("confirmLogout").addEventListener("click", async () => {
  setLoading(true, "Keluar dari akun", "Mengakhiri sesi AdaAja...");

  try {
    await window.AdaAjaAuth.signOut();
  } finally {
    localStorage.removeItem("redirectAfterLogin");
    location.replace(`home.html?logout=${Date.now()}`);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLogoutPanel();
  }
});

loadAccount();
