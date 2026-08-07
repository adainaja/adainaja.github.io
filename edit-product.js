const BUCKET = "product-images";
const MAX_PHOTOS = 10;

const productId = new URLSearchParams(location.search).get("id");

const form = document.getElementById("editProductForm");
const photoInput = document.getElementById("photoInput");
const photoGrid = document.getElementById("photoGrid");
const photoCount = document.getElementById("photoCount");
const productName = document.getElementById("productName");
const description = document.getElementById("description");
const category = document.getElementById("category");
const brand = document.getElementById("brand");
const price = document.getElementById("price");
const unit = document.getElementById("unit");
const minimumOrder = document.getElementById("minimumOrder");
const minimumOrderHint = document.getElementById("minimumOrderHint");
const stock = document.getElementById("stock");
const shippingMethod = document.getElementById("shippingMethod");
const shipFromRegion = document.getElementById("shipFromRegion");
const processingTime = document.getElementById("processingTime");
const message = document.getElementById("formMessage");
const loadingOverlay = document.getElementById("loadingOverlay");
const formProgress = document.getElementById("formProgress");
const progressBar = document.getElementById("progressBar");

let currentUser = null;
let currentProduct = null;
let condition = "";
let shippingPayer = "";
let photos = [];
let removedExistingPaths = [];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(text = "", type = "") {
  message.textContent = text;
  message.className = `form-message ${type}`.trim();
}

function setLoading(isLoading) {
  loadingOverlay.classList.toggle("active", isLoading);
  loadingOverlay.setAttribute("aria-hidden", isLoading ? "false" : "true");
  document.body.classList.toggle("loading", isLoading);
}

function updateProgress() {
  const checks = [
    photos.length > 0,
    productName.value.trim(),
    description.value.trim(),
    category.value,
    condition,
    Number(price.dataset.value || 0) > 0,
    unit.value,
    Number(minimumOrder.value || 0) >= 1,
    Number(stock.value || 0) >= 0,
    shippingPayer,
    shippingMethod.value,
    shipFromRegion.value.trim(),
    processingTime.value
  ];

  const percent = Math.round(
    (checks.filter(Boolean).length / checks.length) * 100
  );

  formProgress.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
}

function getPublicUrl(path) {
  if (!path) return "";
  const { data } = window.adaajaSupabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

async function requireUser() {
  const user = await window.AdaAjaAuth.getCurrentUser();

  if (!user) {
    localStorage.setItem(
      "redirectAfterLogin",
      `edit-product.html?id=${encodeURIComponent(productId || "")}`
    );
    location.replace("login.html");
    return null;
  }

  currentUser = user;
  return user;
}

function formatPriceInput(rawValue) {
  const raw = String(rawValue || "").replace(/\D/g, "").slice(0, 12);
  price.dataset.value = raw;
  price.value = raw
    ? new Intl.NumberFormat("id-ID").format(Number(raw))
    : "";
}

function selectCondition(value) {
  condition = value;

  document.querySelectorAll("#conditionGroup button").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });

  updateProgress();
}

function selectShippingPayer(value) {
  shippingPayer = value;

  document.querySelectorAll("#shippingPayerGroup button").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });

  updateProgress();
}

async function loadProduct() {
  if (!productId) {
    setMessage("ID produk tidak ditemukan.", "error");
    return;
  }

  const user = await requireUser();
  if (!user) return;

  setLoading(true);

  try {
    const { data, error } = await window.adaajaSupabase
      .from("products")
      .select(`
        id,
        seller_id,
        category_id,
        name,
        description,
        brand,
        condition,
        price,
        unit,
        minimum_order,
        stock,
        shipping_payer,
        shipping_method,
        ship_from_region,
        processing_time_days,
        status,
        product_images (
          id,
          storage_path,
          sort_order,
          is_cover
        )
      `)
      .eq("id", productId)
      .eq("seller_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error("Produk tidak ditemukan atau bukan milik akun Anda.");
    }

    currentProduct = data;

    productName.value = data.name || "";
    description.value = data.description || "";
    category.value = data.category_id || "";
    brand.value = data.brand || "";
    unit.value = data.unit || "pcs";
    minimumOrder.value = Math.max(1, Number(data.minimum_order || 1));
    stock.value = Number(data.stock || 0);
    updateMinimumOrderHint();
    shippingMethod.value = data.shipping_method || "";
    shipFromRegion.value = data.ship_from_region || "";
    processingTime.value = String(data.processing_time_days || "");

    formatPriceInput(data.price || 0);
    selectCondition(
      String(data.condition || "").toLowerCase() === "baru" ? "baru" : "bekas"
    );
    selectShippingPayer(data.shipping_payer || "buyer");

    const images = Array.isArray(data.product_images)
      ? [...data.product_images]
      : [];

    images.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

    photos = images.map((image) => ({
      type: "existing",
      id: image.id,
      storagePath: image.storage_path,
      previewUrl: getPublicUrl(image.storage_path),
      blob: null
    }));

    syncCounters();
    renderPhotos();
    updateProgress();
  } catch (error) {
    console.error("Load edit product failed:", error);
    setMessage(error.message || "Produk gagal dimuat.", "error");
  } finally {
    setLoading(false);
  }
}

