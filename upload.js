const ADAAJA_CATEGORIES = {
  all: "Semua produk",
  electronics: "Elektronik",
  fashion: "Fashion",
  home: "Rumah Tangga",
  automotive: "Otomotif",
  beauty: "Kecantikan",
  hobby: "Hobi & Koleksi",
  baby: "Bayi & Anak",
  books: "Buku",
  sports: "Olahraga",
  food: "Makanan & Minuman",
  pets: "Hewan Peliharaan",
  services: "Jasa",
  property: "Properti",
  event: "Event & Tiket",
  other: "Lainnya"
};

const UPLOAD_LEGACY_CATEGORY_MAP = {
  CAT_ELEKTRONIK: "electronics",
  CAT_FASHION: "fashion",
  CAT_RUMAH: "home",
  CAT_KENDARAAN: "automotive",
  CAT_MAKANAN: "food",
  CAT_JASA: "services",
  CAT_EVENT: "event",
  CAT_LAINNYA: "other",
  CAT_BARANG: "other"
};

const MAX_PHOTOS = 10;
const PRODUCT_IMAGE_BUCKET = "product-images";
const photos = [];
let currentSession = null;
let savedAddresses = [];

const form = document.getElementById("productForm");
const photoInput = document.getElementById("photoInput");
const photoGrid = document.getElementById("photoGrid");
const photoCount = document.getElementById("photoCount");
const productName = document.getElementById("productName");
const description = document.getElementById("description");
const price = document.getElementById("price");
const stock = document.getElementById("stock");
const unit = document.getElementById("unit");
const customUnit = document.getElementById("customUnit");
const customUnitWrap = document.getElementById("customUnitWrap");
const minimumOrder = document.getElementById("minimumOrder");
const minimumOrderHint = document.getElementById("minimumOrderHint");
const weightGrams = document.getElementById("weightGrams");
const shipFromAddress = document.getElementById("shipFromAddress");
const shipFromPreview = document.getElementById("shipFromPreview");
const message = document.getElementById("formMessage");
const publishButton = document.getElementById("publishButton");
const loadingOverlay = document.getElementById("loadingOverlay");
const formProgress = document.getElementById("formProgress");

const ADDRESS_ALIASES = {
  label: ["label", "address_label", "type"],
  province: ["province", "provinsi"],
  city: ["city", "kota", "regency"],
  district: ["district", "kecamatan"],
  village: ["village", "kelurahan", "subdistrict"],
  detail: ["address_line", "address_line1", "address", "alamat", "full_address"],
  postal: ["postal_code", "kode_pos"]
};

const STANDARD_UNITS = new Set([
  "unit","pcs","kg","gram","ton","meter","cm","mm","liter","ml","botol","dus","box",
  "pack","sak","lembar","roll","pasang","set","karung","tray","bungkus","kaleng",
  "galon","tabung","buah","ekor","ikat","kodi","lusin"
]);

function pickAddressValue(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] != null && String(row[key]).trim()) {
      return String(row[key]).trim();
    }
  }
  return fallback;
}

function normalizeAddress(row) {
  return {
    id: row.id,
    label: pickAddressValue(row, ADDRESS_ALIASES.label, "Alamat"),
    province: pickAddressValue(row, ADDRESS_ALIASES.province),
    city: pickAddressValue(row, ADDRESS_ALIASES.city),
    district: pickAddressValue(row, ADDRESS_ALIASES.district),
    village: pickAddressValue(row, ADDRESS_ALIASES.village),
    detail: pickAddressValue(row, ADDRESS_ALIASES.detail),
    postal: pickAddressValue(row, ADDRESS_ALIASES.postal),
    isPrimary: Boolean(row.is_primary ?? row.is_default)
  };
}

function addressRegion(address) {
  return [address.detail, address.village, address.district, address.city, address.province, address.postal]
    .filter(Boolean)
    .join(", ");
}

