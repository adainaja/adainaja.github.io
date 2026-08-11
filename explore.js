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

const PRODUCT_IMAGE_BUCKET = "product-images";

const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const topHeader = document.getElementById("topHeader");
const notificationPanel = document.getElementById("notificationPanel");
const filterPanel = document.getElementById("filterPanel");
const accountPanel = document.getElementById("accountPanel");
const sortPanel = document.getElementById("sortPanel");
const resultTitle = document.getElementById("resultTitle");
const resultCount = document.getElementById("resultCount");
const sortSelect = document.getElementById("sortSelect");
const filterButton = document.getElementById("filterButton");
const minPriceInput = document.getElementById("minPrice");
const maxPriceInput = document.getElementById("maxPrice");
const accountAvatar = document.getElementById("accountAvatar");

let products = [];
let favoriteProductIds = new Set();
let activeCategory = "all";
let activeCondition = "all";
let minPrice = 0;
let maxPrice = Infinity;

let currentSession = null;
let currentProfile = null;


/* ===== Explore Revision 3: dependency and loading safeguards ===== */
const EXPLORE_IS_FILE = location.protocol === "file:";
let exploreLoadFailsafe = null;

function hasExploreBackend() {
  return Boolean(
    window.adaajaSupabase &&
    typeof window.adaajaSupabase.from === "function" &&
    window.adaajaSupabase.auth
  );
}

function hasExploreAuthHelper() {
  return Boolean(
    window.AdaAjaAuth &&
    typeof window.AdaAjaAuth.getCurrentUser === "function"
  );
}

function setProductGridBusy(isBusy) {
  if (!productGrid) return;
  productGrid.setAttribute("aria-busy", isBusy ? "true" : "false");
}

function renderProductUnavailableState(message, { local = false } = {}) {
  if (!productGrid) return;
  setProductGridBusy(false);
  productGrid.dataset.state = "unavailable";
  resultCount.textContent = "Belum tersedia";
  productGrid.innerHTML = `
    <div class="product-state">
      <div class="product-state-card">
        <span class="product-state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 7h16v12H4z"></path>
            <path d="M8 7V5h8v2"></path>
            <path d="M8 12h8"></path>
          </svg>
        </span>
        <strong>Produk belum dapat dimuat</strong>
        <p>${escapeHtml(message || "Periksa koneksi lalu coba lagi.")}</p>
        <div class="product-state-actions">
          ${local ? `<a class="primary" href="explore.html">Buka ulang</a>` : `<button class="primary" type="button" id="retryProductsButton">Coba lagi</button>`}
        </div>
        ${local ? `<small class="dev-note">Preview lokal tidak memuat konfigurasi Supabase dari repository.</small>` : ""}
      </div>
    </div>
  `;
  document.getElementById("retryProductsButton")?.addEventListener("click", loadProducts);
}

function clearExploreFailsafe() {
  if (exploreLoadFailsafe) {
    clearTimeout(exploreLoadFailsafe);
    exploreLoadFailsafe = null;
  }
}

function startExploreFailsafe() {
  clearExploreFailsafe();
  exploreLoadFailsafe = setTimeout(() => {
    if (productGrid?.getAttribute("aria-busy") === "true") {
      renderProductUnavailableState(
        "Proses memuat terlalu lama. Silakan coba lagi."
      );
    }
  }, 8000);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatUnit(v){return String(v||'pcs').toLowerCase()||'pcs';}
function formatMin(v){return Math.max(1,Number(v||1));}

function normalizeCondition(value) {
  const condition = String(value || "").trim().toLowerCase();

  if (!condition) return "";
  if (condition === "baru" || condition === "new") return "baru";

  if (
    condition === "bekas" ||
    ["like_new", "good", "fair", "poor", "very_poor"].includes(condition)
  ) {
    return "bekas";
  }

  return condition;
}

function formatCondition(value) {
  const condition = normalizeCondition(value);
  if (condition === "baru") return "Baru";
  if (condition === "bekas") return "Bekas";
  return "";
}

function categoryLabel(value) {
  return ADAAJA_CATEGORIES[value] || "Semua produk";
}

function normalizeCategory(product) {
  return String(product?.category_id || "").trim().toLowerCase();
}

function getPublicImageUrl(storagePath) {
  if (!storagePath || !hasExploreBackend() || !window.adaajaSupabase.storage) return "";

  const { data } = window.adaajaSupabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(storagePath);

  return data?.publicUrl || "";
}

async function getSession() {
  if (currentSession?.user) return currentSession;
  if (!hasExploreBackend()) {
    currentSession = null;
    return null;
  }

  const { data, error } = await window.adaajaSupabase.auth.getSession();

  if (error) {
    console.warn("Gagal membaca session Supabase:", error);
    currentSession = null;
    return null;
  }

  currentSession = data.session || null;
  return currentSession;
}

async function loadCurrentProfile() {
  const session = await getSession();

  if (!session?.user) {
    currentProfile = null;
    return null;
  }

  const { data, error } = await window.adaajaSupabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.warn("Gagal memuat profil:", error);
    currentProfile = null;
    return null;
  }

  currentProfile = data || null;
  return currentProfile;
}

