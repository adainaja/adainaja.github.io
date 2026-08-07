const BUCKET = "product-images";

const offersList = document.getElementById("offersList");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const statusTabs = document.getElementById("statusTabs");
const resultCount = document.getElementById("resultCount");
const refreshButton = document.getElementById("refreshButton");
const offerSheet = document.getElementById("offerSheet");
const offerSheetContent = document.getElementById("offerSheetContent");
const sheetTitle = document.getElementById("sheetTitle");
const toast = document.getElementById("toast");

let currentUser = null;
let offers = [];
let activeStatus = "all";
let selectedOffer = null;
let realtimeChannel = null;
let toastTimer = null;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function date(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function offerNo(id) {
  return `NEG-${String(id || "").replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

function statusInfo(value) {
  const status = String(value || "").toLowerCase();

  return {
    pending: ["Menunggu", "status-pending"],
    countered: ["Harga Balasan", "status-countered"],
    accepted: ["Disetujui", "status-accepted"],
    rejected: ["Ditolak", "status-rejected"],
    expired: ["Kedaluwarsa", "status-ended"],
    cancelled: ["Dibatalkan", "status-ended"]
  }[status] || [status || "-", "status-pending"];
}

function statusGroup(value) {
  const status = String(value || "").toLowerCase();

  if (["expired", "cancelled"].includes(status)) {
    return "ended";
  }

  return status;
}

function publicUrl(path) {
  if (!path) return "";

  const { data } = window.adaajaSupabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

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
    localStorage.setItem("redirectAfterLogin", "my-offers.html");
    location.replace("login.html");
    return null;
  }

  currentUser = user;
  return user;
}

function loading() {
  resultCount.textContent = "Memuat...";
  offersList.innerHTML = `
    <article class="skeleton-card shimmer"></article>
    <article class="skeleton-card shimmer"></article>
    <article class="skeleton-card shimmer"></article>
  `;
}

function errorState(message) {
  offersList.innerHTML = `
    <section class="empty-state">
      <span class="empty-icon">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 7v6M12 17h.01"></path>
        </svg>
      </span>

      <strong>Negosiasi belum dapat dimuat</strong>
      <p>${esc(message || "Silakan coba kembali.")}</p>

      <button class="retry-button" id="retryButton" type="button">
        Muat ulang
      </button>
    </section>
  `;

  document.getElementById("retryButton")?.addEventListener("click", loadOffers);
}

async function loadOffers() {
  const user = await requireUser();
  if (!user) return;

  loading();

  try {
    const { data: rawOffers, error } = await window.adaajaSupabase
      .from("offers")
      .select(`
        id,
        product_id,
        buyer_id,
        seller_id,
        original_price,
        offered_price,
        counter_price,
        status,
        expires_at,
        created_at,
        updated_at
      `)
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = rawOffers || [];
    const productIds = [...new Set(rows.map((offer) => offer.product_id).filter(Boolean))];
    const sellerIds = [...new Set(rows.map((offer) => offer.seller_id).filter(Boolean))];

    const [productsRes, sellersRes] = await Promise.all([
      productIds.length
        ? window.adaajaSupabase
            .from("products")
            .select(`
              id,
              name,
              price,
              unit,
              minimum_order,
              status,
              product_images (
                storage_path,
                sort_order,
                is_cover
              )
            `)
            .in("id", productIds)
        : Promise.resolve({ data: [], error: null }),

      sellerIds.length
        ? window.adaajaSupabase
            .from("profiles")
            .select("id, username, full_name")
            .in("id", sellerIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (productsRes.error) {
      console.warn(productsRes.error);
    }

    if (sellersRes.error) {
      console.warn(sellersRes.error);
    }

    const productMap = new Map();

    (productsRes.data || []).forEach((product) => {
      const images = Array.isArray(product.product_images)
        ? [...product.product_images]
        : [];

      images.sort(
        (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
      );

      const cover =
        images.find((image) => image.is_cover) ||
        images[0] ||
        null;

      productMap.set(product.id, {
        ...product,
        cover_path: cover?.storage_path || ""
      });
    });

    const sellerMap = new Map(
      (sellersRes.data || []).map((seller) => [
        seller.id,
        seller.username ||
        seller.full_name ||
        "Penjual AdaAja"
      ])
    );

    offers = rows.map((offer) => ({
      ...offer,
      product: productMap.get(offer.product_id) || null,
      seller_name:
        sellerMap.get(offer.seller_id) ||
        "Penjual AdaAja"
    }));

    updateStats();
    renderOffers();
    subscribeRealtime();
  } catch (error) {
    console.error("Gagal memuat negosiasi:", error);
    errorState(error.message || "Negosiasi gagal dimuat.");
  }
}

function updateStats() {
  document.getElementById("pendingCount").textContent =
    offers.filter((offer) =>
      String(offer.status || "").toLowerCase() === "pending"
    ).length;

  document.getElementById("counteredCount").textContent =
    offers.filter((offer) =>
      String(offer.status || "").toLowerCase() === "countered"
    ).length;

  document.getElementById("acceptedCount").textContent =
    offers.filter((offer) =>
      String(offer.status || "").toLowerCase() === "accepted"
    ).length;
}

function filteredOffers() {
  const keyword = searchInput.value.trim().toLowerCase();

  let data = offers.filter((offer) => {
    const group = statusGroup(offer.status);

    const statusMatch =
      activeStatus === "all" ||
      group === activeStatus;

    const searchMatch =
      !keyword ||
      [
        offer.product?.name,
        offer.seller_name,
        offerNo(offer.id)
      ].some((value) =>
        String(value || "").toLowerCase().includes(keyword)
      );

    return statusMatch && searchMatch;
  });

  switch (sortSelect.value) {
    case "oldest":
      data.sort((a, b) =>
        new Date(a.created_at || 0).getTime() -
        new Date(b.created_at || 0).getTime()
      );
      break;

    case "offer_high":
      data.sort((a, b) =>
        Number(b.offered_price || 0) -
        Number(a.offered_price || 0)
      );
      break;

    case "offer_low":
      data.sort((a, b) =>
        Number(a.offered_price || 0) -
        Number(b.offered_price || 0)
      );
      break;

    default:
      data.sort((a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
  }

  return data;
}

function noteForStatus(status) {
  const s = String(status || "").toLowerCase();

  return {
    pending: [
      "pending",
      "Harga Anda sedang menunggu keputusan penjual."
    ],
    countered: [
      "countered",
      "Penjual mengirim harga balasan. Tinjau sebelum melanjutkan."
    ],
    accepted: [
      "accepted",
      "Harga disetujui. Anda dapat melanjutkan ke proses pembelian."
    ],
    rejected: [
      "rejected",
      "Harga Anda tidak disetujui penjual."
    ],
    expired: [
      "ended",
      "Masa berlaku negosiasi ini sudah berakhir."
    ],
    cancelled: [
      "ended",
      "Negosiasi ini telah dibatalkan."
    ]
  }[s] || ["pending", "Status negosiasi diperbarui."];
}

function renderOfferCard(offer) {
  const [statusLabel, statusClass] = statusInfo(offer.status);
  const [noteClass, noteText] = noteForStatus(offer.status);

  const product = offer.product || {};
  const productName = product.name || "Produk";
  const imageUrl = publicUrl(product.cover_path || "");

  const imageHtml = imageUrl
    ? `<img src="${esc(imageUrl)}" alt="${esc(productName)}" loading="lazy">`
    : '<div class="offer-thumb-placeholder">Foto tidak tersedia</div>';

  const priceBoxes = [
    `
      <div class="price-box">
        <span>Harga produk</span>
        <strong>${money(offer.original_price || product.price)}</strong>
      </div>
    `,
    `
      <div class="price-box accent">
        <span>Harga Anda</span>
        <strong>${money(offer.offered_price)}</strong>
      </div>
    `
  ];

  if (
    String(offer.status || "").toLowerCase() === "countered" &&
    Number(offer.counter_price || 0) > 0
  ) {
    priceBoxes.push(`
      <div class="price-box counter">
        <span>Harga balasan</span>
        <strong>${money(offer.counter_price)}</strong>
      </div>
    `);
  }

  const actions = [];

  actions.push(`
    <button class="secondary detail-button" type="button" data-offer-id="${esc(offer.id)}">
      Lihat Detail
    </button>
  `);

  const status = String(offer.status || "").toLowerCase();

  if (status === "countered") {
    actions.push(`
      <a class="blue" href="product-detail.html?id=${encodeURIComponent(offer.product_id)}">
        Tinjau Balasan
      </a>
    `);
  } else if (status === "accepted") {
    actions.push(`
      <a class="primary" href="checkout.html?offer_id=${encodeURIComponent(offer.id)}">
        Lanjut Pembelian
      </a>
    `);
  } else if (["rejected", "expired", "cancelled"].includes(status)) {
    actions.push(`
      <a class="primary" href="product-detail.html?id=${encodeURIComponent(offer.product_id)}">
        Ajukan Lagi
      </a>
    `);
  } else {
    actions.push(`
      <a class="secondary" href="product-detail.html?id=${encodeURIComponent(offer.product_id)}">
        Lihat Produk
      </a>
    `);
  }

  return `
    <article class="offer-card">
      <div class="offer-head">
        <div>
          <strong class="offer-id">${esc(offerNo(offer.id))}</strong>
          <span class="offer-date">${esc(date(offer.created_at))}</span>
        </div>

        <span class="status-badge ${statusClass}">
          ${esc(statusLabel)}
        </span>
      </div>

      <div class="offer-product">
        <div class="offer-thumb">
          ${imageHtml}
        </div>

        <div class="offer-copy">
          <h3>${esc(productName)}</h3>
          <div class="seller-name">
            Penjual: ${esc(offer.seller_name)}
          </div>

          <div class="price-grid">
            ${priceBoxes.join("")}
          </div>
        </div>
      </div>

      <div class="offer-note ${noteClass}">
        ${esc(noteText)}
      </div>

      <div class="offer-actions">
        ${actions.join("")}
      </div>
    </article>
  `;
}

function renderOffers() {
  const data = filteredOffers();

  resultCount.textContent = `${data.length} negosiasi`;

  if (!data.length) {
    const hasFilter =
      activeStatus !== "all" ||
      searchInput.value.trim();

    offersList.innerHTML = `
      <section class="empty-state">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24">
            <path d="M4 7h16v10H4z"></path>
            <path d="M8 11h8"></path>
            <path d="M8 14h5"></path>
          </svg>
        </span>

        <strong>${hasFilter ? "Tidak ada negosiasi yang cocok" : "Belum ada negosiasi"}</strong>

        <p>
          ${
            hasFilter
              ? "Coba ubah pencarian atau pilih status lain."
              : "Saat Anda mengajukan harga kepada penjual, prosesnya akan tampil di halaman ini."
          }
        </p>

        ${
          hasFilter
            ? '<button class="retry-button" type="button" id="clearFilterButton">Hapus Filter</button>'
            : '<a href="explore.html">Cari Produk</a>'
        }
      </section>
    `;

    document.getElementById("clearFilterButton")?.addEventListener("click", () => {
      activeStatus = "all";
      searchInput.value = "";

      statusTabs.querySelectorAll("button").forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.status === "all"
        );
      });

      renderOffers();
    });

    return;
  }

  offersList.innerHTML = data.map(renderOfferCard).join("");

  offersList.querySelectorAll(".detail-button").forEach((button) => {
    button.addEventListener("click", () => {
      openOfferSheet(button.dataset.offerId);
    });
  });
}

function openOfferSheet(offerId) {
  selectedOffer =
    offers.find((offer) => offer.id === offerId) ||
    null;

  if (!selectedOffer) return;

  const [statusLabel] = statusInfo(selectedOffer.status);
  const product = selectedOffer.product || {};

  sheetTitle.textContent = offerNo(selectedOffer.id);

  offerSheetContent.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card">
        <span>STATUS</span>
        <strong>${esc(statusLabel)}</strong>
        <p>Dibuat ${esc(date(selectedOffer.created_at))}</p>
      </div>

      <div class="detail-card">
        <span>PRODUK</span>
        <strong>${esc(product.name || "Produk")}</strong>
        <p>${product.unit ? `Satuan: ${esc(product.unit)}` : "Satuan belum tersedia."}</p>
      </div>

      <div class="detail-card">
        <span>PENJUAL</span>
        <strong>${esc(selectedOffer.seller_name)}</strong>
        <p>Negosiasi langsung dengan penjual produk ini.</p>
      </div>

      <div class="detail-card">
        <span>HARGA PRODUK</span>
        <strong>${money(selectedOffer.original_price || product.price)}</strong>
      </div>

      <div class="detail-card">
        <span>HARGA ANDA</span>
        <strong>${money(selectedOffer.offered_price)}</strong>
      </div>

      ${
        Number(selectedOffer.counter_price || 0) > 0
          ? `
            <div class="detail-card">
              <span>HARGA BALASAN</span>
              <strong>${money(selectedOffer.counter_price)}</strong>
            </div>
          `
          : ""
      }

      ${
        selectedOffer.expires_at
          ? `
            <div class="detail-card">
              <span>BERLAKU SAMPAI</span>
              <strong>${esc(date(selectedOffer.expires_at))}</strong>
            </div>
          `
          : ""
      }
    </div>

    <div class="sheet-actions">
      <button class="secondary" id="sheetCloseAction" type="button">
        Tutup
      </button>

      ${
        String(selectedOffer.status || "").toLowerCase() === "accepted"
          ? `
            <a class="primary" href="checkout.html?offer_id=${encodeURIComponent(selectedOffer.id)}">
              Lanjut Pembelian
            </a>
          `
          : String(selectedOffer.status || "").toLowerCase() === "countered"
            ? `
              <a class="blue" href="product-detail.html?id=${encodeURIComponent(selectedOffer.product_id)}">
                Tinjau Balasan
              </a>
            `
            : `
              <a class="primary" href="product-detail.html?id=${encodeURIComponent(selectedOffer.product_id)}">
                Lihat Produk
              </a>
            `
      }
    </div>
  `;

  offerSheet.classList.add("active");
  offerSheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("sheet-open");

  document.getElementById("sheetCloseAction")?.addEventListener("click", closeOfferSheet);
}

function closeOfferSheet() {
  offerSheet.classList.remove("active");
  offerSheet.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sheet-open");
  selectedOffer = null;
}

function subscribeRealtime() {
  if (!currentUser) return;

  if (realtimeChannel) {
    window.adaajaSupabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = window.adaajaSupabase
    .channel(`buyer-offers-${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "offers",
        filter: `buyer_id=eq.${currentUser.id}`
      },
      () => loadOffers()
    )
    .subscribe();
}

searchInput.addEventListener("input", renderOffers);
sortSelect.addEventListener("change", renderOffers);

statusTabs.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    activeStatus = button.dataset.status;

    statusTabs.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderOffers();
  });
});

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  await loadOffers();
  refreshButton.disabled = false;
  showToast("Negosiasi diperbarui.");
});

document.getElementById("offerSheetBackdrop").addEventListener("click", closeOfferSheet);
document.getElementById("closeOfferSheet").addEventListener("click", closeOfferSheet);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeOfferSheet();
  }
});

window.adaajaSupabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session?.user) {
    location.replace("login.html");
  }
});

window.addEventListener("beforeunload", () => {
  if (realtimeChannel) {
    window.adaajaSupabase.removeChannel(realtimeChannel);
  }
});

loadOffers();