function renderPhotos() {
  photoGrid.querySelectorAll(".photo-preview").forEach((item) => item.remove());

  photos.forEach((photo, index) => {
    const item = document.createElement("div");
    item.className = "photo-preview";
    item.innerHTML = `
      <img src="${escapeHtml(photo.previewUrl)}" alt="Foto produk ${index + 1}">
      ${index === 0 ? '<span class="cover-badge">Cover</span>' : ""}
      <button type="button" class="remove-photo" aria-label="Hapus foto">×</button>
    `;

    item.querySelector(".remove-photo").addEventListener("click", () => {
      const [removed] = photos.splice(index, 1);

      if (removed?.type === "existing" && removed.storagePath) {
        removedExistingPaths.push(removed.storagePath);
      }

      if (removed?.type === "new" && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      renderPhotos();
      updateProgress();
    });

    photoGrid.appendChild(item);
  });

  photoCount.textContent = photos.length;

  const addButton = document.querySelector(".photo-add");
  addButton.style.display =
    photos.length >= MAX_PHOTOS ? "none" : "flex";
}

function compressImage(file, maxSize = 1280, quality = 0.82) {
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
              reject(new Error("Gambar gagal diproses."));
              return;
            }

            resolve({
              blob,
              previewUrl: URL.createObjectURL(blob)
            });
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

photoInput.addEventListener("change", async (event) => {
  const available = MAX_PHOTOS - photos.length;
  const files = Array.from(event.target.files).slice(0, available);

  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;

    if (file.size > 12 * 1024 * 1024) {
      setMessage(`Foto ${file.name} terlalu besar. Maksimal 12 MB.`, "error");
      continue;
    }

    try {
      const compressed = await compressImage(file);

      photos.push({
        type: "new",
        id: null,
        storagePath: "",
        previewUrl: compressed.previewUrl,
        blob: compressed.blob
      });
    } catch (error) {
      console.error(error);
      setMessage(`Foto ${file.name} gagal diproses.`, "error");
    }
  }

  photoInput.value = "";
  renderPhotos();
  updateProgress();
});

function syncCounters() {
  document.getElementById("nameCount").textContent = productName.value.length;
  document.getElementById("descriptionCount").textContent = description.value.length;
}

productName.addEventListener("input", () => {
  syncCounters();
  updateProgress();
});

description.addEventListener("input", () => {
  syncCounters();
  updateProgress();
});

price.addEventListener("input", () => {
  formatPriceInput(price.value);
  updateProgress();
});

document.querySelectorAll("#conditionGroup button").forEach((button) => {
  button.addEventListener("click", () => {
    selectCondition(button.dataset.value);
  });
});

document.querySelectorAll("#shippingPayerGroup button").forEach((button) => {
  button.addEventListener("click", () => {
    selectShippingPayer(button.dataset.value);
  });
});

document.getElementById("decreaseStock").addEventListener("click", () => {
  stock.value = Math.max(0, Number(stock.value || 0) - 1);
  updateProgress();
});

document.getElementById("increaseStock").addEventListener("click", () => {
  stock.value = Math.min(9999, Number(stock.value || 0) + 1);
  updateProgress();
});

function updateMinimumOrderHint() {
  const value = Math.max(1, Number(minimumOrder.value || 1));
  const unitLabel = unit.value || "satuan";
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
  updateMinimumOrderHint();
  updateProgress();
});

["category", "brand", "stock", "shippingMethod", "shipFromRegion", "processingTime", "unit"]
  .forEach((id) => {
    const element = document.getElementById(id);
    element.addEventListener(
      element.tagName === "SELECT" ? "change" : "input",
      updateProgress
    );
  });

