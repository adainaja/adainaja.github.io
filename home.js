const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const topHeader = document.getElementById("topHeader");
const notificationPanel = document.getElementById("notificationPanel");
const accountPanel = document.getElementById("accountPanel");

let products = [];
let favoriteProductIds = new Set();
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


function formatCityOnly(value) {
  const text = String(value || "").trim();
  if (!text) return "Lokasi belum tersedia";

  // Ambil bagian kota/kabupaten dari string lokasi umum.
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);

  const cityLike = parts.find((part) =>
    /^(kota|kab\.?|kabupaten)\s+/i.test(part)
  );
  if (cityLike) {
    return cityLike
      .replace(/^kota\s+/i, "")
      .replace(/^kabupaten\s+/i, "")
      .replace(/^kab\.?\s+/i, "")
      .trim();
  }

  // Untuk format alamat detail seperti "Perumahan..., Batam, Kepulauan Riau",
  // gunakan bagian sebelum provinsi jika tersedia.
  if (parts.length >= 2) {
    const knownProvincePattern = /(aceh|sumatera|kepulauan riau|riau|jambi|bengkulu|lampung|bangka|banten|jakarta|jawa|yogyakarta|bali|nusa tenggara|kalimantan|sulawesi|maluku|papua)/i;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (knownProvincePattern.test(parts[i]) && i - 1 >= 0) {
        return parts[i - 1];
      }
    }
    return parts[parts.length - 2];
  }

  return parts[0];
}

function formatCondition(value) {
  const normalized = String(value || "").trim().toLowerCase();

  return {
    baru: "Baru",
    new: "Baru",
    bekas: "Bekas",
    like_new: "Bekas",
    good: "Bekas",
    fair: "Bekas",
    poor: "Bekas",
    very_poor: "Bekas"
  }[normalized] || value || "";
}

function getPublicImageUrl(storagePath) {
  if (!storagePath) return "";

  const { data } = window.adaajaSupabase.storage
    .from("product-images")
    .getPublicUrl(storagePath);

  return data?.publicUrl || "";
}

async function getSession(forceFresh = false) {
  if (!forceFresh && currentSession?.user) return currentSession;

  const { data, error } = await window.adaajaSupabase.auth.getSession();

  if (error) {
    console.warn("Gagal membaca session:", error);
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
    console.warn("Gagal memuat profile:", error);
    return null;
  }

  currentProfile = data || null;
  return currentProfile;
}

async function setupAccount() {
  const accountAvatar = document.getElementById("accountAvatar");
  const session = await getSession(true);
  const user = session?.user || null;

  if (!user) {
    currentSession = null;
    currentProfile = null;
    accountAvatar.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4"></circle>
        <path d="M4 21a8 8 0 0 1 16 0"></path>
      </svg>
    `;
    return;
  }

  currentSession = { user };
  const profile = await loadCurrentProfile();

  if (profile?.avatar_url) {
    accountAvatar.innerHTML = `
      <img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(profile.username || profile.full_name || "Akun")}">
    `;
    return;
  }

  const sourceName =
    profile?.username ||
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "A";

  const initial = String(sourceName).charAt(0).toUpperCase();
  accountAvatar.innerHTML = `<strong>${escapeHtml(initial)}</strong>`;
}

function renderProductCard(product) {
  const image = getPublicImageUrl(product.cover_storage_path || "");

  const imageHtml = image
    ? `<img src="${image}" alt="${escapeHtml(product.name || "Produk")}" loading="lazy">`
    : `<div class="product-image-placeholder">Foto tidak tersedia</div>`;

  const condition = formatCondition(product.condition);

  return `
    <a href="product-detail.html?id=${encodeURIComponent(product.id)}" class="product-card">
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
          <span class="product-location">${escapeHtml(formatCityOnly(product.ship_from_region))}</span>
          <span>Stok ${Number(product.stock || 0)} ${escapeHtml(formatUnit(product.unit))}</span><span class="product-min">Min. ${formatMin(product.minimum_order)} ${escapeHtml(formatUnit(product.unit))}</span>
        </div>
      </div>
    </a>
  `;
}

function renderProducts(data) {
  if (!data.length) {
    productGrid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24">
            <path d="M6 8h12l1 12H5L6 8Z"></path>
            <path d="M9 8a3 3 0 0 1 6 0"></path>
          </svg>
        </span>
        <strong>Belum ada produk</strong>
        <p>Produk terbaru dari pengguna akan muncul di sini.</p>
        <a href="upload.html">Jual produk pertama</a>
      </div>
    `;
    return;
  }

  productGrid.innerHTML = data.map(renderProductCard).join("");
  bindFavoriteButtons();
}

async function loadFavorites() {
  const session = await getSession();
  favoriteProductIds = new Set();

  if (!session?.user) return;

  const { data, error } = await window.adaajaSupabase
    .from("favorites")
    .select("product_id")
    .eq("user_id", session.user.id);

  if (error) {
    console.warn("Favorit gagal dimuat:", error);
    return;
  }

  favoriteProductIds = new Set((data || []).map((row) => row.product_id));
}

