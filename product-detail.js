const API_URL =
  "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

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

let currentProduct = null;
let currentUser = getUser();

function getUser() {
  try {
    return JSON.parse(
      localStorage.getItem("user") || "null"
    );
  } catch (error) {
    console.error("Session user tidak valid:", error);
    return null;
  }
}

function requireLogin(target = location.href) {
  currentUser = getUser();

  if (currentUser) return true;

  localStorage.setItem(
    "redirectAfterLogin",
    target
  );

  location.href = "login.html";
  return false;
}

function convertDriveImage(url) {
  if (!url) return "";

  if (url.includes("drive.google.com")) {
    const id = url.match(/[-\w]{25,}/);

    if (id) {
      return (
        "https://drive.google.com/thumbnail?id=" +
        id[0] +
        "&sz=w1200"
      );
    }
  }

  return url;
}

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCondition(value) {
  const conditions = {
    new: "Baru",
    like_new: "Seperti baru",
    good: "Kondisi baik",
    fair: "Ada sedikit bekas pemakaian",
    poor: "Ada kerusakan atau noda",
    very_poor: "Kondisi kurang baik"
  };

  return conditions[value] || value || "-";
}

function formatShippingPayer(value) {
  return value === "seller"
    ? "Ditanggung penjual"
    : "Ditanggung pembeli";
}

function formatCategory(value) {
  const categories = {
    CAT_BARANG: "Barang",
    CAT_JASA: "Jasa",
    CAT_MAKANAN: "Makanan",
    CAT_RUMAH: "Rumah",
    CAT_ELEKTRONIK: "Elektronik",
    CAT_KENDARAAN: "Kendaraan",
    CAT_EVENT: "Event",
    CAT_LAINNYA: "Lainnya"
  };

  return categories[value] || value || "-";
}

async function loadProduct() {
  if (!productId) {
    showError("ID produk tidak ditemukan.");
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type":
          "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "getProductDetail",
        product_id: productId
      })
    });

    const result = await response.json();

    if (
      result.status !== "success" ||
      !result.product
    ) {
      throw new Error(
        result.message ||
        "Produk tidak ditemukan."
      );
    }

    currentProduct = result.product;
    renderProduct(result.product);
    bottomAction.classList.remove("hidden");
  } catch (error) {
    console.error("Gagal memuat produk:", error);

    showError(
      error.message ||
      "Server tidak terhubung"
    );
  }
}