async function setupAccount() {
  if (!accountAvatar) return;
  const session = await getSession();

  if (!session?.user) {
    accountAvatar.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4"></circle>
        <path d="M4 21a8 8 0 0 1 16 0"></path>
      </svg>
    `;
    return;
  }

  const profile = await loadCurrentProfile();

  if (profile?.avatar_url) {
    accountAvatar.innerHTML = `
      <img
        src="${escapeHtml(profile.avatar_url)}"
        alt="${escapeHtml(profile.username || profile.full_name || "Akun")}"
      >
    `;
    return;
  }

  const sourceName =
    profile?.username ||
    profile?.full_name ||
    session.user.user_metadata?.full_name ||
    session.user.email ||
    "A";

  const initial = String(sourceName).charAt(0).toUpperCase();

  accountAvatar.innerHTML =
    `<strong>${escapeHtml(initial)}</strong>`;
}

function renderProductCard(product) {
  const image = getPublicImageUrl(product.cover_storage_path || "");

  const imageHtml = image
    ? `<img src="${image}" alt="${escapeHtml(product.name || "Produk")}" loading="lazy">`
    : `<div class="product-image-placeholder">Foto tidak tersedia</div>`;

  const condition = formatCondition(product.condition);

  return `
    <a
      href="product-detail.html?id=${encodeURIComponent(product.id)}"
      class="product-card"
    >
      <div class="product-image">
        ${imageHtml}

        ${
          condition
            ? `<span class="product-condition">${escapeHtml(condition)}</span>`
            : ""
        }

        <button
          class="favorite-mark ${favoriteProductIds.has(product.id) ? "active" : ""}"
          type="button"
          data-favorite-product="${escapeHtml(product.id)}"
          aria-label="${favoriteProductIds.has(product.id) ? "Hapus dari favorit" : "Simpan ke favorit"}"
        >
          <svg viewBox="0 0 24 24">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"></path>
          </svg>
        </button>
      </div>

      <div class="product-body">
        <h3>${escapeHtml(product.name || "Produk")}</h3>
        <div class="product-price-line"><strong>${formatRupiah(product.price)}</strong><span class="product-unit">/ ${escapeHtml(formatUnit(product.unit))}</span></div>

        <div class="product-footer">
          <span>${escapeHtml(product.ship_from_region || "Lokasi belum tersedia")}</span>
          <span>Stok ${Number(product.stock || 0)} ${escapeHtml(formatUnit(product.unit))}</span><span class="product-min">Min. ${formatMin(product.minimum_order)} ${escapeHtml(formatUnit(product.unit))}</span>
        </div>
      </div>
    </a>
  `;
}

function getFilteredProducts() {
  const keyword = searchInput.value.trim().toLowerCase();

  let data = products.filter((product) => {
    const productPrice = Number(product.price || 0);

    const categoryMatch =
      activeCategory === "all" ||
      normalizeCategory(product) === activeCategory;

    const conditionMatch =
      activeCondition === "all" ||
      normalizeCondition(product.condition) === activeCondition;

    const priceMatch =
      productPrice >= minPrice &&
      productPrice <= maxPrice;

    const searchMatch =
      !keyword ||
      [
        product.name,
        product.brand,
        product.ship_from_region,
        normalizeCondition(product.condition),
        formatCondition(product.condition),
        product.category_id,
        product.unit
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(keyword)
      );

    return (
      categoryMatch &&
      conditionMatch &&
      priceMatch &&
      searchMatch
    );
  });

  if (sortSelect.value === "price_low") {
    data.sort(
      (a, b) =>
        Number(a.price || 0) - Number(b.price || 0)
    );
  }

  if (sortSelect.value === "price_high") {
    data.sort(
      (a, b) =>
        Number(b.price || 0) - Number(a.price || 0)
    );
  }

  if (sortSelect.value === "stock") {
    data.sort(
      (a, b) =>
        Number(b.stock || 0) - Number(a.stock || 0)
    );
  }

  if (sortSelect.value === "latest") {
    data.sort((a, b) => {
      const timeA = new Date(a.published_at || a.created_at || 0).getTime();
      const timeB = new Date(b.published_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }

  return data;
}

function renderProducts() {
  const data = getFilteredProducts();
  setProductGridBusy(false);
  productGrid.dataset.state = data.length ? "ready" : "empty";

  resultTitle.textContent =
    searchInput.value.trim()
      ? "Hasil pencarian"
      : categoryLabel(activeCategory);

  resultCount.textContent =
    `${data.length} produk ditemukan`;

  if (!data.length) {
    const hasFilters =
      searchInput.value.trim() ||
      activeCategory !== "all" ||
      activeCondition !== "all" ||
      minPrice > 0 ||
      maxPrice !== Infinity;

    productGrid.innerHTML = `
      <div class="search-empty">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7"></circle>
            <path d="m20 20-3.5-3.5"></path>
          </svg>
        </span>

        <strong>${hasFilters ? "Belum ada yang cocok" : "Belum ada produk"}</strong>

        <p>
          ${
            hasFilters
              ? "Coba kata kunci, kategori, atau filter lain."
              : "Produk terbaru dari pengguna akan muncul di halaman ini."
          }
        </p>

        ${
          hasFilters
            ? `<button type="button" id="clearAllButton">Reset pencarian</button>`
            : `<a href="upload.html">Jual produk pertama</a>`
        }
      </div>
    `;

    document
      .getElementById("clearAllButton")
      ?.addEventListener("click", resetAll);

    return;
  }

  productGrid.innerHTML =
    data.map(renderProductCard).join("");

  bindFavoriteButtons();
}

async function loadFavorites() {
  favoriteProductIds = new Set();
  if (!hasExploreBackend() || !hasExploreAuthHelper()) return;
  const user = await window.AdaAjaAuth.getCurrentUser();

  if (!user) return;

  const { data, error } = await window.adaajaSupabase
    .from("favorites")
    .select("product_id")
    .eq("user_id", user.id);

  if (error) {
    console.warn("Favorit gagal dimuat:", error);
    return;
  }

  favoriteProductIds = new Set((data || []).map((row) => row.product_id));
}

async function toggleFavorite(productId, button) {
  if (!hasExploreBackend() || !hasExploreAuthHelper()) {
    localStorage.setItem("redirectAfterLogin", location.href);
    location.href = "login.html";
    return;
  }
  const user = await window.AdaAjaAuth.getCurrentUser();

  if (!user) {
    localStorage.setItem("redirectAfterLogin", location.href);
    location.href = "login.html";
    return;
  }

  button.disabled = true;

  try {
    if (favoriteProductIds.has(productId)) {
      const { error } = await window.adaajaSupabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);

      if (error) throw error;
      favoriteProductIds.delete(productId);
    } else {
      const { error } = await window.adaajaSupabase
        .from("favorites")
        .insert({ user_id: user.id, product_id: productId });

      if (error && error.code !== "23505") throw error;
      favoriteProductIds.add(productId);
    }

    renderProducts();
  } catch (error) {
    console.error("Gagal memperbarui favorit:", error);
  } finally {
    button.disabled = false;
  }
}

function bindFavoriteButtons() {
  productGrid.querySelectorAll("[data-favorite-product]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await toggleFavorite(button.dataset.favoriteProduct, button);
    });
  });
}

async function loadProducts() {
  resultCount.textContent = "Memuat produk...";
  setProductGridBusy(true);
  productGrid.dataset.state = "loading";
  startExploreFailsafe();

  if (!hasExploreBackend()) {
    clearExploreFailsafe();
    const message = EXPLORE_IS_FILE
      ? "Halaman sedang dibuka sebagai file lokal. Jalankan melalui GitHub Pages/repository agar data Supabase dapat dimuat."
      : "Konfigurasi data AdaAja belum tersedia.";
    renderProductUnavailableState(message, { local: EXPLORE_IS_FILE });
    return;
  }

  try {
    await loadFavorites();
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
        published_at,
        created_at,
        product_images (
          storage_path,
          sort_order,
          is_cover
        )
      `)
      .eq("status", "active")
      .order("published_at", {
        ascending: false,
        nullsFirst: false
      })
      .order("created_at", {
        ascending: false
      })
      .limit(200);

    if (error) throw error;

    products = (data || []).map((product) => {
      const images = Array.isArray(product.product_images)
        ? [...product.product_images]
        : [];

      images.sort(
        (a, b) =>
          Number(a.sort_order || 0) -
          Number(b.sort_order || 0)
      );

      const cover =
        images.find((image) => image.is_cover) ||
        images[0] ||
        null;

      return {
        ...product,
        cover_storage_path:
          cover?.storage_path || ""
      };
    });

    clearExploreFailsafe();
    setProductGridBusy(false);
    productGrid.dataset.state = products.length ? "ready" : "empty";
    renderProducts();
  } catch (error) {
    clearExploreFailsafe();
    console.error("Gagal memuat produk Supabase:", error);
    renderProductUnavailableState(
      error?.message || "Periksa koneksi lalu coba lagi."
    );
  }
}

