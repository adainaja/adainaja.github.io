const AVATAR_BUCKET = "product-images";

const form = document.getElementById("profileForm");
const fullName = document.getElementById("fullName");
const username = document.getElementById("username");
const phone = document.getElementById("phone");
const bio = document.getElementById("bio");
const email = document.getElementById("email");
const avatarInput = document.getElementById("avatarInput");
const avatarShell = document.getElementById("avatarShell");
const avatarImage = document.getElementById("avatarImage");
const avatarFallback = document.getElementById("avatarFallback");
const formMessage = document.getElementById("formMessage");
const loadingOverlay = document.getElementById("loadingOverlay");
const loaderTitle = document.getElementById("loaderTitle");
const loaderSubtitle = document.getElementById("loaderSubtitle");
const toast = document.getElementById("toast");

let currentUser = null;
let currentProfile = null;
let pendingAvatarBlob = null;
let pendingAvatarPreview = "";
let originalSnapshot = "";
let toastTimer = null;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setLoading(active, title = "Memuat profil", subtitle = "Mohon tunggu sebentar...") {
  loaderTitle.textContent = title;
  loaderSubtitle.textContent = subtitle;
  loadingOverlay.classList.toggle("active", active);
  loadingOverlay.setAttribute("aria-hidden", active ? "false" : "true");
  document.body.classList.toggle("loading", active);
}

function setMessage(text = "", type = "") {
  formMessage.textContent = text;
  formMessage.className = `form-message ${type}`.trim();
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function formatJoinedDate(value) {
  const date = new Date(value || "");

  if (Number.isNaN(date.getTime())) {
    return "Member aktif";
  }

  return `Bergabung ${new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric"
  }).format(date)}`;
}

async function requireUser() {
  const user = await window.AdaAjaAuth.getCurrentUser();

  if (!user) {
    localStorage.setItem("redirectAfterLogin", "edit-profile.html");
    location.replace("login.html");
    return null;
  }

  currentUser = user;
  return user;
}

async function loadProfile() {
  const user = await requireUser();
  if (!user) return;

  setLoading(true);

  try {
    const { data: profile, error: profileError } = await window.adaajaSupabase
      .from("profiles")
      .select("id, username, full_name, phone, avatar_url, bio, status, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    currentProfile = profile || {};

    fullName.value = currentProfile.full_name || "";
    username.value = currentProfile.username || "";
    phone.value = currentProfile.phone || "";
    bio.value = currentProfile.bio || "";
    email.value = user.email || "";

    document.getElementById("heroName").textContent =
      currentProfile.username ||
      currentProfile.full_name ||
      "Pengguna AdaAja";

    document.getElementById("heroEmail").textContent =
      user.email || "Email belum tersedia";

    document.getElementById("joinedDate").textContent =
      formatJoinedDate(currentProfile.created_at || user.created_at);

    const fallbackName =
      currentProfile.username ||
      currentProfile.full_name ||
      user.email ||
      "A";

    avatarFallback.textContent =
      String(fallbackName).charAt(0).toUpperCase();

    if (currentProfile.avatar_url) {
      avatarImage.src = currentProfile.avatar_url;
      avatarImage.onload = () => avatarShell.classList.add("has-image");
      avatarImage.onerror = () => avatarShell.classList.remove("has-image");
    }

    updateBioCount();
    await loadPrimaryAddress(user.id);

    originalSnapshot = getSnapshot();
  } catch (error) {
    console.error("Gagal memuat edit profile:", error);
    setMessage(error.message || "Profil gagal dimuat.", "error");
  } finally {
    setLoading(false);
  }
}

async function loadPrimaryAddress(userId) {
  const preview = document.getElementById("addressPreview");

  try {
    const { data, error } = await window.adaajaSupabase
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      preview.innerHTML = `
        <span class="address-icon">
          <svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
        </span>
        <div>
          <strong>Belum ada alamat utama</strong>
          <p>Tambahkan alamat untuk mempermudah transaksi dan pengiriman.</p>
        </div>
      `;
      return;
    }

    const title =
      data.label ||
      data.address_label ||
      data.recipient_name ||
      "Alamat utama";

    const detail = [
      data.address_line,
      data.address,
      data.subdistrict,
      data.district,
      data.city,
      data.regency,
      data.province,
      data.postal_code
    ]
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .join(", ");

    preview.innerHTML = `
      <span class="address-icon">
        <svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>
      </span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail || "Alamat utama sudah tersimpan.")}</p>
      </div>
    `;
  } catch (error) {
    console.warn("Alamat utama gagal dimuat:", error);
    preview.querySelector("strong").textContent = "Alamat belum dapat dimuat";
    preview.querySelector("p").textContent = "Silakan buka Kelola Alamat untuk melihat detail.";
  }
}

function updateBioCount() {
  document.getElementById("bioCount").textContent = bio.value.length;
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");
}

function getSnapshot() {
  return JSON.stringify({
    full_name: fullName.value.trim(),
    username: normalizeUsername(username.value),
    phone: phone.value.trim(),
    bio: bio.value.trim()
  });
}

async function isUsernameAvailable(value) {
  if (!value) return false;

  const { data, error } = await window.adaajaSupabase
    .from("profiles")
    .select("id")
    .eq("username", value)
    .neq("id", currentUser.id)
    .limit(1);

  if (error) throw error;

  return !data?.length;
}

function compressAvatar(file, maxSize = 900, quality = 0.84) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;

    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;

      image.onload = () => {
        let { width, height } = image;
        const scale = Math.min(1, maxSize / Math.max(width, height));

        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        canvas.getContext("2d").drawImage(image, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Foto profil gagal diproses."));
              return;
            }

            resolve(blob);
          },
          "image/jpeg",
          quality
        );
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

avatarInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setMessage("File foto tidak valid.", "error");
    return;
  }

  if (file.size > 12 * 1024 * 1024) {
    setMessage("Ukuran foto maksimal 12 MB.", "error");
    return;
  }

  try {
    pendingAvatarBlob = await compressAvatar(file);

    if (pendingAvatarPreview) {
      URL.revokeObjectURL(pendingAvatarPreview);
    }

    pendingAvatarPreview = URL.createObjectURL(pendingAvatarBlob);
    avatarImage.src = pendingAvatarPreview;
    avatarShell.classList.add("has-image");

    setMessage("");
  } catch (error) {
    console.error(error);
    setMessage(error.message || "Foto profil gagal diproses.", "error");
  } finally {
    avatarInput.value = "";
  }
});

username.addEventListener("input", () => {
  const normalized = normalizeUsername(username.value);

  if (username.value !== normalized) {
    username.value = normalized;
  }

  document.getElementById("usernameHint").textContent =
    normalized.length < 3
      ? "Username minimal 3 karakter."
      : "Username akan digunakan sebagai identitas publik Anda.";
});

bio.addEventListener("input", updateBioCount);

async function uploadAvatarIfNeeded() {
  if (!pendingAvatarBlob) {
    return currentProfile?.avatar_url || "";
  }

  const path =
    `avatars/${currentUser.id}/profile-${Date.now()}.jpg`;

  const { error: uploadError } = await window.adaajaSupabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, pendingAvatarBlob, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: false
    });

  if (uploadError) throw uploadError;

  const { data } = window.adaajaSupabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("URL foto profil gagal dibuat.");
  }

  return data.publicUrl;
}

function validate() {
  const name = fullName.value.trim();
  const userName = normalizeUsername(username.value);

  if (!name) return "Nama lengkap wajib diisi.";

  if (userName.length < 3) {
    return "Username minimal 3 karakter.";
  }

  if (!/^[a-z0-9._]+$/.test(userName)) {
    return "Username hanya boleh berisi huruf kecil, angka, titik, dan underscore.";
  }

  if (phone.value.trim() && phone.value.trim().length < 8) {
    return "Nomor HP belum valid.";
  }

  return "";
}

async function saveProfile() {
  setMessage("");

  const validationError = validate();

  if (validationError) {
    setMessage(validationError, "error");
    return;
  }

  const user = await requireUser();
  if (!user) return;

  setLoading(true, "Menyimpan perubahan", "Memperbarui profil AdaAja Anda...");

  try {
    const normalizedUsername = normalizeUsername(username.value);

    const available = await isUsernameAvailable(normalizedUsername);

    if (!available) {
      throw new Error("Username sudah digunakan akun lain.");
    }

    const avatarUrl = await uploadAvatarIfNeeded();

    const payload = {
      full_name: fullName.value.trim(),
      username: normalizedUsername,
      phone: phone.value.trim() || null,
      bio: bio.value.trim() || null,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await window.adaajaSupabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    if (error) throw error;

    currentProfile = {
      ...currentProfile,
      ...payload
    };

    if (window.AdaAjaAuth?.syncLegacyUser) {
      try {
        await window.AdaAjaAuth.syncLegacyUser(user);
      } catch (syncError) {
        console.warn("Legacy sync gagal:", syncError);
      }
    }

    originalSnapshot = getSnapshot();
    pendingAvatarBlob = null;

    showToast("Profil berhasil diperbarui.");
    setMessage("Profil berhasil diperbarui.", "success");

    document.getElementById("heroName").textContent =
      normalizedUsername || payload.full_name;

    setTimeout(() => {
      location.href = "profile.html";
    }, 850);
  } catch (error) {
    console.error("Save profile failed:", error);

    const text = String(error?.message || "");

    if (text.toLowerCase().includes("row-level security")) {
      setMessage(
        "Akses ditolak oleh RLS. Pastikan user hanya diizinkan mengubah profil miliknya sendiri.",
        "error"
      );
    } else {
      setMessage(text || "Profil gagal diperbarui.", "error");
    }
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveProfile();
});

document.getElementById("headerSaveButton").addEventListener("click", saveProfile);

document.getElementById("changePasswordButton").addEventListener("click", async () => {
  const user = await requireUser();
  if (!user?.email) return;

  setLoading(true, "Menyiapkan keamanan", "Mengirim instruksi perubahan password...");

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

window.addEventListener("beforeunload", (event) => {
  const changed =
    getSnapshot() !== originalSnapshot ||
    Boolean(pendingAvatarBlob);

  if (!changed) return;

  event.preventDefault();
  event.returnValue = "";
});

window.addEventListener("unload", () => {
  if (pendingAvatarPreview) {
    URL.revokeObjectURL(pendingAvatarPreview);
  }
});

loadProfile();
