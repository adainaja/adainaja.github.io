const API_URL =
  "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const REGION_API =
  "https://www.emsifa.com/api-wilayah-indonesia/api/";

const selected = {};
let currentLocationType = "";
let currentLocationData = [];
let fotoProfile = "";

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

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function getUserEmail() {
  return (
    localStorage.getItem("register_email") ||
    getStoredUser()?.email ||
    ""
  )
    .trim()
    .toLowerCase();
}

function formatLocation(name = "") {
  let value = String(name)
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

  const specialNames = {
    "Dki Jakarta": "DKI Jakarta",
    "Di Yogyakarta": "DI Yogyakarta",
    "Nanggroe Aceh Darussalam": "Nanggroe Aceh Darussalam"
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
    titleElement.textContent = isSaving
      ? "Menyimpan profil..."
      : "Simpan & Mulai";
  }

  if (subtitleElement) {
    subtitleElement.textContent = isSaving
      ? "Mohon tunggu sebentar"
      : "Lanjutkan ke AdaAja";
  }
}

function getLocationEndpoint(type) {
  if (type === "province") {
    return `${REGION_API}provinces.json`;
  }

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
    list.innerHTML =
      '<div class="empty-location">Wilayah tidak ditemukan.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const button = document.createElement("button");
    button.className = "option";
    button.type = "button";
    button.textContent = formatLocation(item.name);
    button.addEventListener("click", () => {
      selectLocation(currentLocationType, item);
    });
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

    setMessage(
      dependencyMessages[type] || "Pilihan wilayah belum tersedia.",
      "error"
    );
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

    if (!response.ok) {
      throw new Error("Data wilayah gagal dimuat.");
    }

    currentLocationData = await response.json();
    renderLocationOptions(currentLocationData);
  } catch (error) {
    list.innerHTML =
      `<div class="empty-location">${error.message || "Data wilayah tidak dapat dimuat."}</div>`;
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
  document.getElementById(type).textContent =
    formatLocation(item.name);

  clearLocationAfter(type);
  closeSheet();
  setMessage("");
}

document.querySelectorAll("[data-location]").forEach((button) => {
  button.addEventListener("click", () => {
    openLocation(button.dataset.location);
  });
});

search.addEventListener("input", () => {
  const keyword = search.value.trim().toLowerCase();

  if (!keyword) {
    renderLocationOptions(currentLocationData);
    return;
  }

  renderLocationOptions(
    currentLocationData.filter((item) =>
      formatLocation(item.name).toLowerCase().includes(keyword)
    )
  );
});

document.getElementById("sheetBackdrop").addEventListener("click", closeSheet);
document.getElementById("sheetClose").addEventListener("click", closeSheet);

document.getElementById("backButton").addEventListener("click", () => {
  if (history.length > 1) {
    history.back();
    return;
  }

  location.href = "home.html";
});

photo.addEventListener("change", (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setMessage("File foto harus berupa gambar.", "error");
    photo.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setMessage("Ukuran foto maksimal 5 MB.", "error");
    photo.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = (result) => {
    fotoProfile = result.target.result;
    avatar.innerHTML =
      `<img src="${fotoProfile}" alt="Pratinjau foto profil">`;
    setMessage("");
  };

  reader.readAsDataURL(file);
});

addressInput.addEventListener("input", () => {
  addressCounter.textContent =
    `${addressInput.value.length}/200`;
});

function validateForm() {
  const username =
    document.getElementById("usernameInput").value.trim();

  const address = addressInput.value.trim();

  const postalCode =
    document.getElementById("postalCodeInput").value.trim();

  if (!getUserEmail()) {
    return {
      valid: false,
      message:
        "Email akun tidak ditemukan. Silakan masuk atau daftar kembali."
    };
  }

  if (!username) {
    return {
      valid: false,
      message: "Username belum diisi."
    };
  }

  if (!/^[a-zA-Z0-9._]{3,24}$/.test(username)) {
    return {
      valid: false,
      message:
        "Username harus 3–24 karakter dan hanya boleh berisi huruf, angka, titik, atau garis bawah."
    };
  }

  if (
    !selected.province ||
    !selected.city ||
    !selected.district ||
    !selected.village
  ) {
    return {
      valid: false,
      message: "Lengkapi seluruh pilihan wilayah."
    };
  }

  if (address.length < 8) {
    return {
      valid: false,
      message: "Masukkan alamat lengkap minimal 8 karakter."
    };
  }

  if (postalCode && !/^\d{5,10}$/.test(postalCode)) {
    return {
      valid: false,
      message: "Kode pos harus berisi 5–10 angka."
    };
  }

  return {
    valid: true,
    username,
    address,
    postalCode
  };
}

saveButton.addEventListener("click", async () => {
  const validation = validateForm();

  if (!validation.valid) {
    setMessage(validation.message, "error");
    return;
  }

  const payload = {
    action: "completeProfile",
    email: getUserEmail(),
    username: validation.username,
    foto_profile: fotoProfile,
    provinsi: formatLocation(selected.province.name),
    kota: formatLocation(selected.city.name),
    kecamatan: formatLocation(selected.district.name),
    kelurahan: formatLocation(selected.village.name),
    alamat: validation.address,
    kode_pos: validation.postalCode
  };

  setSaving(true);
  setMessage("Menyimpan profil Anda...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.status !== "success") {
      throw new Error(result.message || "Profil gagal disimpan.");
    }

    const user = getStoredUser();

    if (user) {
      user.username = validation.username;

      if (fotoProfile) {
        user.foto_profile = fotoProfile;
      }

      localStorage.setItem("user", JSON.stringify(user));
    }

    localStorage.removeItem("register_email");
    localStorage.removeItem("register_username");
    localStorage.removeItem("register_password");

    setMessage("Profil berhasil disimpan.", "success");

    setTimeout(() => {
      location.href = "home.html";
    }, 800);
  } catch (error) {
    console.error("Complete profile error:", error);
    setMessage(
      error.message || "Gagal terhubung ke server.",
      "error"
    );
    setSaving(false);
  }
});

document.querySelectorAll("[data-auth-required='true']").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (getStoredUser()) return;

    event.preventDefault();
    localStorage.setItem("redirectAfterLogin", link.getAttribute("href"));
    location.href = "login.html";
  });
});

const user = getStoredUser();

if (user?.username) {
  document.getElementById("usernameInput").value = user.username;
}

if (user?.foto_profile) {
  fotoProfile = user.foto_profile;
  avatar.innerHTML =
    `<img src="${fotoProfile}" alt="Foto profil">`;
}