function openPanel(panel) {
  if (!panel) return;
  panel.classList.add("active");
  panel.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function closePanel(panel) {
  if (!panel) return;
  panel.classList.remove("active");
  panel.setAttribute("aria-hidden", "true");

  if (
    !document.querySelector(
      ".notification-panel.active,.filter-panel.active,.account-panel.active,.sort-panel.active"
    )
  ) {
    document.body.classList.remove("panel-open");
  }
}

function openAccountPanel() {
  openPanel(accountPanel);
}

function closeAccountPanel() {
  closePanel(accountPanel);
}

async function handleAccountClick() {
  const session = await getSession();

  if (session?.user) {
    location.href = "profile.html";
    return;
  }

  openAccountPanel();
}

function selectCategory(category) {
  activeCategory = category;

  document
    .querySelectorAll(".category-chip")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.category === category
      );
    });

  const url = new URL(location.href);

  if (category === "all") {
    url.searchParams.delete("category");
  } else {
    url.searchParams.set("category", category);
  }

  history.replaceState({}, "", url);

  renderProducts();
}

function updateFilterIndicator() {
  filterButton.classList.toggle(
    "has-filter",
    activeCondition !== "all" ||
      minPrice > 0 ||
      maxPrice !== Infinity
  );
}

function resetAll() {
  searchInput.value = "";
  activeCondition = "all";
  minPrice = 0;
  maxPrice = Infinity;

  minPriceInput.value = "";
  maxPriceInput.value = "";
  sortSelect.value = "latest";

  document
    .querySelectorAll("[data-condition]")
    .forEach((button) => {
      button.classList.toggle(
        "selected",
        button.dataset.condition === "all"
      );
    });

  selectCategory("all");
  updateFilterIndicator();
}

