const REGION_API = "https://www.emsifa.com/api-wilayah-indonesia/api/";

const selected = {};
let currentLocationType = "";
let currentLocationData = [];
let selectedPhotoFile = null;
let currentUser = null;
let currentProfile = null;

const sheet = document.getElementById("sheet");
const title = document.getElementById("title");
const list = document.getElementById("list");
const search = document.getElementById("search");
const sheetLoading = document.getElementById("sheetLoading");
const saveButton = document.getElementById("saveButton");
const message = document.getElementById("message");
const avatar = document.getElementById("avatar");
const photo = document.getElementById("photo");
const addressInput = document.getElementById("addressInput");
const addressCounter = document.getElementById("addressCounter");
const usernameInput = document.getElementById("usernameInput");
const postalCodeInput = document.getElementById("postalCodeInput");

function formatLocation(name = "") {
  let value = String(name)
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

  const specialNames = {
    "Dki Jakarta": "DKI Jakarta",
    "Di Yogyakarta": "DI Yogyakarta"
  };

  return specialNames[value] || value;
}

function setMessage(text = "", type = "") {
  message.className = `message ${type}`.trim();
  message.textContent = text;
}

function setSaving(isSaving) {
  saveButton.disabled = isSaving;

  const titleElement = saveButton.querySelector(".save-copy strong");
  const subtitleElement = saveButton.querySelector(".save-copy small");

  if (titleElement) {
    titleElement.textContent = isSaving ? "Menyimpan profil..." : "Simpan & Mulai";
  }

  if (subtitleElement) {
    subtitleElement.textContent = isSaving ? "Mohon tunggu sebentar" : "Lanjutkan ke AdaAja";
  }
}

function getLocationEndpoint(type) {
  if (type === "province") return `${REGION_API}provinces.json`;
  if (type === "city" && selected.province) {
    return `${REGION_API}regencies/${selected.province.id}.json`;
  }
  if (type === "district" && selected.city) {
    return `${REGION_API}districts/${selected.city.id}.json`;
  }
  if (type === "village" && selected.district) {
    return `${REGION_API}villages/${selected.district.id}.json`;
  }
  return "";
}

function getLocationTitle(type) {
  return {
    province: "Pilih provinsi",
    city: "Pilih kota/kabupaten",
    district: "Pilih kecamatan",
    village: "Pilih kelurahan/desa"
  }[type] || "Pilih lokasi";
}

function openSheet() {
  sheet.classList.add("show");
  sheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("sheet-open");
}

function closeSheet() {
  sheet.classList.remove("show");
  sheet.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sheet-open");
  search.value = "";
}

function renderLocationOptions(items) {
  list.innerHTML = "";

  if (!items.length) {
    list.innerHTML = '<div class="empty-location">Wilayah tidak ditemukan.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const button = document.createElement("button");
    button.className = "option";
    button.type = "button";
    button.textContent = formatLocation(item.name);
    button.addEventListener("click", () => selectLocation(currentLocationType, item));
    fragment.appendChild(button);
  });

  list.appendChild(fragment);
}

async function openLocation(type) {
  const endpoint = getLocationEndpoint(type);

  if (!endpoint) {
    const dependencyMessages = {
      city: "Pilih provinsi terlebih dahulu.",
      district: "Pilih kota/kabupaten terlebih dahulu.",
      village: "Pilih kecamatan terlebih dahulu."
    };

    setMessage(dependencyMessages[type] || "Pilihan wilayah belum tersedia.", "error");
    return;
  }

  currentLocationType = type;
  currentLocationData = [];
  title.textContent = getLocationTitle(type);
  list.innerHTML = "";
  sheetLoading.classList.add("show");
  openSheet();

  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("Data wilayah gagal dimuat.");
    currentLocationData = await response.json();
    renderLocationOptions(currentLocationData);
  } catch (error) {
    list.innerHTML = `<div class="empty-location">${error.message || "Data wilayah tidak dapat dimuat."}</div>`;
  } finally {
    sheetLoading.classList.remove("show");
  }
}

