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
  if (!storagePath) return "";

  const { data } = window.adaajaSupabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(storagePath);

  return data?.publicUrl || "";
}

async function getSession() {
  if (currentSession?.user) return currentSession;

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

        <strong>${hasFilters ? "Produk tidak ditemukan" : "Belum ada produk"}</strong>

        <p>
          ${
            hasFilters
              ? "Coba ubah kata pencarian, kategori, atau filter yang digunakan."
              : "Produk terbaru dari pengguna akan muncul di halaman ini."
          }
        </p>

        ${
          hasFilters
            ? `<button type="button" id="clearAllButton">Hapus pencarian & filter</button>`
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
  const user = await window.AdaAjaAuth.getCurrentUser();
  favoriteProductIds = new Set();

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

    renderProducts();
  } catch (error) {
    console.error("Gagal memuat produk Supabase:", error);

    resultCount.textContent = "Gagal memuat";

    productGrid.innerHTML = `
      <div class="search-empty">
        <strong>Produk belum dapat dimuat</strong>
        <p>${escapeHtml(error.message || "Silakan muat ulang halaman.")}</p>
        <button type="button" id="reloadButton">Muat ulang</button>
      </div>
    `;

    document
      .getElementById("reloadButton")
      ?.addEventListener("click", loadProducts);
  }
}

function openPanel(panel) {
  panel.classList.add("active");
  panel.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function closePanel(panel) {
  panel.classList.remove("active");
  panel.setAttribute("aria-hidden", "true");

  if (
    !document.querySelector(
      ".notification-panel.active,.filter-panel.active,.account-panel.active"
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

document.getElementById("accountButton").onclick =
  handleAccountClick;

document.getElementById("closeAccountPanel").onclick =
  closeAccountPanel;

document.getElementById("accountBackdrop").onclick =
  closeAccountPanel;

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

  await getSession();

  await Promise.all([
    setupAccount(),
    loadProducts()
  ]);

  updateFilterIndicator();
})();