async function toggleFavorite(productId, button) {
  const session = await getSession(true);
  const user = session?.user || null;

  if (!user) {
    localStorage.setItem("redirectAfterLogin", location.href);
    openAccountPanel();
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

    renderProducts(products);
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
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    products = (data || []).map((product) => {
      const images = Array.isArray(product.product_images)
        ? [...product.product_images]
        : [];

      images.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

      const cover =
        images.find((image) => image.is_cover) ||
        images[0] ||
        null;

      return {
        ...product,
        cover_storage_path: cover?.storage_path || ""
      };
    });

    renderProducts(products);

    const heroProductCount = document.getElementById("heroProductCount");
    if (heroProductCount) {
      heroProductCount.textContent = products.length;
    }
  } catch (error) {
    console.error("Gagal memuat produk Supabase:", error);

    productGrid.innerHTML = `
      <div class="empty-state">
        <strong>Produk belum dapat dimuat</strong>
        <p>${escapeHtml(error.message || "Silakan muat ulang halaman.")}</p>
        <button type="button" id="retryProductsButton">Muat ulang</button>
      </div>
    `;

    document.getElementById("retryProductsButton")?.addEventListener("click", loadProducts);
  }
}

function openNotification() {
  notificationPanel.classList.add("active");
  notificationPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function closeNotification() {
  notificationPanel.classList.remove("active");
  notificationPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panel-open");
}

function openAccountPanel() {
  accountPanel.classList.add("active");
  accountPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function closeAccountPanel() {
  accountPanel.classList.remove("active");
  accountPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panel-open");
}

async function handleAccountClick() {
  const session = await getSession(true);
  const user = session?.user || null;

  if (user) {
    location.href = "profile.html";
    return;
  }

  currentSession = null;
  currentProfile = null;
  openAccountPanel();
}

searchInput.addEventListener("input", () => {
  const keyword = searchInput.value.trim().toLowerCase();

  if (!keyword) {
    renderProducts(products);
    return;
  }

  renderProducts(
    products.filter((product) =>
      [
        product.name,
        product.brand,
        product.ship_from_region,
        product.condition,
        product.category_id,
        product.unit
      ].some((value) =>
        String(value || "").toLowerCase().includes(keyword)
      )
    )
  );
});

document.getElementById("notificationButton").onclick = async () => {
  const session = await getSession(true);
  if (!session?.user) {
    localStorage.setItem("redirectAfterLogin", "activity.html");
    openAccountPanel();
    return;
  }
  openNotification();
};
document.getElementById("closeNotification").onclick = closeNotification;
document.getElementById("notificationBackdrop").onclick = closeNotification;
document.getElementById("accountButton").onclick = handleAccountClick;
document.getElementById("closeAccountPanel").onclick = closeAccountPanel;
document.getElementById("accountBackdrop").onclick = closeAccountPanel;

window.addEventListener(
  "scroll",
  () => {
    topHeader.classList.toggle("scrolled", window.scrollY > 8);
  },
  { passive: true }
);

/* =========================================================
   AUTH GUARD — SEMUA FITUR KHUSUS PENGGUNA
   Guest tetap bebas membuka Home, Explore, kategori, pencarian,
   dan detail produk. Fitur transaksi/akun membutuhkan login.
========================================================= */
const protectedPages = new Set([
  "upload.html",
  "my-orders.html",
  "seller-orders.html",
  "my-offers.html",
  "seller-offers.html",
  "messages.html",
  "activity.html",
  "profile.html",
  "checkout.html",
  "payment.html",
  "favorites.html",
  "wishlist.html",
  "withdraw.html",
  "wallet.html",
  "settings.html"
]);

function getPageName(url) {
  return url.pathname.split("/").pop().toLowerCase();
}

function saveRedirectAfterLogin(destination) {
  const page = destination.pathname.split("/").pop() || "home.html";
  localStorage.setItem(
    "redirectAfterLogin",
    page + destination.search + destination.hash
  );
}

document.addEventListener("click", async (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;

  const destination = new URL(link.href, window.location.href);
  if (destination.origin !== window.location.origin) return;
  if (!protectedPages.has(getPageName(destination))) return;

  const session = await getSession(true);
  if (session?.user) return;

  event.preventDefault();
  event.stopPropagation();

  saveRedirectAfterLogin(destination);
  openAccountPanel();
});

window.adaajaReloadProducts = loadProducts;

/*
  Sinkronkan Home dengan perubahan Auth.
  Ini penting setelah logout dan ketika browser mengembalikan halaman
  dari back/forward cache (bfcache).
*/
window.adaajaSupabase.auth.onAuthStateChange(async (event, session) => {
  currentSession = session || null;

  if (event === "SIGNED_OUT" || !session?.user) {
    currentProfile = null;
  }

  await setupAccount();
});

window.addEventListener("pageshow", async () => {
  currentSession = null;
  currentProfile = null;
  await setupAccount();
});

(async function initHome() {
  currentSession = null;
  currentProfile = null;

  await Promise.all([
    setupAccount(),
    loadProducts()
  ]);
})();