function validate() {
  if (!photos.length) return "Tambahkan minimal satu foto.";
  if (!productName.value.trim()) return "Nama produk belum diisi.";
  if (!description.value.trim()) return "Deskripsi belum diisi.";
  if (!category.value) return "Pilih kategori.";
  if (!condition) return "Pilih kondisi produk.";
  if (Number(price.dataset.value || 0) <= 0) return "Harga jual belum benar.";
  if (!unit.value) return "Pilih satuan produk.";
  if (Number(minimumOrder.value || 0) < 1) return "Minimum order minimal 1.";
  if (Number(stock.value || 0) < 0) return "Stok tidak valid.";
  if (Number(minimumOrder.value || 0) > Number(stock.value || 0)) {
    return "Minimum order tidak boleh melebihi stok tersedia.";
  }
  if (!shippingPayer) return "Pilih penanggung ongkir.";
  if (!shippingMethod.value) return "Pilih metode pengiriman.";
  if (!shipFromRegion.value.trim()) return "Isi asal pengiriman.";
  if (!processingTime.value) return "Pilih waktu proses.";
  return "";
}

async function uploadNewPhotos() {
  const uploaded = [];

  for (const photo of photos) {
    if (photo.type !== "new") continue;

    const storagePath =
      `${currentUser.id}/${productId}/${crypto.randomUUID()}.jpg`;

    const { error } = await window.adaajaSupabase.storage
      .from(BUCKET)
      .upload(storagePath, photo.blob, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false
      });

    if (error) throw error;

    uploaded.push(storagePath);
    photo.storagePath = storagePath;
    photo.type = "existing";
    photo.blob = null;
  }

  return uploaded;
}

async function saveProduct() {
  setMessage("");

  const validationError = validate();

  if (validationError) {
    setMessage(validationError, "error");
    return;
  }

  const user = await requireUser();
  if (!user) return;

  setLoading(true);

  try {
    await uploadNewPhotos();

    if (removedExistingPaths.length) {
      const { error: removeStorageError } =
        await window.adaajaSupabase.storage
          .from(BUCKET)
          .remove(removedExistingPaths);

      if (removeStorageError) {
        console.warn("Sebagian foto lama gagal dihapus:", removeStorageError);
      }
    }

    const { error: deleteRowsError } = await window.adaajaSupabase
      .from("product_images")
      .delete()
      .eq("product_id", productId);

    if (deleteRowsError) throw deleteRowsError;

    const imageRows = photos
      .filter((photo) => photo.storagePath)
      .map((photo, index) => ({
        product_id: productId,
        storage_path: photo.storagePath,
        sort_order: index,
        is_cover: index === 0
      }));

    const { error: insertImagesError } = await window.adaajaSupabase
      .from("product_images")
      .insert(imageRows);

    if (insertImagesError) throw insertImagesError;

    const { error: updateError } = await window.adaajaSupabase
      .from("products")
      .update({
        category_id: category.value,
        name: productName.value.trim(),
        description: description.value.trim(),
        brand: brand.value.trim() || null,
        condition,
        price: Number(price.dataset.value || 0),
        unit: unit.value,
        minimum_order: Number(minimumOrder.value || 1),
        stock: Number(stock.value || 0),
        shipping_payer: shippingPayer,
        shipping_method: shippingMethod.value,
        ship_from_region: shipFromRegion.value.trim(),
        processing_time_days: Number(processingTime.value),
        updated_at: new Date().toISOString()
      })
      .eq("id", productId)
      .eq("seller_id", user.id);

    if (updateError) throw updateError;

    removedExistingPaths = [];

    setMessage("Perubahan produk berhasil disimpan.", "success");

    setTimeout(() => {
      location.href = `my-products.html?updated=${encodeURIComponent(productId)}`;
    }, 850);
  } catch (error) {
    console.error("Save edit product failed:", error);

    const text = String(error?.message || "");

    if (text.toLowerCase().includes("row-level security")) {
      setMessage(
        "Akses ditolak oleh RLS. Pastikan policy update products, product_images, dan Storage mengizinkan pemilik produk.",
        "error"
      );
    } else {
      setMessage(text || "Perubahan gagal disimpan.", "error");
    }
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveProduct();
});

document.getElementById("saveHeaderButton").addEventListener("click", () => {
  saveProduct();
});

window.addEventListener("beforeunload", () => {
  photos.forEach((photo) => {
    if (photo.type === "new" && photo.previewUrl) {
      URL.revokeObjectURL(photo.previewUrl);
    }
  });
});

loadProduct();