function addressShort(address) {
  return [address.city, address.province].filter(Boolean).join(", ") || addressRegion(address);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeUploadCondition(value) {
  const condition = String(value || "").trim().toLowerCase();
  if (!condition) return "";
  if (condition === "baru" || condition === "new") return "baru";
  if (condition === "bekas" || ["like_new", "good", "fair", "poor", "very_poor"].includes(condition)) {
    return "bekas";
  }
  return "";
}

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `notice ${type}`;
  message.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearMessage() {
  message.textContent = "";
  message.className = "notice";
}

function setLoading(isLoading) {
  publishButton.disabled = isLoading;
  loadingOverlay.classList.toggle("active", isLoading);
  loadingOverlay.setAttribute("aria-hidden", isLoading ? "false" : "true");
  document.body.classList.toggle("loading", isLoading);
}

async function getSession() {
  if (currentSession?.user) return currentSession;
  const { data, error } = await window.adaajaSupabase.auth.getSession();
  if (error) throw error;
  currentSession = data.session || null;
  return currentSession;
}

async function requireLogin() {
  try {
    const session = await getSession();
    if (session?.user) return session;
    localStorage.setItem("redirectAfterLogin", "upload.html");
    location.replace("login.html");
    return null;
  } catch (error) {
    console.error("Session check failed:", error);
    localStorage.setItem("redirectAfterLogin", "upload.html");
    location.replace("login.html");
    return null;
  }
}

function selectedUnitValue() {
  if (unit.value !== "__custom__") return unit.value;
  return customUnit.value.trim();
}

function selectedAddress() {
  return savedAddresses.find((item) => String(item.id) === String(shipFromAddress.value)) || null;
}

function updateProgress() {
  const checks = [
    photos.length > 0,
    productName.value.trim(),
    description.value.trim(),
    document.getElementById("category").value,
    document.getElementById("condition").value,
    selectedAddress(),
    Number(price.dataset.value || 0) > 0,
    selectedUnitValue(),
    Number(minimumOrder.value || 0) >= 1,
    Number(stock.value || 0) >= 1,
    Number(weightGrams.value || 0) > 0
  ];
  const progress = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  formProgress.textContent = `${progress}%`;
}

productName.addEventListener("input", () => {
  document.getElementById("nameCount").textContent = productName.value.length;
  updateProgress();
});

description.addEventListener("input", () => {
  document.getElementById("descriptionCount").textContent = description.value.length;
  updateProgress();
});

price.addEventListener("input", () => {
  const raw = price.value.replace(/\D/g, "").slice(0, 12);
  price.dataset.value = raw;
  price.value = raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : "";
  updateProgress();
});

document.getElementById("decreaseStock").addEventListener("click", () => {
  stock.value = Math.max(1, Number(stock.value || 1) - 1);
  updateProgress();
});

document.getElementById("increaseStock").addEventListener("click", () => {
  stock.value = Math.min(9999, Number(stock.value || 1) + 1);
  updateProgress();
});

function updateMinimumOrderHint() {
  const value = Math.max(1, Number(minimumOrder.value || 1));
  const unitLabel = selectedUnitValue() || "satuan";
  minimumOrderHint.textContent = `Minimal pembelian ${value} ${unitLabel}.`;
}

document.getElementById("decreaseMinimumOrder").addEventListener("click", () => {
  minimumOrder.value = Math.max(1, Number(minimumOrder.value || 1) - 1);
  updateMinimumOrderHint();
  updateProgress();
});

document.getElementById("increaseMinimumOrder").addEventListener("click", () => {
  minimumOrder.value = Math.min(9999, Number(minimumOrder.value || 1) + 1);
  updateMinimumOrderHint();
  updateProgress();
});

minimumOrder.addEventListener("input", () => {
  const value = Math.max(1, Math.min(9999, Number(minimumOrder.value || 1)));
  minimumOrder.value = value;
  updateMinimumOrderHint();
  updateProgress();
});

unit.addEventListener("change", () => {
  const custom = unit.value === "__custom__";
  customUnitWrap.hidden = !custom;
  if (!custom) customUnit.value = "";
  updateMinimumOrderHint();
  updateProgress();
  if (custom) customUnit.focus();
});

customUnit.addEventListener("input", () => {
  updateMinimumOrderHint();
  updateProgress();
});

shipFromAddress.addEventListener("change", () => {
  const address = selectedAddress();
  if (!address) {
    shipFromPreview.innerHTML = "<span>Pilih alamat tersimpan yang menjadi lokasi asal produk.</span>";
  } else {
    shipFromPreview.innerHTML = `
      <strong>${escapeHtml(address.label)}${address.isPrimary ? " · Utama" : ""}</strong>
      <span>${escapeHtml(addressRegion(address))}</span>
    `;
  }
  updateProgress();
});

document.getElementById("addAddressButton").addEventListener("click", () => {
  sessionStorage.setItem("adaaja_address_return", "upload.html");
});

async function loadSavedAddresses(userId, preferredRegion = "") {
  shipFromAddress.innerHTML = '<option value="">Memuat alamat...</option>';

  try {
    const { data, error } = await window.adaajaSupabase
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) throw error;

    savedAddresses = (data || []).map(normalizeAddress);

    if (!savedAddresses.length) {
      shipFromAddress.innerHTML = '<option value="">Belum ada alamat tersimpan</option>';
      shipFromPreview.innerHTML = '<span>Tambahkan alamat terlebih dahulu untuk menentukan asal produk.</span>';
      updateProgress();
      return;
    }

    shipFromAddress.innerHTML =
      '<option value="">Pilih alamat asal produk</option>' +
      savedAddresses.map((address) => `
        <option value="${escapeHtml(address.id)}">
          ${escapeHtml(address.label)}${address.isPrimary ? " (Utama)" : ""} — ${escapeHtml(addressShort(address))}
        </option>
      `).join("");

    let preferred = null;
    if (preferredRegion) {
      preferred = savedAddresses.find((address) => addressRegion(address) === preferredRegion);
    }
    preferred ||= savedAddresses.find((address) => address.isPrimary) || savedAddresses[0];

    if (preferred) {
      shipFromAddress.value = preferred.id;
      shipFromAddress.dispatchEvent(new Event("change"));
    }
  } catch (error) {
    console.error("Gagal memuat alamat:", error);
    shipFromAddress.innerHTML = '<option value="">Alamat gagal dimuat</option>';
    shipFromPreview.innerHTML = `<span>${escapeHtml(error.message || "Silakan muat ulang halaman.")}</span>`;
  }
}