async function applyNearbySearch() {
  if (!hasExploreBackend()) {
    searchInput.focus();
    return;
  }
  const session = await getSession();

  if (!session?.user) {
    searchInput.focus();
    return;
  }

  try {
    const { data, error } = await window.adaajaSupabase
      .from("addresses")
      .select("city")
      .eq("user_id", session.user.id)
      .eq("is_primary", true)
      .maybeSingle();

    if (error) throw error;

    if (data?.city) {
      searchInput.value = data.city;
      renderProducts();
    }

    searchInput.focus();
  } catch (error) {
    console.warn("Gagal membaca alamat pengguna:", error);
    searchInput.focus();
  }
}

document
  .querySelectorAll(".category-chip")
  .forEach((button) => {
    button.addEventListener("click", () => {
      selectCategory(button.dataset.category);
    });
  });

document
  .querySelectorAll("[data-condition]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-condition]")
        .forEach((item) => {
          item.classList.remove("selected");
        });

      button.classList.add("selected");
      activeCondition = button.dataset.condition;
    });
  });

searchInput.addEventListener("input", renderProducts);
sortSelect.addEventListener("change", renderProducts);

document.getElementById("notificationButton").onclick =
  () => openPanel(notificationPanel);

document.getElementById("accountButton")?.addEventListener("click", handleAccountClick);

