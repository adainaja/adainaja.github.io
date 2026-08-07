const PRODUCT_IMAGE_BUCKET = "product-images";

const productId =
  new URLSearchParams(location.search).get("id");

const detailContent =
  document.getElementById("detailContent");

const errorState =
  document.getElementById("errorState");

const errorMessage =
  document.getElementById("errorMessage");

const bottomAction =
  document.getElementById("bottomAction");

const offerModal =
  document.getElementById("offerModal");

const offerPrice =
  document.getElementById("offerPrice");

const offerHint =
  document.getElementById("offerHint");

const modalMessage =
  document.getElementById("modalMessage");

const favoriteButton =
  document.getElementById("favoriteButton");

const offerButton =
  document.getElementById("offerButton");

const buyButton =
  document.getElementById("buyButton");

let currentProduct = null;
let currentUser = null;
let toastTimer = null;

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatUnit(value) {
  const unit = String(value || "pcs").trim().toLowerCase();
  const labels = {
    unit:"unit", pcs:"pcs", kg:"kg", gram:"gram", ton:"ton", meter:"meter", cm:"cm", mm:"mm", liter:"liter", ml:"ml",
    botol:"botol", dus:"dus", box:"box", pack:"pack", sak:"sak", lembar:"lembar", roll:"roll", pasang:"pasang", set:"set",
    karung:"karung", tray:"tray", bungkus:"bungkus", kaleng:"kaleng", galon:"galon", tabung:"tabung", buah:"buah", ekor:"ekor",
    ikat:"ikat", kodi:"kodi", lusin:"lusin", lainnya:"satuan"
  };
  return labels[unit] || unit || "pcs";
}

