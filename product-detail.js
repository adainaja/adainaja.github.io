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
          ship_from_region,
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

      <div class="seller-profile-card">
        <div class="seller-profile-head">
          <div class="seller-avatar">
            ${
              sellerPhoto
                ? `<img src="${escapeHtml(sellerPhoto)}" alt="${escapeHtml(sellerName)}">`
                : escapeHtml(sellerName.charAt(0).toUpperCase())
            }
          </div>

          <div class="seller-profile-copy">
            <small>SELLER ADAAJA</small>
            <strong>${escapeHtml(sellerName)}</strong>
            <span>${escapeHtml(product.seller?.bio || "Penjual aktif di AdaAja.")}</span>
          </div>

          <span class="seller-status ${
            String(product.seller?.status || "active").toLowerCase() === "active"
              ? "active"
              : ""
          }">
            ${escapeHtml(product.seller?.status || "active")}
          </span>
        </div>

        <div class="seller-profile-meta">
          <div>
            <span>Status</span>
            <strong>${escapeHtml(product.seller?.status || "Aktif")}</strong>
          </div>
          <div>
            <span>Sejak</span>
            <strong>${escapeHtml(formatJoinDate(product.seller?.created_at))}</strong>
          </div>
        </div>

        <div class="seller-actions">
          <a
            href="seller-profile.html?id=${encodeURIComponent(product.seller_id || "")}"
            class="seller-profile-link"
          >
            Lihat Profil
          </a>

          <button
            class="seller-chat-button"
            id="chatSellerButton"
            type="button"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5h16v11H8l-4 4V5Z"></path>
              <path d="M8 9h8"></path>
              <path d="M8 12h5"></path>
            </svg>
            Chat Penjual
          </button>
        </div>
      </div>
    </section>

    <section class="detail-section comment-section">
      <div class="section-title">
        <div>
          <span>KOMENTAR</span>
          <h2>Tanya tentang produk</h2>
        </div>

        <span class="section-title-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16v11H8l-4 4V5Z"></path>
          </svg>
        </span>
      </div>

      <div class="comment-compose">
        <div class="comment-compose-head">
          <strong>Tulis komentar</strong>
          <span><b id="commentCount">0</b>/500</span>
        </div>

        <textarea
          id="commentInput"
          maxlength="500"
          rows="3"
          placeholder="Tanyakan kondisi, spesifikasi, ketersediaan, atau detail lain kepada penjual."
        ></textarea>

        <button
          id="submitCommentButton"
          type="button"
        >
          Kirim
        </button>
      </div>

      <div class="comment-list" id="commentList">
        <div class="comment-loading">Memuat komentar...</div>
      </div>
    </section>
  `;

  document.title =
    `${product.name} — AdaAja`;

  document
    .getElementById("modalCurrentPrice")
    .textContent =
    `${formatRupiah(product.price)} / ${formatUnit(product.unit)}`;

  setupGallery();
  bindSellerAndCommentActions();
  loadProductComments();
}


function formatJoinDate(value) {
  if (!value) return "Bergabung di AdaAja";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Bergabung di AdaAja";
  }

  return `Bergabung ${new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric"
  }).format(date)}`;
}

async function startSellerChat() {
  const user = await requireLogin();

  if (!user || !currentProduct) return;

  const sellerId = currentProduct.seller_id;

  if (!sellerId) {
    showFeatureToast("Data penjual tidak tersedia.");
    return;
  }

  if (String(user.id) === String(sellerId)) {
    showFeatureToast("Ini adalah produk Anda sendiri.");
    return;
  }

  const chatButton =
    document.getElementById("chatSellerButton");

  if (chatButton) {
    chatButton.disabled = true;
    chatButton.dataset.originalText = chatButton.innerHTML;
    chatButton.innerHTML = `
      <span class="chat-button-spinner"></span>
      Membuka Chat
    `;
  }

  try {
    const {
      data,
      error
    } = await window.adaajaSupabase.rpc(
      "get_or_create_product_conversation",
      {
        p_product_id: currentProduct.id,
        p_seller_id: sellerId
      }
    );

    if (error) throw error;

    const conversationId =
      typeof data === "string"
        ? data
        : data?.conversation_id ||
          data?.id ||
          null;

    if (!conversationId) {
      throw new Error(
        "Conversation ID tidak diterima dari database."
      );
    }

    location.href =
      `chat.html?conversation_id=${encodeURIComponent(conversationId)}`;
  } catch (error) {
    console.error("Chat penjual gagal dibuka:", error);

    let message =
      error?.message ||
      "Chat belum dapat dibuka.";

    if (
      message.toLowerCase().includes("function") &&
      message.toLowerCase().includes("does not exist")
    ) {
      message =
        "Fungsi chat database belum dipasang. Jalankan SQL chat RPC terlebih dahulu.";
    }

    showFeatureToast(message);
  } finally {
    if (chatButton) {
      chatButton.disabled = false;
      chatButton.innerHTML =
        chatButton.dataset.originalText ||
        "Chat Penjual";
    }
  }
}

async function loadProductComments() {
  const list =
    document.getElementById("commentList");

  if (!list || !currentProduct) return;

  list.innerHTML = `
    <div class="comment-loading">
      Memuat komentar...
    </div>
  `;

  try {
    const {
      data: rows,
      error
    } = await window.adaajaSupabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", currentProduct.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const userIds = [
      ...new Set(
        (rows || [])
          .map((row) =>
            row.user_id ||
            row.buyer_id ||
            row.reviewer_id
          )
          .filter(Boolean)
      )
    ];

    let profiles = [];

    if (userIds.length) {
      const profileResult =
        await window.adaajaSupabase
          .from("profiles")
          .select("id,username,full_name,avatar_url")
          .in("id", userIds);

      profiles = profileResult.data || [];
    }

    const profileMap =
      new Map(
        profiles.map((profile) => [
          profile.id,
          profile
        ])
      );

    if (!(rows || []).length) {
      list.innerHTML = `
        <div class="comment-empty">
          <strong>Belum ada komentar</strong>
          <span>Jadilah yang pertama menanyakan produk ini.</span>
        </div>
      `;
      return;
    }

    list.innerHTML =
      rows.map((row) => {
        const userId =
          row.user_id ||
          row.buyer_id ||
          row.reviewer_id;

        const profile =
          profileMap.get(userId) || {};

        const name =
          profile.username ||
          profile.full_name ||
          "Pengguna AdaAja";

        const text =
          row.comment ||
          row.review_text ||
          row.content ||
          row.message ||
          "";

        const dateText =
          row.created_at
            ? new Intl.DateTimeFormat("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric"
              }).format(new Date(row.created_at))
            : "";

        return `
          <article class="comment-item">
            <div class="comment-avatar">
              ${
                profile.avatar_url
                  ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(name)}">`
                  : escapeHtml(name.charAt(0).toUpperCase())
              }
            </div>

            <div class="comment-copy">
              <div class="comment-topline">
                <strong>${escapeHtml(name)}</strong>
                <span>${escapeHtml(dateText)}</span>
              </div>

              <p>${escapeHtml(text || "Komentar")}</p>
            </div>
          </article>
        `;
      }).join("");
  } catch (error) {
    console.warn("Komentar gagal dimuat:", error);

    list.innerHTML = `
      <div class="comment-empty">
        <strong>Kolom komentar siap digunakan</strong>
        <span>Komentar akan muncul setelah tabel ulasan menerima data komentar.</span>
      </div>
    `;
  }
}

async function submitProductComment() {
  const user = await requireLogin();

  if (!user || !currentProduct) return;

  const input =
    document.getElementById("commentInput");

  const button =
    document.getElementById("submitCommentButton");

  const text =
    String(input?.value || "").trim();

  if (!text) {
    showFeatureToast("Tulis komentar terlebih dahulu.");
    return;
  }

  if (text.length > 500) {
    showFeatureToast("Komentar maksimal 500 karakter.");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Mengirim...";
  }

  const attempts = [
    {
      product_id: currentProduct.id,
      user_id: user.id,
      comment: text
    },
    {
      product_id: currentProduct.id,
      buyer_id: user.id,
      review_text: text,
      rating: 5
    },
    {
      product_id: currentProduct.id,
      user_id: user.id,
      review_text: text,
      rating: 5
    }
  ];

  let lastError = null;
  let success = false;

  for (const payload of attempts) {
    const { error } =
      await window.adaajaSupabase
        .from("product_reviews")
        .insert(payload);

    if (!error) {
      success = true;
      break;
    }

    lastError = error;
  }

  if (!success) {
    console.error("Komentar gagal dikirim:", lastError);

    showFeatureToast(
      lastError?.message ||
      "Komentar belum dapat dikirim."
    );

    if (button) {
      button.disabled = false;
      button.textContent = "Kirim";
    }

    return;
  }

  input.value = "";
  document
    .getElementById("commentCount")
    .textContent = "0";

  showFeatureToast("Komentar berhasil dikirim.");

  await loadProductComments();

  if (button) {
    button.disabled = false;
    button.textContent = "Kirim";
  }
}

function bindSellerAndCommentActions() {
  const chatButton =
    document.getElementById("chatSellerButton");

  if (chatButton) {
    chatButton.addEventListener(
      "click",
      startSellerChat
    );
  }

  const commentInput =
    document.getElementById("commentInput");

  if (commentInput) {
    commentInput.addEventListener(
      "input",
      () => {
        const counter =
          document.getElementById("commentCount");

        if (counter) {
          counter.textContent =
            String(commentInput.value.length);
        }
      }
    );
  }

  const submitButton =
    document.getElementById("submitCommentButton");

  if (submitButton) {
    submitButton.addEventListener(
      "click",
      submitProductComment
    );
  }
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

function openOfferModal() {
  if (!currentProduct) return;

  modalMessage.textContent = "";
  modalMessage.style.color = "";
  offerHint.textContent = "Masukkan nominal di bawah harga produk.";

  document
    .getElementById("modalCurrentPrice")
    .textContent =
      `${formatRupiah(currentProduct.price)} / ${formatUnit(currentProduct.unit)}`;

  offerModal.classList.add("active");
  offerModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");

  requestAnimationFrame(() => offerPrice.focus());
}

function parseOfferValue(value) {
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

function updateOfferInput() {
  const numericValue = parseOfferValue(offerPrice.value);

  offerPrice.dataset.value = numericValue
    ? String(numericValue)
    : "";

  offerPrice.value = numericValue
    ? new Intl.NumberFormat("id-ID").format(numericValue)
    : "";

  if (!numericValue || !currentProduct) {
    offerHint.textContent =
      "Masukkan nominal di bawah harga produk.";
    return;
  }

  const current = Number(currentProduct.price || 0);

  if (numericValue >= current) {
    offerHint.textContent =
      "Harga penawaran harus lebih rendah dari harga produk.";
    return;
  }

  const difference = current - numericValue;
  const percent = current
    ? Math.round((difference / current) * 100)
    : 0;

  offerHint.textContent =
    `${formatRupiah(difference)} lebih rendah (${percent}%).`;
}

offerPrice.addEventListener("input", () => {
  modalMessage.textContent = "";
  modalMessage.style.color = "";
  updateOfferInput();
});

document
  .querySelectorAll("[data-close-modal]")
  .forEach((button) => {
    button.addEventListener("click", closeOfferModal);
  });

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    offerModal.classList.contains("active")
  ) {
    closeOfferModal();
  }
});

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

    if (String(user.id) === String(currentProduct.seller_id)) {
      showFeatureToast("Anda tidak dapat menawar produk sendiri.");
      return;
    }

    modalMessage.textContent = "";
    modalMessage.style.color = "";
    offerPrice.value = "";
    offerPrice.dataset.value = "";

    openOfferModal();
  }
);

document
  .getElementById("submitOffer")
  .addEventListener("click", async function () {
    const submitButton = this;
    const user = await requireLogin();

    if (!user || !currentProduct) return;

    const offeredPrice =
      Number(offerPrice.dataset.value || 0);

    modalMessage.textContent = "";
    modalMessage.style.color = "";

    if (String(user.id) === String(currentProduct.seller_id)) {
      modalMessage.textContent =
        "Anda tidak dapat menawar produk sendiri.";
      return;
    }

    const originalPrice = Number(currentProduct.price || 0);

    if (offeredPrice <= 0) {
      modalMessage.textContent =
        "Masukkan harga penawaran yang benar.";
      return;
    }

    if (offeredPrice >= originalPrice) {
      modalMessage.textContent =
        "Harga penawaran harus lebih rendah dari harga produk.";
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Mengirim...";

    try {
      const { data: existing, error: existingError } =
        await window.adaajaSupabase
          .from("offers")
          .select("id,status")
          .eq("product_id", currentProduct.id)
          .eq("buyer_id", user.id)
          .in("status", ["pending", "countered", "accepted"])
          .limit(1);

      if (existingError) throw existingError;

      if ((existing || []).length) {
        throw new Error(
          "Anda masih memiliki negosiasi aktif untuk produk ini."
        );
      }

      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ).toISOString();

      const { error } = await window.adaajaSupabase
        .from("offers")
        .insert({
          product_id: currentProduct.id,
          buyer_id: user.id,
          seller_id: currentProduct.seller_id,
          original_price: originalPrice,
          offered_price: offeredPrice,
          counter_price: null,
          status: "pending",
          expires_at: expiresAt
        });

      if (error) throw error;

      modalMessage.style.color = "#15803d";
      modalMessage.textContent =
        "Penawaran berhasil dikirim kepada penjual.";

      setTimeout(() => {
        closeOfferModal();
        modalMessage.textContent = "";
        modalMessage.style.color = "";
        location.href = "my-offers.html";
      }, 1100);
    } catch (error) {
      console.error("Gagal mengirim penawaran:", error);
      modalMessage.textContent =
        error.message || "Penawaran gagal dikirim.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Kirim Penawaran";
    }
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