document.getElementById("closeAccountPanel")?.addEventListener("click", closeAccountPanel);

document.getElementById("accountBackdrop")?.addEventListener("click", closeAccountPanel);

document.getElementById("closeNotification").onclick =
  () => closePanel(notificationPanel);

document.getElementById("notificationBackdrop").onclick =
  () => closePanel(notificationPanel);

document.getElementById("filterButton").onclick =
  () => openPanel(filterPanel);

document.getElementById("closeFilter").onclick =
  () => closePanel(filterPanel);

document.getElementById("filterBackdrop").onclick =
  () => closePanel(filterPanel);

document.getElementById("applyFilter").onclick = () => {
  minPrice = Math.max(
    0,
    Number(minPriceInput.value || 0)
  );

  const max =
    Number(maxPriceInput.value || 0);

  maxPrice =
    max > 0
      ? max
      : Infinity;

  if (maxPrice < minPrice) {
    const oldMin = minPrice;
    minPrice = maxPrice;
    maxPrice = oldMin;

    minPriceInput.value =
      Number.isFinite(minPrice)
        ? minPrice
        : "";

    maxPriceInput.value =
      Number.isFinite(maxPrice)
        ? maxPrice
        : "";
  }

  updateFilterIndicator();
  closePanel(filterPanel);
  renderProducts();
};

document.getElementById("resetFilter").onclick = () => {
  activeCondition = "all";
  minPrice = 0;
  maxPrice = Infinity;

  minPriceInput.value = "";
  maxPriceInput.value = "";

  document
    .querySelectorAll("[data-condition]")
    .forEach((button) => {
      button.classList.toggle(
        "selected",
        button.dataset.condition === "all"
      );
    });

  updateFilterIndicator();
  renderProducts();
};

document.getElementById("nearbyButton").onclick =
  applyNearbySearch;

window.addEventListener(
  "scroll",
  () => {
    topHeader.classList.toggle(
      "scrolled",
      window.scrollY > 8
    );
  },
  { passive: true }
);

/* Login wajib hanya untuk tautan menuju upload.html */
document.addEventListener("click", async (event) => {
  const sellLink = event.target.closest('a[href]');

  if (!sellLink) return;

  const destination =
    new URL(sellLink.href, window.location.href);

  const isUploadPage =
    destination.pathname
      .toLowerCase()
      .endsWith("/upload.html");

  if (!isUploadPage) return;

  const session = await getSession();

  if (session?.user) return;

  event.preventDefault();

  localStorage.setItem(
    "redirectAfterLogin",
    destination.pathname.split("/").pop() +
      destination.search +
      destination.hash
  );

  location.href = "login.html";
});

(async function initExplore() {
  const requestedCategory =
    new URLSearchParams(location.search)
      .get("category") || "all";

  const validCategory =
    document.querySelector(
      `[data-category="${CSS.escape(requestedCategory)}"]`
    )
      ? requestedCategory
      : "all";

  activeCategory = validCategory;

  document
    .querySelectorAll(".category-chip")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.category === validCategory
      );
    });

  updateFilterIndicator();

  if (!hasExploreBackend()) {
    console.warn("[AdaAja Explore] Supabase dependency is not available.", {
      protocol: location.protocol
    });
    await loadProducts();
    return;
  }

  await getSession();

  await Promise.all([
    setupAccount(),
    loadProducts()
  ]);
})();

/* ===== Explore final UI helpers ===== */
function normalizeLocationText(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";

  // Collapse broken letter-spacing from stored text, e.g. "B A T A M" -> "BATAM".
  raw = raw.replace(/\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g, (chunk) =>
    chunk.replace(/\s+/g, "")
  );
  raw = raw.replace(/\s+/g, " ").trim();

  // Normalize common Indonesian administrative labels without assuming a city.
  raw = raw
    .replace(/\bKOTA\s+/gi, "Kota ")
    .replace(/\bKABUPATEN\s+/gi, "Kabupaten ")
    .replace(/\bKAB\.?\s+/gi, "Kabupaten ");

  return raw;
}