function formatMinimumOrder(value) {
  return Math.max(1, Number(value || 1));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeCondition(value) {
  const condition =
    String(value || "").trim().toLowerCase();

  if (condition === "baru" || condition === "new") {
    return "Baru";
  }

  if (
    condition === "bekas" ||
    [
      "like_new",
      "good",
      "fair",
      "poor",
      "very_poor"
    ].includes(condition)
  ) {
    return "Bekas";
  }

  return value || "-";
}

function formatShippingPayer(value) {
  return value === "seller"
    ? "Ditanggung penjual"
    : "Ditanggung pembeli";
}

function formatCategory(value) {
  const categories = {
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

  return categories[String(value || "").toLowerCase()] || value || "-";
}

function formatProcessingTime(days) {
  const value = Number(days || 0);

  if (!value) return "-";
  if (value <= 2) return "1–2 hari";
  if (value <= 3) return "2–3 hari";
  if (value <= 7) return "4–7 hari";

  return `${value} hari`;
}

function getPublicImageUrl(storagePath) {
  if (!storagePath) return "";

  const { data } =
    window.adaajaSupabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .getPublicUrl(storagePath);

  return data?.publicUrl || "";
}

function showFeatureToast(message) {
  let toast =
    document.getElementById("featureToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "featureToast";
    toast.className = "feature-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

async function getCurrentUser() {
  try {
    if (window.AdaAjaAuth?.getCurrentUser) {
      currentUser =
        await window.AdaAjaAuth.getCurrentUser();

      return currentUser;
    }

    const {
      data: { user },
      error
    } = await window.adaajaSupabase.auth.getUser();

    if (error) throw error;

    currentUser = user || null;
    return currentUser;
  } catch (error) {
    console.warn("Validasi user gagal:", error);
    currentUser = null;
    return null;
  }
}

async function requireLogin() {
  const user = await getCurrentUser();

  if (user) return user;

  localStorage.setItem(
    "redirectAfterLogin",
    location.pathname.split("/").pop() +
      location.search +
      location.hash
  );

  location.href = "login.html";
  return null;
}

async function loadProduct() {
  if (!productId) {
    showError("ID produk tidak ditemukan.");
    return;
  }

  try {
    const { data: product, error: productError } =
      await window.adaajaSupabase
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
          published_at,
          created_at,
          product_images (
            storage_path,
            sort_order,
            is_cover
          )
        `)
        .eq("id", productId)
        .maybeSingle();

    if (productError) throw productError;

    if (!product) {
      throw new Error("Produk tidak ditemukan.");
    }

    if (
      product.status &&
      !["active", "published"].includes(
        String(product.status).toLowerCase()
      )
    ) {
      throw new Error("Produk ini sedang tidak tersedia.");
    }

    const { data: seller, error: sellerError } =
      await window.adaajaSupabase
        .from("profiles")
        .select(
          "id, username, full_name, avatar_url, bio, status, created_at"
        )
        .eq("id", product.seller_id)
        .maybeSingle();

    if (sellerError) {
      console.warn(
        "Profil penjual tidak dapat dimuat:",
        sellerError
      );
    }

    const images =
      Array.isArray(product.product_images)
        ? [...product.product_images]
        : [];

    images.sort(
      (a, b) =>
        Number(a.sort_order || 0) -
        Number(b.sort_order || 0)
    );

    currentProduct = {
      ...product,
      seller: seller || null,
      images
    };

    renderProduct(currentProduct);

    bottomAction.classList.remove("hidden");

    offerButton.classList.add("feature-pending");

    await getCurrentUser();
    await syncFavoriteState();
  } catch (error) {
    console.error("Gagal memuat produk:", error);

    showError(
      error.message ||
      "Produk tidak dapat dimuat."
    );
  }
}

function showError(message) {
  detailContent.classList.add("hidden");
  bottomAction.classList.add("hidden");
  errorState.classList.remove("hidden");
  errorMessage.textContent = message;
}

function renderProduct(product) {
  const images =
    Array.isArray(product.images)
      ? product.images
      : [];

  const gallery =
    images.length > 0
      ? images
          .map((image, index) => {
            const url =
              getPublicImageUrl(
                image.storage_path
              );

            if (!url) return "";

            return `
              <div class="gallery-item">
                <img
                  src="${escapeHtml(url)}"
                  alt="${escapeHtml(product.name)} ${index + 1}"
                  loading="${index === 0 ? "eager" : "lazy"}"
                >
              </div>
            `;
          })
          .join("")
      : `
        <div class="gallery-placeholder">
          Foto produk tidak tersedia
        </div>
      `;

  const sellerName =
    product.seller?.username ||
    product.seller?.full_name ||
    "Penjual AdaAja";

  const sellerPhoto =
    product.seller?.avatar_url || "";

  detailContent.innerHTML = `
    <section class="gallery">
      <div class="gallery-track" id="galleryTrack">
        ${gallery}
      </div>

      <span class="gallery-counter" id="galleryCounter">
        1/${Math.max(images.length, 1)}
      </span>
    </section>

    <div class="detail-card">
      <section class="product-summary">
        <span class="product-label">PRODUK ADAAJA</span>

        <h1 class="product-title">
          ${escapeHtml(product.name)}
        </h1>

        <div class="product-price-row">
          <strong class="product-price">${formatRupiah(product.price)}</strong>
          <span class="product-unit">/ ${escapeHtml(formatUnit(product.unit))}</span>
        </div>

        <div class="product-meta">
          <span class="meta-chip primary">
            ${escapeHtml(normalizeCondition(product.condition))}
          </span>

          <span class="meta-chip">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 3h12l2 5-8 4-8-4 2-5Z"></path>
              <path d="M4 8v10l8 3 8-3V8"></path>
            </svg>
            Stok ${Number(product.stock || 0)} ${escapeHtml(formatUnit(product.unit))}
          </span>

          <span class="meta-chip min-order-chip">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l1 12H5L6 8Z"></path><path d="M9 8a3 3 0 0 1 6 0"></path></svg>
            Min. ${formatMinimumOrder(product.minimum_order)} ${escapeHtml(formatUnit(product.unit))}
          </span>

          <span class="meta-chip">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path>
              <circle cx="12" cy="10" r="2.5"></circle>
            </svg>
            ${escapeHtml(
              product.ship_from_region ||
              "Lokasi belum tersedia"
            )}
          </span>
        </div>
      </section>
    </div>

    <section class="detail-section">
      <div class="section-title">
        <div>
          <span>DESKRIPSI</span>
          <h2>Tentang produk</h2>
        </div>

        <span class="section-title-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 4h14v16H5z"></path>
            <path d="M8 8h8M8 12h8M8 16h5"></path>
          </svg>
        </span>
      </div>

      <p class="product-description">
        ${escapeHtml(
          product.description ||
          "Deskripsi belum tersedia."
        )}
      </p>
    </section>

    <section class="detail-section">
      <div class="section-title">
        <div>
          <span>INFORMASI</span>
          <h2>Detail produk</h2>
        </div>

        <span class="section-title-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 11v5M12 8h.01"></path>
          </svg>
        </span>
      </div>

      <div class="info-list">
        <div class="info-row">
          <span class="info-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="2"></rect>
              <rect x="14" y="3" width="7" height="7" rx="2"></rect>
              <rect x="3" y="14" width="7" height="7" rx="2"></rect>
              <rect x="14" y="14" width="7" height="7" rx="2"></rect>
            </svg>
          </span>
          <span>Kategori</span>
          <strong>${escapeHtml(formatCategory(product.category_id))}</strong>
        </div>

        <div class="info-row">
          <span class="info-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 13 11 4H4v7l9 9 7-7Z"></path>
              <circle cx="8" cy="8" r="1"></circle>
            </svg>
          </span>
          <span>Merek</span>
          <strong>${escapeHtml(product.brand || "Tidak ada merek")}</strong>
        </div>

        <div class="info-row">
          <span class="info-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"></path></svg></span>
          <span>Satuan</span>
          <strong>${escapeHtml(formatUnit(product.unit))}</strong>
        </div>

        <div class="info-row">
          <span class="info-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l1 12H5L6 8Z"></path><path d="M9 8a3 3 0 0 1 6 0"></path></svg></span>
          <span>Minimum pembelian</span>
          <strong>${formatMinimumOrder(product.minimum_order)} ${escapeHtml(formatUnit(product.unit))}</strong>
        </div>

        <div class="info-row">
          <span class="info-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7h11v10H3z"></path>
              <path d="M14 10h4l3 3v4h-7V10Z"></path>
            </svg>
          </span>
          <span>Biaya pengiriman</span>
          <strong>${escapeHtml(formatShippingPayer(product.shipping_payer))}</strong>
        </div>

        <div class="info-row">
          <span class="info-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7h11v10H3z"></path>
              <path d="M14 10h4l3 3v4h-7V10Z"></path>
            </svg>
          </span>
          <span>Metode pengiriman</span>
          <strong>${escapeHtml(product.shipping_method || "-")}</strong>
        </div>

        <div class="info-row">
          <span class="info-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2"></path>
            </svg>
          </span>
          <span>Waktu proses</span>
          <strong>${escapeHtml(formatProcessingTime(product.processing_time_days))}</strong>
        </div>
      </div>
    </section>

    <section class="detail-section">
      <div class="section-title">
        <div>
          <span>PENJUAL</span>
          <h2>Informasi penjual</h2>
        </div>

        <span class="section-title-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="4"></circle>
            <path d="M4 21a8 8 0 0 1 16 0"></path>
          </svg>
        </span>
      </div>

      <a
        href="seller-profile.html?id=${encodeURIComponent(product.seller_id || "")}"
        class="seller-card"
      >
        <div class="seller-avatar">
          ${
            sellerPhoto
              ? `<img src="${escapeHtml(sellerPhoto)}" alt="${escapeHtml(sellerName)}">`
              : escapeHtml(sellerName.charAt(0).toUpperCase())
          }
        </div>

        <div class="seller-copy">
          <small>SELLER ADAAJA</small>
          <strong>${escapeHtml(sellerName)}</strong>
          <span>Lihat profil dan produk lain dari penjual ini.</span>
        </div>

        <svg class="seller-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 18 6-6-6-6"></path>
        </svg>
      </a>
    </section>
  `;

  document.title =
    `${product.name} — AdaAja`;

  document
    .getElementById("modalCurrentPrice")
    .textContent =
    `${formatRupiah(product.price)} / ${formatUnit(product.unit)}`;

  setupGallery();
}

function setupGallery() {
  const track =
    document.getElementById("galleryTrack");

  const counter =
    document.getElementById("galleryCounter");

  if (!track || !counter) return;

  const total =
    track.children.length || 1;

  track.addEventListener(
    "scroll",
    () => {
      const index =
        Math.round(
          track.scrollLeft /
          Math.max(track.clientWidth, 1)
        ) + 1;

      counter.textContent =
        `${Math.min(index, total)}/${total}`;
    },
    { passive: true }
  );
}

function closeOfferModal() {
  offerModal.classList.remove("active");
  offerModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

document
  .getElementById("backButton")
  .addEventListener("click", () => {
    if (history.length > 1) {
      history.back();
      return;
    }

    location.href = "home.html";
  });

document
  .getElementById("shareButton")
  .addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title:
            currentProduct?.name ||
            "Produk AdaAja",
          text:
            currentProduct?.name ||
            "Lihat produk ini di AdaAja",
          url: location.href
        });
      } else {
        await navigator.clipboard.writeText(
          location.href
        );

        showFeatureToast(
          "Link produk berhasil disalin."
        );
      }
    } catch (error) {
      console.log(
        "Bagikan dibatalkan:",
        error
      );
    }
  });

async function syncFavoriteState() {
  favoriteButton.classList.remove("active");

  if (!currentUser || !currentProduct) return;

  const { data, error } = await window.adaajaSupabase
    .from("favorites")
    .select("id")
    .eq("user_id", currentUser.id)
    .eq("product_id", currentProduct.id)
    .maybeSingle();

  if (error) {
    console.warn("Status favorit gagal dimuat:", error);
    return;
  }

  favoriteButton.classList.toggle("active", Boolean(data));
  favoriteButton.setAttribute(
    "aria-label",
    data ? "Hapus dari favorit" : "Simpan produk"
  );
}

favoriteButton.addEventListener(
  "click",
  async () => {
    const user = await requireLogin();
    if (!user || !currentProduct) return;

    favoriteButton.disabled = true;

    try {
      const isActive = favoriteButton.classList.contains("active");

      if (isActive) {
        const { error } = await window.adaajaSupabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", currentProduct.id);

        if (error) throw error;
        showFeatureToast("Dihapus dari Favorit.");
      } else {
        const { error } = await window.adaajaSupabase
          .from("favorites")
          .insert({
            user_id: user.id,
            product_id: currentProduct.id
          });

        if (error && error.code !== "23505") throw error;
        showFeatureToast("Disimpan ke Favorit.");
      }

      await syncFavoriteState();
    } catch (error) {
      console.error("Favorit gagal diperbarui:", error);
      showFeatureToast(error.message || "Favorit gagal diperbarui.");
    } finally {
      favoriteButton.disabled = false;
    }
  }
);

offerButton.addEventListener(
  "click",
  async () => {
    const user = await requireLogin();
    if (!user || !currentProduct) return;

    if (
      String(user.id) ===
      String(currentProduct.seller_id)
    ) {
      showFeatureToast(
        "Anda tidak dapat menawar produk sendiri."
      );
      return;
    }

    showFeatureToast(
      "Fitur Ajukan Harga segera hadir."
    );
  }
);

document
  .querySelectorAll("[data-close-modal]")
  .forEach((element) => {
    element.addEventListener(
      "click",
      closeOfferModal
    );
  });

document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape") {
      closeOfferModal();
    }
  }
);

offerPrice.addEventListener("input", () => {
  const raw =
    offerPrice.value
      .replace(/\D/g, "")
      .slice(0, 12);

  offerPrice.dataset.value = raw;

  offerPrice.value =
    raw
      ? new Intl.NumberFormat("id-ID")
          .format(Number(raw))
      : "";

  if (currentProduct && raw) {
    const difference =
      Number(currentProduct.price) -
      Number(raw);

    offerHint.textContent =
      difference > 0
        ? `${formatRupiah(difference)} lebih rendah dari harga sekarang`
        : "Harga penawaran harus lebih rendah dari harga sekarang";
  } else {
    offerHint.textContent = "";
  }
});

document
  .getElementById("submitOffer")
  .addEventListener("click", () => {
    modalMessage.textContent =
      "Fitur Ajukan Harga segera hadir.";
  });

buyButton.addEventListener(
  "click",
  async () => {
    const user = await requireLogin();

    if (!user || !currentProduct) {
      return;
    }

    if (
      String(user.id) ===
      String(currentProduct.seller_id)
    ) {
      showFeatureToast(
        "Anda tidak dapat membeli produk sendiri."
      );
      return;
    }

    const minimumOrder = formatMinimumOrder(currentProduct.minimum_order);
    const stockValue = Number(currentProduct.stock || 0);

    if (stockValue < 1) {
      showFeatureToast("Stok produk sedang habis.");
      return;
    }

    if (stockValue < minimumOrder) {
      showFeatureToast(`Stok tersedia belum memenuhi minimum pembelian ${minimumOrder} ${formatUnit(currentProduct.unit)}.`);
      return;
    }

    location.href =
      "checkout.html?id=" +
      encodeURIComponent(
        currentProduct.id
      );
  }
);

window.adaajaSupabase.auth.onAuthStateChange(
  (_event, session) => {
    currentUser =
      session?.user || null;
  }
);

loadProduct();