function clearLocationAfter(type) {
  if (type === "province") {
    delete selected.city;
    delete selected.district;
    delete selected.village;
    document.getElementById("city").textContent = "Pilih kota";
    document.getElementById("district").textContent = "Pilih kecamatan";
    document.getElementById("village").textContent = "Pilih kelurahan";
  }

  if (type === "city") {
    delete selected.district;
    delete selected.village;
    document.getElementById("district").textContent = "Pilih kecamatan";
    document.getElementById("village").textContent = "Pilih kelurahan";
  }

  if (type === "district") {
    delete selected.village;
    document.getElementById("village").textContent = "Pilih kelurahan";
  }
}

function selectLocation(type, item) {
  selected[type] = item;
  document.getElementById(type).textContent = formatLocation(item.name);
  clearLocationAfter(type);
  closeSheet();
  setMessage("");
}

function showAvatar(url) {
  if (!url) return;
  avatar.innerHTML = `<img src="${url}" alt="Foto profil">`;
}

async function uploadAvatar(userId) {
  if (!selectedPhotoFile) return currentProfile?.avatar_url || null;

  const extension = selectedPhotoFile.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `${userId}/avatar-${Date.now()}.${extension}`;

  const { error: uploadError } = await window.adaajaSupabase.storage
    .from("avatars")
    .upload(filePath, selectedPhotoFile, {
      cacheControl: "3600",
      upsert: true,
      contentType: selectedPhotoFile.type
    });

  if (uploadError) throw uploadError;

  const { data } = window.adaajaSupabase.storage
    .from("avatars")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function usernameIsAvailable(username) {
  const { data, error } = await window.adaajaSupabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", currentUser.id)
    .maybeSingle();

  if (error) throw error;
  return !data;
}

function validateForm() {
  const username = usernameInput.value.trim().toLowerCase();
  const address = addressInput.value.trim();
  const postalCode = postalCodeInput.value.trim();

  if (!currentUser) return { valid: false, message: "Sesi login tidak ditemukan." };
  if (!username) return { valid: false, message: "Username belum diisi." };

  if (!/^[a-z0-9._]{3,24}$/.test(username)) {
    return {
      valid: false,
      message: "Username harus 3–24 karakter dan hanya boleh berisi huruf kecil, angka, titik, atau garis bawah."
    };
  }

  if (!selected.province || !selected.city || !selected.district || !selected.village) {
    return { valid: false, message: "Lengkapi seluruh pilihan wilayah." };
  }

  if (address.length < 8) {
    return { valid: false, message: "Masukkan alamat lengkap minimal 8 karakter." };
  }

  if (postalCode && !/^\d{5,10}$/.test(postalCode)) {
    return { valid: false, message: "Kode pos harus berisi 5–10 angka." };
  }

  return { valid: true, username, address, postalCode };
}

async function loadExistingData() {
  const { data: profile, error: profileError } = await window.adaajaSupabase
    .from("profiles")
    .select("id, username, full_name, phone, avatar_url, bio, status")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (profileError) throw profileError;
  currentProfile = profile || null;

  if (profile?.username) usernameInput.value = profile.username;
  if (profile?.avatar_url) showAvatar(profile.avatar_url);

  const { data: address, error: addressError } = await window.adaajaSupabase
    .from("addresses")
    .select("province, city, district, village, postal_code, full_address")
    .eq("user_id", currentUser.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (addressError) throw addressError;
  if (!address) return;

  ["province", "city", "district", "village"].forEach((type) => {
    if (address[type]) {
      selected[type] = { id: null, name: address[type] };
      document.getElementById(type).textContent = address[type];
    }
  });

  addressInput.value = address.full_address || "";
  postalCodeInput.value = address.postal_code || "";
  addressCounter.textContent = `${addressInput.value.length}/200`;
}

async function initializePage() {
  try {
    const session = await window.AdaAjaAuth.getSession();
    if (!session?.user) {
      localStorage.setItem("redirectAfterLogin", "complete-account.html");
      location.replace("login.html");
      return;
    }

    currentUser = session.user;
    await loadExistingData();
  } catch (error) {
    console.error("Complete account initialization error:", error);
    setMessage(error.message || "Data akun belum dapat dimuat.", "error");
  }
}

document.querySelectorAll("[data-location]").forEach((button) => {
  button.addEventListener("click", () => openLocation(button.dataset.location));
});

search.addEventListener("input", () => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return renderLocationOptions(currentLocationData);

  renderLocationOptions(
    currentLocationData.filter((item) =>
      formatLocation(item.name).toLowerCase().includes(keyword)
    )
  );
});

document.getElementById("sheetBackdrop").addEventListener("click", closeSheet);
document.getElementById("sheetClose").addEventListener("click", closeSheet);

document.getElementById("backButton").addEventListener("click", () => {
  if (history.length > 1) return history.back();
  location.href = "home.html";
});

photo.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    setMessage("Foto harus berformat JPG, PNG, atau WebP.", "error");
    photo.value = "";
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    setMessage("Ukuran foto maksimal 2 MB.", "error");
    photo.value = "";
    return;
  }

  selectedPhotoFile = file;
  showAvatar(URL.createObjectURL(file));
  setMessage("");
});