photoInput.addEventListener("change", async (event) => {
  const available = MAX_PHOTOS - photos.length;
  const files = Array.from(event.target.files).slice(0, available);
  if (!files.length) return;

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 12 * 1024 * 1024) {
      showMessage(`Foto ${file.name} terlalu besar. Maksimal 12 MB.`);
      continue;
    }

    try {
      const compressed = await compressImage(file, 1280, 0.8);
      photos.push({
        name: file.name,
        blob: compressed.blob,
        previewUrl: compressed.previewUrl
      });
    } catch (error) {
      console.error("Image compression failed:", error);
      showMessage(`Foto ${file.name} gagal diproses.`);
    }
  }

  photoInput.value = "";
  renderPhotos();
  updateProgress();
});

function renderPhotos() {
  photoGrid.querySelectorAll(".photo-preview").forEach((item) => item.remove());

  photos.forEach((photo, index) => {
    const item = document.createElement("div");
    item.className = "photo-preview";
    item.innerHTML = `
      <img src="${photo.previewUrl}" alt="Foto produk ${index + 1}">
      ${index === 0 ? '<span class="cover-badge">Sampul</span>' : ""}
      <button type="button" class="remove-photo" aria-label="Hapus foto">×</button>
    `;

    item.querySelector(".remove-photo").addEventListener("click", () => {
      const [removed] = photos.splice(index, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      renderPhotos();
      updateProgress();
    });

    photoGrid.appendChild(item);
  });

  photoCount.textContent = photos.length;
  document.querySelector(".photo-add").style.display =
    photos.length >= MAX_PHOTOS ? "none" : "flex";
}

function compressImage(file, maxSize, quality) {
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

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Gambar gagal dikompres."));
              return;
            }
            resolve({ blob, previewUrl: URL.createObjectURL(blob) });
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

document.getElementById("draftButton").addEventListener("click", () => {
  const draft = collectFormData();
  localStorage.setItem("adaaja_product_draft", JSON.stringify(draft));
  showMessage("Draf produk berhasil disimpan di perangkat ini.", "success");
});

function collectFormData() {
  const address = selectedAddress();

  return {
    category_id: document.getElementById("category").value,
    brand: document.getElementById("brand").value.trim(),
    name: productName.value.trim(),
    description: description.value.trim(),
    condition: document.getElementById("condition").value,
    shipping_payer: "buyer",
    shipping_method: null,
    ship_from_address_id: address?.id || "",
    ship_from_region: address ? addressRegion(address) : "",
    price: Number(price.dataset.value || 0),
    unit: selectedUnitValue(),
    unit_selection: unit.value,
    minimum_order: Number(minimumOrder.value || 1),
    stock: Number(stock.value || 1),
    weight_grams: Number(weightGrams.value || 0)
  };
}

function validate(data) {
  if (!currentSession?.user) return "Silakan login terlebih dahulu.";
  if (photos.length === 0) return "Tambahkan minimal satu foto produk.";
  if (!data.name) return "Nama produk belum diisi.";
  if (!data.description) return "Deskripsi produk belum diisi.";
  if (!data.category_id) return "Pilih kategori produk.";
  if (!["baru", "bekas"].includes(data.condition)) return "Pilih kondisi Baru atau Bekas.";
  if (!data.ship_from_address_id || !data.ship_from_region) return "Pilih alamat asal produk.";
  if (data.price <= 0) return "Masukkan harga jual yang benar.";
  if (!data.unit) return unit.value === "__custom__" ? "Masukkan satuan produk lainnya." : "Pilih satuan produk.";
  if (data.unit.length > 30) return "Satuan produk maksimal 30 karakter.";
  if (data.minimum_order < 1) return "Minimum order minimal 1.";
  if (data.stock < 1) return "Stok minimal satu.";
  if (!Number.isFinite(data.weight_grams) || data.weight_grams <= 0) return "Isi berat paket dalam gram.";
  if (data.minimum_order > data.stock) return "Minimum order tidak boleh melebihi stok tersedia.";
  return "";
}

function makeStorageFileName() {
  return `${crypto.randomUUID()}.jpg`;
}

async function uploadProductImages(productId, sellerId) {
  const imageRows = [];
  const uploadedPaths = [];

  try {
    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      const storagePath = `${sellerId}/${productId}/${makeStorageFileName()}`;

      const { error: uploadError } = await window.adaajaSupabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(storagePath, photo.blob, {
          contentType: "image/jpeg",
          upsert: false,
          cacheControl: "3600"
        });

      if (uploadError) throw uploadError;

      uploadedPaths.push(storagePath);
      imageRows.push({
        product_id: productId,
        storage_path: storagePath,
        sort_order: index,
        is_cover: index === 0
      });
    }

    const { error: imageInsertError } = await window.adaajaSupabase
      .from("product_images")
      .insert(imageRows);

    if (imageInsertError) throw imageInsertError;

    return uploadedPaths;
  } catch (error) {
    if (uploadedPaths.length) {
      await window.adaajaSupabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .remove(uploadedPaths)
        .catch(() => {});
    }
    throw error;
  }
}

