const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const topHeader = document.getElementById("topHeader");
const notificationPanel = document.getElementById("notificationPanel");
const accountPanel = document.getElementById("accountPanel");

let products = [];
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

async function getSession() {
  if (currentSession?.user) return currentSession;

  const { data, error } = await window.adaajaSupabase.auth.getSession();

  if (error) {
    console.warn("Gagal membaca session:", error);
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
  const profile = await loadCurrentProfile();
  const session = currentSession;

  if (!session?.user) {
    accountAvatar.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4"></circle>
        <path d="M4 21a8 8 0 0 1 16 0"></path>
      </svg>
    `;
    return;
  }

  if (profile?.avatar_url) {
    accountAvatar.innerHTML = `
      <img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(profile.username || profile.full_name || "Akun")}">
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

        <span class="favorite-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"></path>
          </svg>
        </span>
      </div>

      <div class="product-body">
        <h3>${escapeHtml(product.name || "Produk")}</h3>
        <strong>${formatRupiah(product.price)}</strong>

        <div class="product-footer">
          <span>${escapeHtml(product.ship_from_region || "Lokasi belum tersedia")}</span>
          <span>Stok ${Number(product.stock || 0)}</span>
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
}

async function loadProducts() {
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
  const session = await getSession();

  if (session?.user) {
    location.href = "profile.html";
    return;
  }

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
        product.category_id
      ].some((value) =>
        String(value || "").toLowerCase().includes(keyword)
      )
    )
  );
});

document.getElementById("notificationButton").onclick = openNotification;
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
   AUTH GUARD — FITUR JUAL PRODUK
========================================================= */
document.addEventListener("click", async (event) => {
  const sellLink = event.target.closest('a[href]');

  if (!sellLink) return;

  const destination = new URL(sellLink.href, window.location.href);
  const isUploadPage = destination.pathname.toLowerCase().endsWith("/upload.html");

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

window.adaajaReloadProducts = loadProducts;

(async function initHome() {
  await getSession();
  await Promise.all([
    setupAccount(),
    loadProducts()
  ]);
})();