function showError(message) {
  detailContent.classList.add("hidden");
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
          .map((url, index) => {
            return `
              <div class="gallery-item">
                <img
                  src="${convertDriveImage(url)}"
                  alt="${escapeHtml(product.nama_produk)} ${index + 1}"
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
    product.seller?.nama_lengkap ||
    "Penjual AdaAja";

  const sellerPhoto =
    convertDriveImage(
      product.seller?.foto_profile || ""
    );

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
          ${escapeHtml(product.nama_produk)}
        </h1>

        <strong class="product-price">
          ${formatRupiah(product.harga)}
        </strong>

        <div class="product-meta">
          <span class="meta-chip primary">
            ${escapeHtml(formatCondition(product.kondisi))}
          </span>

          <span class="meta-chip">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 3h12l2 5-8 4-8-4 2-5Z"></path>
              <path d="M4 8v10l8 3 8-3V8"></path>
            </svg>
            Stok ${Number(product.stok || 0)}
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
        ${escapeHtml(product.deskripsi || "Deskripsi belum tersedia.")}
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
          <span class="info-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7h11v10H3z"></path>
              <path d="M14 10h4l3 3v4h-7V10Z"></path>
            </svg>
          </span>
          <span>Biaya pengiriman</span>
          <strong>${formatShippingPayer(product.shipping_payer)}</strong>
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
          <strong>${escapeHtml(product.processing_time || "-")}</strong>
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
              ? `<img src="${sellerPhoto}" alt="${escapeHtml(sellerName)}">`
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
    `${product.nama_produk} — AdaAja`;

  document
    .getElementById("modalCurrentPrice")
    .textContent =
    formatRupiah(product.harga);

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

  track.addEventListener("scroll", () => {
    const index =
      Math.round(
        track.scrollLeft /
        Math.max(track.clientWidth, 1)
      ) + 1;

    counter.textContent =
      `${Math.min(index, total)}/${total}`;
  });
}

function openOfferModal() {
  offerModal.classList.add("active");
  offerModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
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
            currentProduct?.nama_produk ||
            "Produk AdaAja",
          text:
            currentProduct?.nama_produk ||
            "Lihat produk ini di AdaAja",
          url: location.href
        });
      } else {
        await navigator.clipboard.writeText(
          location.href
        );

        alert("Link produk berhasil disalin.");
      }
    } catch (error) {
      console.log("Bagikan dibatalkan:", error);
    }
  });

document
  .getElementById("favoriteButton")
  .addEventListener("click", (event) => {
    if (!requireLogin()) return;

    event.currentTarget.classList.toggle("active");
  });

document
  .getElementById("offerButton")
  .addEventListener("click", () => {
    if (!requireLogin()) return;
    if (!currentProduct) return;

    if (
      String(currentUser.user_id) ===
      String(currentProduct.seller_id)
    ) {
      alert("Anda tidak dapat menawar produk sendiri.");
      return;
    }

    modalMessage.textContent = "";
    modalMessage.style.color = "";
    offerPrice.value = "";
    offerPrice.dataset.value = "";
    offerHint.textContent = "";

    openOfferModal();
  });

document
  .querySelectorAll("[data-close-modal]")
  .forEach((element) => {
    element.addEventListener(
      "click",
      closeOfferModal
    );
  });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeOfferModal();
  }
});

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
      Number(currentProduct.harga) -
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
  .addEventListener("click", async function () {
    const submitButton = this;

    if (!requireLogin()) return;

    const hargaPenawaran =
      Number(offerPrice.dataset.value || 0);

    modalMessage.textContent = "";
    modalMessage.style.color = "";

    if (!currentProduct) {
      modalMessage.textContent =
        "Data produk belum tersedia.";
      return;
    }

    if (
      String(currentUser.user_id) ===
      String(currentProduct.seller_id)
    ) {
      modalMessage.textContent =
        "Anda tidak dapat menawar produk sendiri.";
      return;
    }

    if (hargaPenawaran <= 0) {
      modalMessage.textContent =
        "Masukkan harga penawaran yang benar.";
      return;
    }

    if (
      hargaPenawaran >=
      Number(currentProduct.harga)
    ) {
      modalMessage.textContent =
        "Penawaran harus lebih rendah dari harga saat ini.";
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Mengirim...";

    try {
      const response =
        await fetch(API_URL, {
          method: "POST",
          redirect: "follow",
          headers: {
            "Content-Type":
              "text/plain;charset=utf-8"
          },
          body: JSON.stringify({
            action: "submitOffer",
            product_id:
              currentProduct.product_id,
            buyer_id:
              currentUser.user_id,
            seller_id:
              currentProduct.seller_id,
            harga_asli:
              Number(currentProduct.harga),
            harga_penawaran:
              hargaPenawaran,
            catatan: ""
          })
        });

      const result =
        await response.json();

      if (result.status !== "success") {
        throw new Error(
          result.message ||
          "Penawaran gagal dikirim."
        );
      }

      modalMessage.style.color =
        "#15803d";

      modalMessage.textContent =
        "Penawaran berhasil dikirim kepada penjual.";

      setTimeout(() => {
        closeOfferModal();
        modalMessage.textContent = "";
        modalMessage.style.color = "";
      }, 1500);
    } catch (error) {
      console.error(
        "Gagal mengirim penawaran:",
        error
      );

      modalMessage.textContent =
        error.message ||
        "Server tidak terhubung.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent =
        "Kirim Penawaran";
    }
  });

document
  .getElementById("buyButton")
  .addEventListener("click", () => {
    if (!requireLogin()) return;
    if (!currentProduct) return;

    if (
      String(currentUser.user_id) ===
      String(currentProduct.seller_id)
    ) {
      alert("Anda tidak dapat membeli produk sendiri.");
      return;
    }

    location.href =
      "checkout.html?id=" +
      encodeURIComponent(
        currentProduct.product_id
      );
  });

loadProduct();
