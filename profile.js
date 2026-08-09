const usernameElement = document.getElementById("username");
const emailElement = document.getElementById("email");
const photoElement = document.getElementById("photo");
const avatarElement = document.getElementById("avatar");
const avatarFallback = document.getElementById("avatarFallback");
const joinedDateElement = document.getElementById("joinedDate");

const fullNameValue = document.getElementById("fullNameValue");
const emailValue = document.getElementById("emailValue");
const phoneValue = document.getElementById("phoneValue");
const bioValue = document.getElementById("bioValue");

const addressLabel = document.getElementById("addressLabel");
const addressTitle = document.getElementById("addressTitle");
const addressDetail = document.getElementById("addressDetail");

const confirmLogoutButton = document.getElementById("confirmLogout");

let currentSession = null;
let currentProfile = null;

function formatJoinedDate(value) {
  if (!value) return "Member aktif";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Member aktif";

  return `Bergabung ${new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric"
  }).format(date)}`;
}

async function getSession(forceFresh = false) {
  if (!forceFresh && currentSession?.user) return currentSession;

  const { data, error } = await window.adaajaSupabase.auth.getSession();
  if (error) throw error;

  currentSession = data.session || null;
  return currentSession;
}

async function requireLogin() {
  try {
    const session = await getSession(true);

    if (session?.user) {
      currentSession = session;
      return session;
    }
  } catch (error) {
    console.warn("Session check failed:", error);
  }

  currentSession = null;
  localStorage.setItem("redirectAfterLogin", "profile.html");
  location.replace("login.html");
  return null;
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

async function loadPrimaryAddress(userId) {
  const { data, error } = await window.adaajaSupabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Primary address load failed:", error);
    return null;
  }

  return data || null;
}

function firstValue(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
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
  joinedDateElement.textContent = formatJoinedDate(
    profile?.created_at || session.user.created_at
  );

  avatarFallback.textContent = String(displayName).charAt(0).toUpperCase();

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

  fullNameValue.textContent =
    profile?.full_name ||
    session.user.user_metadata?.full_name ||
    "Belum diisi";

  emailValue.textContent =
    session.user.email ||
    "Belum tersedia";

  phoneValue.textContent =
    profile?.phone ||
    session.user.phone ||
    "Belum diisi";

  bioValue.textContent =
    profile?.bio ||
    "Belum ada bio";
}

function renderAddress(address) {
  if (!address) {
    addressLabel.textContent = "ALAMAT BELUM DITAMBAHKAN";
    addressTitle.textContent = "Tambahkan alamat utama";
    addressDetail.textContent =
      "Alamat utama diperlukan untuk pengiriman dan transaksi tertentu.";
    return;
  }

  const title =
    firstValue(address, [
      "address_detail",
      "detail",
      "street_address",
      "address_line",
      "full_address",
      "label"
    ]) || "Alamat utama";

  const regionParts = [
    firstValue(address, ["village", "kelurahan"]),
    firstValue(address, ["district", "kecamatan"]),
    firstValue(address, ["city", "regency", "kota"]),
    firstValue(address, ["province", "provinsi"]),
    firstValue(address, ["postal_code", "postcode", "zip_code"])
  ].filter(Boolean);

  addressLabel.textContent =
    firstValue(address, ["label", "name"])?.toUpperCase() || "ALAMAT UTAMA";

  addressTitle.textContent = title;
  addressDetail.textContent =
    regionParts.join(", ") ||
    firstValue(address, ["full_address", "address"]) ||
    "Detail wilayah belum tersedia.";
}

async function renderProfile() {
  const session = await requireLogin();
  if (!session?.user) return;

  try {
    const [profile, primaryAddress] = await Promise.all([
      loadProfile(session.user.id),
      loadPrimaryAddress(session.user.id)
    ]);

    // Profile tetap bisa dibuka meskipun alamat belum tersedia.
    // Hanya profile row yang benar-benar hilang yang diarahkan ke complete account.
    if (!profile) {
      location.replace("complete-account.html");
      return;
    }

    renderIdentity(session, profile);
    renderAddress(primaryAddress);
  } catch (error) {
    console.error("Profile load failed:", error);

    if (currentSession?.user) {
      // Hindari loop ke complete-account hanya karena alamat gagal dibaca.
      renderAddress(null);
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
    await window.AdaAjaAuth.signOut();
  } finally {
    currentSession = null;
    currentProfile = null;
    localStorage.removeItem("redirectAfterLogin");
    location.replace(`home.html?logout=${Date.now()}`);
  }
}

document.getElementById("logoutButton").addEventListener("click", openLogoutPanel);
document.getElementById("logoutBackdrop").addEventListener("click", closeLogoutPanel);
document.getElementById("cancelLogout").addEventListener("click", closeLogoutPanel);
confirmLogoutButton.addEventListener("click", logout);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLogoutPanel();
});

window.adaajaSupabase.auth.onAuthStateChange((event, session) => {
  currentSession = session || null;

  if (event === "SIGNED_OUT" && !location.pathname.endsWith("/login.html")) {
    location.replace("login.html");
  }
});

window.addEventListener("pageshow", () => {
  currentSession = null;
  currentProfile = null;
  renderProfile();
});

renderProfile();
