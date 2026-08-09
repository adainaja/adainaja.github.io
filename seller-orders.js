const BUCKET = "product-images";

const ordersList = document.getElementById("ordersList");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const statusTabs = document.getElementById("statusTabs");
const resultCount = document.getElementById("resultCount");
const refreshButton = document.getElementById("refreshButton");
const orderSheet = document.getElementById("orderSheet");
const orderSheetContent = document.getElementById("orderSheetContent");
const sheetTitle = document.getElementById("sheetTitle");
const toast = document.getElementById("toast");

let currentUser = null;
let orders = [];
let activeStatus = "all";
let selectedOrder = null;
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

function orderNo(id) {
  return `ADA-${String(id || "").replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

function statusInfo(value) {
  const status = String(value || "").toLowerCase();

  return {
    pending_payment: ["Belum Bayar", "status-pending"],
    paid: ["Pesanan Baru", "status-paid"],
    processing: ["Diproses", "status-processing"],
    shipped: ["Dikirim", "status-shipped"],
    delivered: ["Sudah Sampai", "status-delivered"],
    completed: ["Selesai", "status-completed"],
    cancelled: ["Dibatalkan", "status-cancelled"],
    refunded: ["Refund", "status-refunded"]
  }[status] || [status || "-", "status-pending"];
}

function normalizedStatus(value) {
  const status = String(value || "").toLowerCase();

  if (status === "paid") return "new";
  if (status === "delivered") return "shipped";
  if (status === "refunded") return "cancelled";

  return status;
}

function courierLabel(code) {
  const value = String(code || "").trim().toLowerCase();
  const labels = {
    jne: "JNE",
    jnt: "J&T Express",
    'j&t': "J&T Express",
    sicepat: "SiCepat",
    anteraja: "AnterAja",
    ninja: "Ninja Xpress",
    lion: "Lion Parcel",
    pos: "Pos Indonesia",
    tiki: "TIKI",
    wahana: "Wahana",
    grab: "GrabExpress",
    gosend: "GoSend"
  };
  return labels[value] || (value ? value.toUpperCase() : "-");
}

function shippingInfo(order) {
  const code = order.courier_code || order.shipment?.courier_code || "";
  const service = order.courier_service || order.shipment?.courier_service || "";
  const courier = order.shipment?.courier_name || courierLabel(code);
  const cost = Number(order.shipping_cost || order.shipment?.shipping_cost || 0);
  const trackingNumber =
    order.shipment?.tracking_number ||
    order.shipment?.waybill_id ||
    order.shipment?.courier_waybill_id ||
    order.shipment?.biteship_tracking_id ||
    order.tracking_number ||
    "";
  const shipmentStatus = String(order.shipment?.shipment_status || order.shipment?.status || "").toLowerCase();

  return { code, service, courier, cost, trackingNumber, shipmentStatus };
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
    localStorage.setItem("redirectAfterLogin", "seller-orders.html");
    location.replace("login.html");
    return null;
  }

  currentUser = user;
  return user;
}

function loading() {
  resultCount.textContent = "Memuat...";
  ordersList.innerHTML = `
    <article class="skeleton-card shimmer"></article>
    <article class="skeleton-card shimmer"></article>
    <article class="skeleton-card shimmer"></article>
  `;
}

function errorState(message) {
  ordersList.innerHTML = `
    <section class="empty-state">
      <span class="empty-icon">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 7v6M12 17h.01"></path>
        </svg>
      </span>
      <strong>Pesanan belum dapat dimuat</strong>
      <p>${esc(message || "Silakan coba kembali.")}</p>
      <button class="retry-button" id="retryButton" type="button">Muat ulang</button>
    </section>
  `;

  document.getElementById("retryButton")?.addEventListener("click", loadOrders);
}

async function loadOrders() {
  const user = await requireUser();
  if (!user) return;

  loading();

  try {
    const { data: rawOrders, error } = await window.adaajaSupabase
      .from("orders")
      .select(`
        id,
        buyer_id,
        seller_id,
        offer_id,
        address_id,
        status,
        payment_status,
        fulfillment_status,
        subtotal,
        shipping_cost,
        admin_fee,
        discount,
        total,
        buyer_note,
        courier_code,
        courier_service,
        tracking_number,
        paid_at,
        shipped_at,
        delivered_at,
        completed_at,
        cancelled_at,
        created_at,
        updated_at
      `)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = rawOrders || [];
    const orderIds = rows.map((order) => order.id);
    const buyerIds = [...new Set(rows.map((order) => order.buyer_id).filter(Boolean))];

    const [itemsRes, buyersRes, paymentsRes, shipmentsRes] = await Promise.all([
      orderIds.length
        ? window.adaajaSupabase
            .from("order_items")
            .select("*")
            .in("order_id", orderIds)
        : Promise.resolve({ data: [], error: null }),

      buyerIds.length
        ? window.adaajaSupabase
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", buyerIds)
        : Promise.resolve({ data: [], error: null }),

      orderIds.length
        ? window.adaajaSupabase
            .from("payments")
            .select("order_id, transaction_status, payment_method, gross_amount, paid_at")
            .in("order_id", orderIds)
        : Promise.resolve({ data: [], error: null }),

      orderIds.length
        ? window.adaajaSupabase
            .from("shipments")
            .select(`
              id,
              order_id,
              courier_code,
              courier_name,
              courier_service,
              tracking_number,
              shipping_cost,
              status,
              shipment_status,
              provider_status,
              provider_order_id,
              biteship_order_id,
              biteship_tracking_id,
              waybill_id,
              courier_waybill_id,
              estimated_delivery_at,
              picked_up_at,
              delivered_at,
              created_at,
              updated_at
            `)
            .in("order_id", orderIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    [itemsRes, buyersRes, paymentsRes, shipmentsRes].forEach((result) => {
      if (result.error) {
        console.warn(result.error);
      }
    });

    const items = itemsRes.data || [];
    const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))];

    const productsRes = productIds.length
      ? await window.adaajaSupabase
          .from("products")
          .select(`
            id,
            name,
            condition,
            unit,
            product_images (
              storage_path,
              sort_order,
              is_cover
            )
          `)
          .in("id", productIds)
      : { data: [], error: null };

    if (productsRes.error) {
      console.warn(productsRes.error);
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

    const itemMap = new Map();

    items.forEach((item) => {
      if (!itemMap.has(item.order_id)) {
        itemMap.set(item.order_id, []);
      }

      itemMap.get(item.order_id).push({
        ...item,
        product: productMap.get(item.product_id) || null
      });
    });

    const buyerMap = new Map(
      (buyersRes.data || []).map((profile) => [
        profile.id,
        {
          name:
            profile.username ||
            profile.full_name ||
            "Pembeli AdaAja",
          avatar_url: profile.avatar_url || ""
        }
      ])
    );

    const paymentMap = new Map(
      (paymentsRes.data || []).map((payment) => [
        payment.order_id,
        payment
      ])
    );

    const shipmentMap = new Map(
      (shipmentsRes.data || []).map((shipment) => [
        shipment.order_id,
        shipment
      ])
    );

    orders = rows.map((order) => ({
      ...order,
      items: itemMap.get(order.id) || [],
      buyer: buyerMap.get(order.buyer_id) || {
        name: "Pembeli AdaAja",
        avatar_url: ""
      },
      payment: paymentMap.get(order.id) || null,
      shipment: shipmentMap.get(order.id) || null
    }));

    updateStats();
    renderOrders();
    subscribeRealtime();
  } catch (error) {
    console.error("Gagal memuat pesanan masuk:", error);
    errorState(error.message || "Pesanan masuk gagal dimuat.");
  }
}

function updateStats() {
  const needProcess = orders.filter((order) =>
    ["paid", "processing"].includes(String(order.status || "").toLowerCase())
  ).length;

  const shipped = orders.filter((order) =>
    ["shipped", "delivered"].includes(String(order.status || "").toLowerCase())
  ).length;

  const completed = orders.filter(
    (order) => String(order.status || "").toLowerCase() === "completed"
  ).length;

  document.getElementById("needProcessCount").textContent = needProcess;
  document.getElementById("shippedCount").textContent = shipped;
  document.getElementById("completedCount").textContent = completed;
}

function filteredOrders() {
  const keyword = searchInput.value.trim().toLowerCase();

  let data = orders.filter((order) => {
    const statusMatch =
      activeStatus === "all" ||
      normalizedStatus(order.status) === activeStatus;

    const productText = order.items
      .map((item) => item.product_name || item.product?.name || "")
      .join(" ");

    const searchMatch =
      !keyword ||
      [
        order.id,
        orderNo(order.id),
        order.buyer?.name,
        productText,
        order.shipment?.tracking_number,
        order.tracking_number
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

    case "total_high":
      data.sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
      break;

    case "total_low":
      data.sort((a, b) => Number(a.total || 0) - Number(b.total || 0));
      break;

    default:
      data.sort((a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
  }

  return data;
}

function renderOrderCard(order) {
  const [statusLabel, statusClass] = statusInfo(order.status);
  const firstItem = order.items[0] || {};
  const product = firstItem.product || {};
  const productName =
    firstItem.product_name ||
    product.name ||
    "Produk";
  const unit =
    firstItem.unit ||
    product.unit ||
    "pcs";
  const quantity = Number(firstItem.quantity || 1);
  const imageUrl = publicUrl(product.cover_path || "");

  const shipping = shippingInfo(order);
  const trackingNumber = shipping.trackingNumber;

  const imageHtml = imageUrl
    ? `<img src="${esc(imageUrl)}" alt="${esc(productName)}" loading="lazy">`
    : '<div class="order-thumb-placeholder">Foto tidak tersedia</div>';

  const actions = [];

  actions.push(`
    <button class="secondary detail-button" type="button" data-order-id="${esc(order.id)}">
      Lihat Detail
    </button>
  `);

  if (String(order.status || "").toLowerCase() === "paid") {
    actions.push(`
      <button class="primary process-button" type="button" data-order-id="${esc(order.id)}">
        Proses Pesanan
      </button>
    `);
  } else if (String(order.status || "").toLowerCase() === "processing") {
    actions.push(`
      <button class="primary shipping-button" type="button" data-order-id="${esc(order.id)}">
        Siapkan Pengiriman
      </button>
    `);
  } else if (
    ["shipped", "delivered"].includes(
      String(order.status || "").toLowerCase()
    )
  ) {
    actions.push(`
      <button class="success detail-button" type="button" data-order-id="${esc(order.id)}">
        Lihat Pengiriman
      </button>
    `);
  }

  return `
    <article class="order-card">
      <div class="order-head">
        <div>
          <strong class="order-number">${esc(orderNo(order.id))}</strong>
          <span class="order-date">${esc(date(order.created_at))}</span>
        </div>

        <span class="status-badge ${statusClass}">
          ${esc(statusLabel)}
        </span>
      </div>

      <div class="order-product">
        <div class="order-thumb">${imageHtml}</div>

        <div class="order-product-copy">
          <h3>${esc(productName)}</h3>
          <div class="buyer-name">Pembeli: ${esc(order.buyer?.name || "Pembeli AdaAja")}</div>

          <div class="item-meta">
            <span class="accent">${quantity} ${esc(unit)}</span>

            ${
              order.items.length > 1
                ? `<span>+${order.items.length - 1} produk lain</span>`
                : ""
            }

            ${
              trackingNumber
                ? `<span>Resi ${esc(trackingNumber)}</span>`
                : ""
            }
          </div>
        </div>
      </div>

      <div class="shipping-summary">
        <div class="shipping-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M3 7h11v10H3z"></path>
            <path d="M14 10h4l3 3v4h-7z"></path>
            <circle cx="7" cy="18" r="2"></circle>
            <circle cx="18" cy="18" r="2"></circle>
          </svg>
        </div>
        <div class="shipping-copy">
          <span>PENGIRIMAN PILIHAN PEMBELI</span>
          <strong>${esc(shipping.courier)}${shipping.service ? ` • ${esc(String(shipping.service).toUpperCase())}` : ""}</strong>
          <small>${shipping.cost ? `Ongkir ${money(shipping.cost)}` : "Ongkir tersimpan pada transaksi"}${trackingNumber ? ` • Resi ${esc(trackingNumber)}` : ""}</small>
        </div>
        <span class="shipping-lock">Terkunci</span>
      </div>

      <div class="order-summary">
        <div>
          <span>Status pembayaran</span>
          <strong>${esc(order.payment?.transaction_status || "Belum tersedia")}</strong>
        </div>

        <div class="total">
          <span>Total transaksi</span>
          <strong>${money(order.total)}</strong>
        </div>
      </div>

      <div class="order-actions">
        ${actions.join("")}
      </div>
    </article>
  `;
}

function renderOrders() {
  const data = filteredOrders();

  resultCount.textContent = `${data.length} pesanan`;

  if (!data.length) {
    const hasFilter =
      activeStatus !== "all" ||
      searchInput.value.trim();

    ordersList.innerHTML = `
      <section class="empty-state">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24">
            <path d="M6 3h12l2 5-8 4-8-4 2-5Z"></path>
            <path d="M4 8v10l8 3 8-3V8"></path>
          </svg>
        </span>

        <strong>${hasFilter ? "Tidak ada pesanan yang cocok" : "Belum ada pesanan masuk"}</strong>

        <p>
          ${
            hasFilter
              ? "Coba ubah pencarian atau pilih status lain."
              : "Saat produk Anda dibeli, pesanan akan muncul dan bisa dikelola dari halaman ini."
          }
        </p>

        ${
          hasFilter
            ? '<button class="retry-button" type="button" id="clearFilterButton">Hapus Filter</button>'
            : '<a href="my-products.html">Lihat Produk Saya</a>'
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

      renderOrders();
    });

    return;
  }

  ordersList.innerHTML = data.map(renderOrderCard).join("");

  ordersList.querySelectorAll(".detail-button").forEach((button) => {
    button.addEventListener("click", () => {
      openOrderSheet(button.dataset.orderId);
    });
  });

  ordersList.querySelectorAll(".process-button").forEach((button) => {
    button.addEventListener("click", () => {
      markProcessing(button.dataset.orderId);
    });
  });

  ordersList.querySelectorAll(".shipping-button").forEach((button) => {
    button.addEventListener("click", () => {
      openOrderSheet(button.dataset.orderId);
    });
  });
}