function titleCaseLocation(value) {
  return String(value || "").toLowerCase().replace(/(^|[\s-])([a-zà-ÿ])/g, (_, lead, chr) =>
    lead + chr.toUpperCase()
  );
}

function formatProductLocation(productOrRegion) {
  const product = typeof productOrRegion === "object" && productOrRegion !== null
    ? productOrRegion
    : { ship_from_region: productOrRegion };

  const directCity = normalizeLocationText(
    product.city || product.ship_from_city || product.seller_city || ""
  );
  if (directCity) return titleCaseLocation(directCity).slice(0, 34);

  const raw = normalizeLocationText(product.ship_from_region || "");
  if (!raw) return "Lokasi belum tersedia";

  const adminMatch = raw.match(/\b(Kota|Kabupaten)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{1,40})/i);
  if (adminMatch) {
    const cleaned = `${adminMatch[1]} ${adminMatch[2]}`
      .split(/,|;|\||\bProv(?:insi)?\b|\bKec(?:amatan)?\.?\b/i)[0]
      .trim();
    return titleCaseLocation(cleaned).slice(0, 34);
  }

  const parts = raw.split(",").map((v) => v.trim()).filter(Boolean);
  const administrative = parts.find((v) =>
    /^(?:kota|kabupaten)\s+/i.test(v)
  );
  if (administrative) return titleCaseLocation(administrative).slice(0, 34);

  // Prefer a plausible city-level segment over street / housing / postal-code fragments.
  const plausible = [...parts].reverse().find((v) =>
    !/^(?:jl\.?|jalan|jln\.?|perum(?:ahan)?|komp(?:lek)?|blok|no\.?|rt\b|rw\b|kel(?:urahan)?\.?|kec(?:amatan)?\.?)/i.test(v) &&
    !/^\d{5}$/.test(v) &&
    v.length <= 34
  );

  return titleCaseLocation(plausible || raw).slice(0, 34);
}

function extractCity(region) {
  return formatProductLocation(region);
}

function formatCompactRupiah(value){
  return formatRupiah(value).replace(/\u00a0/g,' ');
}

// Override product-card renderer with compact marketplace hierarchy.
renderProductCard = function(product) {
  const image = getPublicImageUrl(product.cover_storage_path || '');
  const imageHtml = image ? `<img src="${image}" alt="${escapeHtml(product.name || 'Produk')}" loading="lazy">` : `<div class="product-image-placeholder">Foto tidak tersedia</div>`;
  const condition = formatCondition(product.condition);
  const unit = formatUnit(product.unit);
  const city = formatProductLocation(product);
  return `<a href="product-detail.html?id=${encodeURIComponent(product.id)}" class="product-card">
    <div class="product-image">${imageHtml}${condition ? `<span class="product-condition ${normalizeCondition(product.condition) === 'bekas' ? 'condition-used' : 'condition-new'}">${escapeHtml(condition)}</span>` : ''}
      <button class="favorite-mark ${favoriteProductIds.has(product.id)?'active':''}" type="button" data-favorite-product="${escapeHtml(product.id)}" aria-label="${favoriteProductIds.has(product.id)?'Hapus dari favorit':'Simpan ke favorit'}"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"></path></svg></button>
    </div>
    <div class="product-body"><h3>${escapeHtml(product.name || 'Produk')}</h3>
      <div class="product-price-line"><strong>${formatCompactRupiah(product.price)}</strong><span class="product-unit">/ ${escapeHtml(unit)}</span></div>
      <div class="product-footer"><span class="product-location"><svg viewBox="0 0 24 24"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z"></path><circle cx="12" cy="10" r="2"></circle></svg>${escapeHtml(city)}</span>
      <div class="product-meta"><span>Stok ${Number(product.stock||0)} ${escapeHtml(unit)}</span><span class="product-min">Min. ${formatMin(product.minimum_order)} ${escapeHtml(unit)}</span></div></div>
    </div></a>`;
};