async function rollbackProduct(productId, uploadedPaths = []) {
  try {
    if (uploadedPaths.length) {
      await window.adaajaSupabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .remove(uploadedPaths);
    }
  } catch (error) {
    console.warn("Rollback file gagal:", error);
  }

  try {
    await window.adaajaSupabase
      .from("product_images")
      .delete()
      .eq("product_id", productId);
  } catch (error) {
    console.warn("Rollback product_images gagal:", error);
  }

  try {
    await window.adaajaSupabase
      .from("products")
      .delete()
      .eq("id", productId);
  } catch (error) {
    console.warn("Rollback product gagal:", error);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const session = await requireLogin();
  if (!session?.user) return;
  currentSession = session;

  const data = collectFormData();
  const validationError = validate(data);

  if (validationError) {
    showMessage(validationError);
    return;
  }

  setLoading(true);

  let productId = "";
  let uploadedPaths = [];

  try {
    const now = new Date().toISOString();

    const productPayload = {
      seller_id: session.user.id,
      category_id: data.category_id,
      name: data.name,
      description: data.description,
      brand: data.brand || null,
      condition: data.condition,
      price: data.price,
      unit: data.unit,
      minimum_order: data.minimum_order,
      stock: data.stock,
      weight_grams: data.weight_grams,
      shipping_payer: "buyer",
      ship_from_region: data.ship_from_region,
      status: "active",
      published_at: now
    };

    const { data: product, error: productError } = await window.adaajaSupabase
      .from("products")
      .insert(productPayload)
      .select("id")
      .single();

    if (productError) throw productError;
    if (!product?.id) throw new Error("ID produk tidak terbentuk.");

    productId = product.id;
    uploadedPaths = await uploadProductImages(productId, session.user.id);

    localStorage.removeItem("adaaja_product_draft");
    showMessage("Produk berhasil diterbitkan.", "success");

    setTimeout(() => {
      location.href = `home.html?product=${encodeURIComponent(productId)}`;
    }, 700);
  } catch (error) {
    console.error("Publish product failed:", error);

    if (productId) {
      await rollbackProduct(productId, uploadedPaths);
    }

    const rawMessage = String(error?.message || "");

    if (rawMessage.toLowerCase().includes("row-level security")) {
      showMessage(
        "Akses Supabase ditolak oleh RLS. Periksa policy products, product_images, addresses, dan bucket product-images."
      );
    } else if (rawMessage.toLowerCase().includes("bucket")) {
      showMessage(
        "Bucket product-images tidak tersedia atau policy Storage belum mengizinkan upload."
      );
    } else {
      showMessage(rawMessage || "Produk gagal diterbitkan. Silakan coba kembali.");
    }
  } finally {
    setLoading(false);
  }
});