function openOrderSheet(orderId) {
  selectedOrder = orders.find((order) => order.id === orderId) || null;
  if (!selectedOrder) return;

  sheetTitle.textContent = orderNo(selectedOrder.id);

  const [statusLabel] = statusInfo(selectedOrder.status);
  const shipment = selectedOrder.shipment;
  const shipping = shippingInfo(selectedOrder);
  const buyer = selectedOrder.buyer || {};
  const firstItem = selectedOrder.items[0] || {};

  orderSheetContent.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card">
        <span>STATUS</span>
        <strong>${esc(statusLabel)}</strong>
        <p>Dibuat ${esc(date(selectedOrder.created_at))}</p>
      </div>

      <div class="detail-card">
        <span>PEMBELI</span>
        <strong>${esc(buyer.name || "Pembeli AdaAja")}</strong>
        <p>${selectedOrder.buyer_note ? `Catatan: ${esc(selectedOrder.buyer_note)}` : "Tidak ada catatan pembeli."}</p>
      </div>

      <div class="detail-card">
        <span>PRODUK</span>
        <strong>${esc(firstItem.product_name || firstItem.product?.name || "Produk")}</strong>
        <p>${Number(firstItem.quantity || 1)} ${esc(firstItem.unit || firstItem.product?.unit || "pcs")} · ${money(firstItem.subtotal || firstItem.unit_price)}</p>
      </div>

      <div class="detail-card">
        <span>PEMBAYARAN</span>
        <strong>${esc(selectedOrder.payment?.transaction_status || "Belum tersedia")}</strong>
        <p>Total ${money(selectedOrder.total)}</p>
      </div>

      <div class="detail-card shipping-detail-card">
        <span>PENGIRIMAN PILIHAN PEMBELI</span>
        <strong>${esc(shipping.courier)}${shipping.service ? ` • ${esc(String(shipping.service).toUpperCase())}` : ""}</strong>
        <p>${shipping.cost ? `Ongkir ${money(shipping.cost)}.` : "Ongkir tersimpan pada transaksi."} ${shipping.trackingNumber ? `Resi ${esc(shipping.trackingNumber)}.` : "Nomor resi belum tersedia."}</p>
        <div class="locked-note">Kurir sudah dipilih saat checkout dan tidak perlu dipilih ulang oleh penjual.</div>
      </div>
    </div>

    <div class="sheet-actions">
      <button class="secondary" type="button" id="sheetCloseAction">Tutup</button>
      ${
        String(selectedOrder.status || "").toLowerCase() === "paid"
          ? '<button class="primary" type="button" id="sheetProcessAction">Proses Pesanan</button>'
          : String(selectedOrder.status || "").toLowerCase() === "processing"
            ? '<button class="primary" type="button" id="sheetShippingAction">Siapkan Pengiriman</button>'
            : ""
      }
    </div>
  `;

  orderSheet.classList.add("active");
  orderSheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("sheet-open");

  document.getElementById("sheetCloseAction")?.addEventListener("click", closeOrderSheet);

  document.getElementById("sheetProcessAction")?.addEventListener("click", async () => {
    await markProcessing(selectedOrder.id);
    closeOrderSheet();
  });

  document.getElementById("sheetShippingAction")?.addEventListener("click", async () => {
    const info = shippingInfo(selectedOrder);
    const button = document.getElementById("sheetShippingAction");

    if (!info.code || !info.service) {
      showToast("Data kurir pesanan belum lengkap. Periksa data checkout sebelum melanjutkan.");
      return;
    }

    if (!selectedOrder.shipment?.id) {
      showToast(`Pengiriman ${info.courier} ${String(info.service).toUpperCase()} sudah dipilih pembeli, tetapi shipment internal belum tersedia.`);
      return;
    }

    if (info.trackingNumber) {
      showToast(`Resi ${info.courier}: ${info.trackingNumber}`);
      return;
    }

    if (button?.disabled) return;
    const originalText = button?.textContent || "Siapkan Pengiriman";

    try {
      if (button) {
        button.disabled = true;
        button.textContent = "Membuat booking...";
      }

      showToast("Menghubungkan pesanan ke Biteship...");

      const { data, error } = await window.adaajaSupabase.functions.invoke(
        "create-biteship-order",
        { body: { order_id: selectedOrder.id } }
      );

      if (error) {
        let detail = error.message || "Edge Function gagal dipanggil.";
        try {
          if (error.context && typeof error.context.json === "function") {
            const payload = await error.context.json();
            detail = payload?.error || payload?.message || detail;
          }
        } catch (_) {}
        throw new Error(detail);
      }

      if (!data?.success) {
        throw new Error(data?.error || data?.message || "Booking Biteship belum berhasil.");
      }

      const tracking =
        data?.tracking_number ||
        data?.shipment?.tracking_number ||
        data?.shipment?.waybill_id ||
        data?.shipment?.tracking_id ||
        "";

      if (data?.already_booked) {
        showToast(
          tracking
            ? `Pengiriman sudah dibuat. Resi: ${tracking}`
            : "Pengiriman sudah pernah dibuat di Biteship."
        );
      } else {
        showToast(
          tracking
            ? `Booking Biteship berhasil. Resi: ${tracking}`
            : "Booking Biteship berhasil dibuat."
        );
      }

      closeOrderSheet();
      await loadOrders();
    } catch (error) {
      console.error("Gagal membuat booking Biteship:", error);
      showToast(error.message || "Booking Biteship gagal dibuat.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });
}

function closeOrderSheet() {
  orderSheet.classList.remove("active");
  orderSheet.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sheet-open");
  selectedOrder = null;
}

async function markProcessing(orderId) {
  if (!currentUser) return;

  try {
    const { error } = await window.adaajaSupabase
      .from("orders")
      .update({
        status: "processing",
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)
      .eq("seller_id", currentUser.id)
      .eq("status", "paid");

    if (error) throw error;

    showToast("Pesanan mulai diproses.");
    await loadOrders();
  } catch (error) {
    console.error("Gagal memproses pesanan:", error);
    showToast(error.message || "Status pesanan gagal diubah.");
  }
}

function subscribeRealtime() {
  if (!currentUser) return;

  if (realtimeChannel) {
    window.adaajaSupabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = window.adaajaSupabase
    .channel(`seller-orders-${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `seller_id=eq.${currentUser.id}`
      },
      () => loadOrders()
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "shipments",
        filter: `seller_id=eq.${currentUser.id}`
      },
      () => loadOrders()
    )
    .subscribe();
}

searchInput.addEventListener("input", renderOrders);
sortSelect.addEventListener("change", renderOrders);

statusTabs.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    activeStatus = button.dataset.status;

    statusTabs.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderOrders();
  });
});

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  await loadOrders();
  refreshButton.disabled = false;
  showToast("Pesanan diperbarui.");
});

document.getElementById("orderSheetBackdrop").addEventListener("click", closeOrderSheet);
document.getElementById("closeOrderSheet").addEventListener("click", closeOrderSheet);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeOrderSheet();
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

loadOrders();
