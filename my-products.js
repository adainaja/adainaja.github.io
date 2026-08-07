const BUCKET = "product-images";

const productList = document.getElementById("productList");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const statusTabs = document.getElementById("statusTabs");
const resultCount = document.getElementById("resultCount");
const actionSheet = document.getElementById("actionSheet");
const sheetThumb = document.getElementById("sheetThumb");
const sheetProductName = document.getElementById("sheetProductName");
const toggleActionTitle = document.getElementById("toggleActionTitle");
const toggleActionSubtitle = document.getElementById("toggleActionSubtitle");
const toast = document.getElementById("toast");

let currentUser = null;
let products = [];
let selectedProduct = null;
let activeStatus = "all";
let toastTimer = null;

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


function formatUnit(value) {
  const unit = String(value || "pcs").trim().toLowerCase();
  return unit || "pcs";
}

function formatMinimumOrder(value) {
  return Math.max(1, Number(value || 1));
}

function formatDate(value) {
  if (!value) return "Tanggal tidak tersedia";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function conditionLabel(value) {
  const condition = String(value || "").toLowerCase();
  if (condition === "baru" || condition === "new") return "Baru";
  return "Bekas";
}

function getPublicUrl(path) {
  if (!path) return "";
  const { data } = window.adaajaSupabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

async function requireUser() {
  const user = await window.AdaAjaAuth.getCurrentUser();

  if (!user) {
    localStorage.setItem("redirectAfterLogin", "my-products.html");
    location.replace("login.html");
    return null;
  }

  currentUser = user;
  return user;
}

async function loadProducts() {
  const user = await requireUser();
  if (!user) return;

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
        status,
        published_at,
        created_at,
        updated_at,
        product_images (
          storage_path,
          sort_order,
          is_cover
        )
      `)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

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
        cover_path: cover?.storage_path || "",
        all_image_paths: images.map((image) => image.storage_path).filter(Boolean)
      };
    });

    updateStats();
    renderProducts();
  } catch (error) {
    console.error("Gagal memuat produk:", error);

    productList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6M12 17h.01"></path></svg>
        </span>
        <strong>Produk belum dapat dimuat</strong>
        <p>${escapeHtml(error.message || "Silakan coba lagi.")}</p>
        <button type="button" id="retryButton">Muat ulang</button>
      </div>
    `;

    document.getElementById("retryButton")?.addEventListener("click", loadProducts);
  }
}

function updateStats() {
  const total = products.length;
  const active = products.filter(
    (product) => String(product.status || "").toLowerCase() === "active"
  ).length;
  const soldOut = products.filter(
    (product) => Number(product.stock || 0) <= 0
  ).length;

  document.getElementById("totalProducts").textContent = total;
  document.getElementById("activeProducts").textContent = active;
  document.getElementById("soldOutProducts").textContent = soldOut;
}

function getFilteredProducts() {
  const keyword = searchInput.value.trim().toLowerCase();

  let filtered = products.filter((product) => {
    const status = String(product.status || "").toLowerCase();

    const statusForFilter =
      activeStatus === "inactive"
        ? "draft"
        : activeStatus;

    const matchesStatus =
      activeStatus === "all" ||
      status === statusForFilter;

    const matchesKeyword =
      !keyword ||
      [
        product.name,
        product.brand,
        product.category_id,
        product.condition,
        product.unit
      ].some((value) =>
        String(value || "").toLowerCase().includes(keyword)
      );

    return matchesStatus && matchesKeyword;
  });

  switch (sortSelect.value) {
    case "price_high":
      filtered.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
      break;
    case "price_low":
      filtered.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      break;
    case "stock_high":
      filtered.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
      break;
    default:
      filtered.sort((a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
  }

  return filtered;
}

function renderProducts() {
  const filtered = getFilteredProducts();

  resultCount.textContent = `${filtered.length} produk`;

  if (!filtered.length) {
    const hasFilters =
      searchInput.value.trim() ||
      activeStatus !== "all";

    productList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24"><path d="M6 8h12l1 12H5L6 8Z"></path><path d="M9 8a3 3 0 0 1 6 0"></path></svg>
        </span>
        <strong>${hasFilters ? "Tidak ada produk yang cocok" : "Belum ada produk"}</strong>
        <p>
          ${
            hasFilters
              ? "Coba ubah pencarian atau filter status."
              : "Mulai jual barang pertama Anda dan tampilkan di marketplace AdaAja."
          }
        </p>
        ${
          hasFilters
            ? '<button type="button" id="clearFilterButton">Hapus filter</button>'
            : '<a href="upload.html">Tambah produk</a>'
        }
      </div>
    `;

    document.getElementById("clearFilterButton")?.addEventListener("click", () => {
      searchInput.value = "";
      activeStatus = "all";
      statusTabs.querySelectorAll("button").forEach((button) => {
        button.classList.toggle("active", button.dataset.status === "all");
      });
      renderProducts();
    });

    return;
  }

  productList.innerHTML = filtered.map((product) => {
    const imageUrl = getPublicUrl(product.cover_path);
    const status = String(product.status || "").toLowerCase();
    const isSoldOut = Number(product.stock || 0) <= 0;

    const statusText =
      isSoldOut
        ? "Stok habis"
        : status === "active"
          ? "Aktif"
          : status === "draft"
            ? "Disembunyikan"
            : status === "reserved"
              ? "Dipesan"
              : status === "sold"
                ? "Terjual"
                : "Tidak aktif";

    const statusClass =
      isSoldOut
        ? "soldout"
        : status === "active"
          ? ""
          : "inactive";

    return `
      <article class="product-card">
        <a class="product-thumb" href="product-detail.html?id=${encodeURIComponent(product.id)}">
          ${
            imageUrl
              ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy">`
              : `<span class="product-thumb-placeholder">
                   <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"></rect><circle cx="9" cy="10" r="2"></circle><path d="m21 15-5-5L5 20"></path></svg>
                 </span>`
          }
          <span class="status-pill ${statusClass}">${statusText}</span>
        </a>

        <div class="product-copy">
          <h3>${escapeHtml(product.name || "Produk")}</h3>
          <div class="product-price-line">
            <strong class="product-price">${formatRupiah(product.price)}</strong>
            <span class="product-unit">/ ${escapeHtml(formatUnit(product.unit))}</span>
          </div>

          <div class="product-meta">
            <span class="accent">${escapeHtml(conditionLabel(product.condition))}</span>
            <span>Stok ${Number(product.stock || 0)} ${escapeHtml(formatUnit(product.unit))}</span>
            <span class="minimum-order-meta">Min. ${formatMinimumOrder(product.minimum_order)} ${escapeHtml(formatUnit(product.unit))}</span>
            <span>${escapeHtml(product.category_id || "Lainnya")}</span>
          </div>

          <small class="product-date">Dibuat ${escapeHtml(formatDate(product.created_at))}</small>
        </div>

        <button class="more-button" type="button" data-product-id="${escapeHtml(product.id)}" aria-label="Kelola produk">
          <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle></svg>
        </button>
      </article>
    `;
  }).join("");

  productList.querySelectorAll(".more-button").forEach((button) => {
    button.addEventListener("click", () => {
      openActionSheet(button.dataset.productId);
    });
  });
}

function openActionSheet(productId) {
  selectedProduct = products.find((product) => product.id === productId) || null;
  if (!selectedProduct) return;

  sheetProductName.textContent = selectedProduct.name || "Produk";

  const imageUrl = getPublicUrl(selectedProduct.cover_path);

  sheetThumb.innerHTML = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="">`
    : "";

  const currentStatus =
    String(selectedProduct.status || "").toLowerCase();

  const isActive = currentStatus === "active";
  const isDraft = currentStatus === "draft";

  if (isActive) {
    toggleActionTitle.textContent = "Nonaktifkan produk";
    toggleActionSubtitle.textContent = "Sembunyikan dari marketplace";
  } else if (isDraft) {
    toggleActionTitle.textContent = "Aktifkan produk";
    toggleActionSubtitle.textContent = "Tampilkan kembali di marketplace";
  } else if (currentStatus === "reserved") {
    toggleActionTitle.textContent = "Produk sedang dipesan";
    toggleActionSubtitle.textContent = "Status ini tidak dapat diubah manual";
  } else if (currentStatus === "sold") {
    toggleActionTitle.textContent = "Produk sudah terjual";
    toggleActionSubtitle.textContent = "Status ini tidak dapat diubah manual";
  } else {
    toggleActionTitle.textContent = "Kelola status";
    toggleActionSubtitle.textContent = "Status produk tidak dapat diubah manual";
  }

  actionSheet.classList.add("active");
  actionSheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("sheet-open");
}

function closeActionSheet() {
  actionSheet.classList.remove("active");
  actionSheet.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sheet-open");
  selectedProduct = null;
}

async function toggleSelectedProduct() {
  if (!selectedProduct) return;

  const oldStatus =
    String(selectedProduct.status || "").toLowerCase();

  if (!["active", "draft"].includes(oldStatus)) {
    showToast(
      oldStatus === "reserved"
        ? "Produk sedang dipesan dan tidak dapat dinonaktifkan."
        : oldStatus === "sold"
          ? "Produk sudah terjual dan statusnya tidak dapat diubah."
          : "Status produk ini tidak dapat diubah manual."
    );
    return;
  }

  const newStatus =
    oldStatus === "active"
      ? "draft"
      : "active";

  try {
    const { error } = await window.adaajaSupabase
      .from("products")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedProduct.id)
      .eq("seller_id", currentUser.id);

    if (error) throw error;

    selectedProduct.status = newStatus;

    closeActionSheet();
    updateStats();
    renderProducts();

    showToast(
      newStatus === "active"
        ? "Produk berhasil ditampilkan kembali."
        : "Produk berhasil disembunyikan dari marketplace."
    );
  } catch (error) {
    console.error("Gagal mengubah status:", error);
    showToast(error.message || "Status produk gagal diubah.");
  }
}

async function deleteSelectedProduct() {
  if (!selectedProduct) return;

  const confirmed = confirm(
    `Hapus "${selectedProduct.name}" secara permanen?`
  );

  if (!confirmed) return;

  const product = selectedProduct;

  try {
    if (product.all_image_paths.length) {
      const { error: storageError } =
        await window.adaajaSupabase.storage
          .from(BUCKET)
          .remove(product.all_image_paths);

      if (storageError) {
        console.warn("Sebagian file foto belum terhapus:", storageError);
      }
    }

    const { error: imageError } = await window.adaajaSupabase
      .from("product_images")
      .delete()
      .eq("product_id", product.id);

    if (imageError) throw imageError;

    const { error: productError } = await window.adaajaSupabase
      .from("products")
      .delete()
      .eq("id", product.id)
      .eq("seller_id", currentUser.id);

    if (productError) throw productError;

    products = products.filter((item) => item.id !== product.id);

    closeActionSheet();
    updateStats();
    renderProducts();
    showToast("Produk berhasil dihapus.");
  } catch (error) {
    console.error("Gagal menghapus produk:", error);
    showToast(error.message || "Produk gagal dihapus.");
  }
}

searchInput.addEventListener("input", renderProducts);
sortSelect.addEventListener("change", renderProducts);

statusTabs.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    activeStatus = button.dataset.status;

    statusTabs.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderProducts();
  });
});

document.getElementById("sheetBackdrop").addEventListener("click", closeActionSheet);
document.getElementById("sheetCancel").addEventListener("click", closeActionSheet);

document.getElementById("editAction").addEventListener("click", () => {
  if (!selectedProduct) return;

  location.href =
    "edit-product.html?id=" +
    encodeURIComponent(selectedProduct.id);
});

document.getElementById("toggleAction").addEventListener("click", toggleSelectedProduct);
document.getElementById("deleteAction").addEventListener("click", deleteSelectedProduct);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeActionSheet();
  }
});

window.adaajaSupabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session?.user) {
    location.replace("login.html");
  }
});

loadProducts();