function renderActiveFilterChips(){
  const box=document.getElementById('activeFilterChips'); if(!box)return;
  const chips=[];
  if(activeCondition!=='all') chips.push({key:'condition',label:formatCondition(activeCondition)});
  if(minPrice>0 || maxPrice!==Infinity){
    const left=minPrice>0?formatRupiah(minPrice):'Rp0'; const right=maxPrice!==Infinity?formatRupiah(maxPrice):'Tanpa batas';
    chips.push({key:'price',label:`${left}–${right}`});
  }
  if(!chips.length){box.hidden=true;box.innerHTML='';return;}
  box.hidden=false; box.innerHTML=chips.map(c=>`<button class="active-filter-chip" type="button" data-remove-filter="${c.key}">${escapeHtml(c.label)} <b>×</b></button>`).join('');
  box.querySelectorAll('[data-remove-filter]').forEach(btn=>btn.onclick=()=>{
    if(btn.dataset.removeFilter==='condition'){activeCondition='all';document.querySelectorAll('[data-condition]').forEach(x=>x.classList.toggle('selected',x.dataset.condition==='all'));}
    if(btn.dataset.removeFilter==='price'){minPrice=0;maxPrice=Infinity;minPriceInput.value='';maxPriceInput.value='';}
    updateFilterIndicator();renderActiveFilterChips();renderProducts();
  });
}

const _renderProducts = renderProducts;
renderProducts = function(){
  _renderProducts();
  const keyword=searchInput.value.trim();
  const eyebrow=document.getElementById('resultEyebrow');
  if(keyword){
    resultTitle.textContent=`Hasil untuk “${keyword}”`;
    if(eyebrow) eyebrow.textContent='HASIL PENCARIAN';
  } else if(eyebrow) {
    eyebrow.textContent='TEMUKAN';
  }
  renderActiveFilterChips();
};

// Search clear button.
if(searchInput && !document.getElementById('searchClear')){
  const clear=document.createElement('button');clear.type='button';clear.id='searchClear';clear.className='search-clear';clear.setAttribute('aria-label','Hapus pencarian');clear.innerHTML='<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
  searchInput.parentElement.appendChild(clear);
  const sync=()=>clear.classList.toggle('visible',!!searchInput.value.trim());
  searchInput.addEventListener('input',sync); clear.onclick=()=>{searchInput.value='';sync();renderProducts();searchInput.focus();}; sync();
}


/* ===== Revision 2 custom sort presentation ===== */
(function setupPremiumSort(){
  const sortButton = document.getElementById("sortButton");
  const sortLabel = document.getElementById("sortButtonLabel");
  const closeSort = document.getElementById("closeSort");
  const sortBackdrop = document.getElementById("sortBackdrop");
  if (!sortButton || !sortSelect || !sortPanel) return;

  const syncSortUI = () => {
    const selected = sortSelect.options[sortSelect.selectedIndex];
    if (sortLabel) sortLabel.textContent = selected?.textContent || "Terbaru";
    document.querySelectorAll("[data-sort-value]").forEach((button) => {
      button.classList.toggle("selected", button.dataset.sortValue === sortSelect.value);
    });
  };

  sortButton.addEventListener("click", () => {
    syncSortUI();
    openPanel(sortPanel);
  });
  closeSort?.addEventListener("click", () => closePanel(sortPanel));
  sortBackdrop?.addEventListener("click", () => closePanel(sortPanel));

  document.querySelectorAll("[data-sort-value]").forEach((button) => {
    button.addEventListener("click", () => {
      sortSelect.value = button.dataset.sortValue;
      sortSelect.dispatchEvent(new Event("change", { bubbles: true }));
      syncSortUI();
      closePanel(sortPanel);
    });
  });

  sortSelect.addEventListener("change", syncSortUI);
  syncSortUI();
})();

/* ===== Explore Revision 5: discovery navigation polish ===== */
(function setupDiscoveryCategoryPolish(){
  const strip = document.querySelector('.category-strip');
  if (!strip) return;
  strip.querySelectorAll('.category-chip').forEach((button) => {
    button.setAttribute('aria-label', `Kategori ${button.textContent.trim()}`);
    button.addEventListener('click', () => {
      button.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });
})();