["category", "condition", "weightGrams"].forEach((id) => {
  const element = document.getElementById(id);
  element.addEventListener(
    element.tagName === "SELECT" ? "change" : "input",
    updateProgress
  );
});

let draftToRestore = null;

(function restoreDraftBase() {
  try {
    const draft = JSON.parse(localStorage.getItem("adaaja_product_draft") || "null");
    draftToRestore = draft;

    if (!draft) {
      updateProgress();
      return;
    }

    productName.value = draft.name || draft.nama_produk || "";
    description.value = draft.description || draft.deskripsi || "";

    const restoredCategory =
      UPLOAD_LEGACY_CATEGORY_MAP[String(draft.category_id || "").toUpperCase()] ||
      draft.category_id ||
      "";

    document.getElementById("category").value = restoredCategory;
    document.getElementById("brand").value = draft.brand || "";
    document.getElementById("condition").value =
      normalizeUploadCondition(draft.condition || draft.kondisi);

    const restoredUnit = String(draft.unit || "pcs").trim();
    if (STANDARD_UNITS.has(restoredUnit)) {
      unit.value = restoredUnit;
      customUnitWrap.hidden = true;
      customUnit.value = "";
    } else if (restoredUnit) {
      unit.value = "__custom__";
      customUnitWrap.hidden = false;
      customUnit.value = restoredUnit;
    }

    minimumOrder.value = Math.max(1, Number(draft.minimum_order || 1));
    stock.value = draft.stock || draft.stok || 1;
    weightGrams.value = draft.weight_grams || "";
    updateMinimumOrderHint();

    const restoredPrice = draft.price || draft.harga || 0;
    if (restoredPrice) {
      price.dataset.value = restoredPrice;
      price.value = new Intl.NumberFormat("id-ID").format(restoredPrice);
    }

    productName.dispatchEvent(new Event("input"));
    description.dispatchEvent(new Event("input"));
    updateProgress();
  } catch (error) {
    console.warn("Draft restore failed:", error);
    updateProgress();
  }
})();

window.addEventListener("beforeunload", () => {
  photos.forEach((photo) => {
    if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
  });
});

window.addEventListener("pageshow", async () => {
  if (!currentSession?.user) return;
  await loadSavedAddresses(currentSession.user.id, draftToRestore?.ship_from_region || "");
});

(async function initUploadPage() {
  const session = await requireLogin();
  if (!session?.user) return;

  currentSession = session;

  try {
    const { data: profile, error } = await window.adaajaSupabase
      .from("profiles")
      .select("username")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) throw error;

    if (!profile?.username) {
      location.replace("complete-account.html");
      return;
    }
  } catch (error) {
    console.warn("Profile validation failed:", error);
  }

  await loadSavedAddresses(session.user.id, draftToRestore?.ship_from_region || "");
  updateMinimumOrderHint();
  updateProgress();
})();