addressInput.addEventListener("input", () => {
  addressCounter.textContent = `${addressInput.value.length}/200`;
});

saveButton.addEventListener("click", async () => {
  const validation = validateForm();
  if (!validation.valid) {
    setMessage(validation.message, "error");
    return;
  }

  setSaving(true);
  setMessage("Menyimpan profil Anda...");

  try {
    const available = await usernameIsAvailable(validation.username);
    if (!available) throw new Error("Username sudah digunakan. Pilih username lain.");

    const avatarUrl = await uploadAvatar(currentUser.id);
    const fullName = currentProfile?.full_name || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || "Pengguna AdaAja";

    const { error: profileError } = await window.adaajaSupabase
      .from("profiles")
      .upsert({
        id: currentUser.id,
        username: validation.username,
        full_name: fullName,
        avatar_url: avatarUrl,
        status: "active",
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

    if (profileError) throw profileError;

    const addressPayload = {
      user_id: currentUser.id,
      label: "Utama",
      recipient_name: fullName,
      recipient_phone: currentProfile?.phone || null,
      province: formatLocation(selected.province.name),
      city: formatLocation(selected.city.name),
      district: formatLocation(selected.district.name),
      village: formatLocation(selected.village.name),
      postal_code: validation.postalCode || null,
      full_address: validation.address,
      is_primary: true,
      updated_at: new Date().toISOString()
    };

    const { data: existingAddress, error: existingError } = await window.adaajaSupabase
      .from("addresses")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (existingError) throw existingError;

    const addressQuery = existingAddress?.id
      ? window.adaajaSupabase.from("addresses").update(addressPayload).eq("id", existingAddress.id)
      : window.adaajaSupabase.from("addresses").insert(addressPayload);

    const { error: addressError } = await addressQuery;
    if (addressError) throw addressError;

    await window.AdaAjaAuth.syncLegacyUser(currentUser);
    localStorage.setItem("profile_completed", "true");

    setMessage("Profil berhasil disimpan.", "success");
    window.setTimeout(() => location.replace("home.html"), 700);
  } catch (error) {
    console.error("Complete profile error:", error);
    setMessage(error.message || "Profil gagal disimpan.", "error");
    setSaving(false);
  }
});

document.querySelectorAll("[data-auth-required='true']").forEach((link) => {
  link.addEventListener("click", async (event) => {
    const session = await window.AdaAjaAuth.getSession();
    if (session?.user) return;

    event.preventDefault();
    localStorage.setItem("redirectAfterLogin", link.getAttribute("href"));
    location.href = "login.html";
  });
});

initializePage();
