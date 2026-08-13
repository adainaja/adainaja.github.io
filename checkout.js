// AdaAja Checkout — Midtrans verification legal disclosure revision 2026-08-14
const params = new URLSearchParams(location.search);
const productIdFromUrl = params.get("product_id") || params.get("id");
const offerId = params.get("offer_id");

const addressCard = document.getElementById("addressCard");
const productCard = document.getElementById("productCard");
const quantityInput = document.getElementById("quantityInput");
const minimumOrderText = document.getElementById("minimumOrderText");
const shippingState = document.getElementById("shippingState");
const shippingList = document.getElementById("shippingList");
const paymentMethods = document.getElementById("paymentMethods");
const shippingPickerButton = document.getElementById("shippingPickerButton");
const shippingPickerLogo = document.getElementById("shippingPickerLogo");
const shippingPickerEyebrow = document.getElementById("shippingPickerEyebrow");
const shippingPickerTitle = document.getElementById("shippingPickerTitle");
const shippingPickerMeta = document.getElementById("shippingPickerMeta");
const shippingPickerPrice = document.getElementById("shippingPickerPrice");
const shippingSheetBackdrop = document.getElementById("shippingSheetBackdrop");
const shippingSheetList = document.getElementById("shippingSheetList");
const buyerNote = document.getElementById("buyerNote");
const payButton = document.getElementById("payButton");
const toast = document.getElementById("toast");
const checkoutError = document.getElementById("checkoutError");
const checkoutErrorText = document.getElementById("checkoutErrorText");

let currentUser = null;
let offer = null;
let product = null;
let address = null;
let settings = null;

let shippingOptions = [];
let selectedShipping = null;
let paymentMethodCode = "default_estimate";

let currentQuote = null;
let quoteTimer = null;
let toastTimer = null;
let quoteVersion = 0;

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const money = (value) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
}).format(Number(value || 0));

function publicUrl(path) {
  if (!path) return "";
  return window.adaajaSupabase
    .storage
    .from("product-images")
    .getPublicUrl(path)
    .data?.publicUrl || "";
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function showError(message) {
  checkoutError.hidden = false;
  checkoutErrorText.textContent = message;
}

function clearError() {
  checkoutError.hidden = true;
  checkoutErrorText.textContent = "";
}

async function requireUser() {
  const user = await window.AdaAjaAuth.getCurrentUser();

  if (!user) {
    localStorage.setItem(
      "redirectAfterLogin",
      location.pathname.split("/").pop() + location.search
    );
    location.replace("login.html");
    return null;
  }

  currentUser = user;
  return user;
}

function courierBadgeText(rate) {
  const code = String(rate?.courier_code || "").toLowerCase();
  const name = String(rate?.courier_company || "").trim();

  const aliases = {
    jne: "JNE",
    jnt: "J&T",
    "j&t": "J&T",
    sicepat: "SiCepat",
    anteraja: "AnterAja",
    ninja: "Ninja",
    tiki: "TIKI",
    pos: "POS",
    grab: "Grab",
    gojek: "GoSend",
    gosend: "GoSend",
    lalamove: "Lalamove",
    paxel: "Paxel",
    lion: "Lion",
    lionparcel: "Lion"
  };

  return aliases[code] || name || code.toUpperCase().slice(0, 8) || "Kurir";
}

function shippingEta(rate) {
  return rate.estimated_text ||
    (
      rate.estimated_min_days != null
        ? `${rate.estimated_min_days}${rate.estimated_max_days && rate.estimated_max_days !== rate.estimated_min_days ? `–${rate.estimated_max_days}` : ""} hari`
        : "Estimasi mengikuti kurir"
    );
}

function renderSelectedShipping() {
  if (!selectedShipping) {
    shippingPickerButton.classList.remove("has-selection");
    shippingPickerLogo.textContent = "—";
    shippingPickerLogo.removeAttribute("data-courier");
    shippingPickerEyebrow.textContent = "PILIH PENGIRIMAN";
    shippingPickerTitle.textContent = "Belum ada ekspedisi dipilih";
    shippingPickerMeta.textContent = shippingOptions.length
      ? `${shippingOptions.length} layanan tersedia`
      : "Tarif dan estimasi akan tampil di sini.";
    shippingPickerPrice.textContent = shippingOptions.length ? "Pilih" : "—";
    return;
  }

  shippingPickerButton.classList.add("has-selection");
  shippingPickerLogo.textContent = courierBadgeText(selectedShipping);
  shippingPickerLogo.dataset.courier = String(selectedShipping.courier_code || "").toLowerCase();
  shippingPickerEyebrow.textContent = "PENGIRIMAN TERPILIH";
  shippingPickerTitle.textContent =
    `${selectedShipping.courier_company} · ${selectedShipping.service_name}`;
  shippingPickerMeta.textContent = shippingEta(selectedShipping);
  shippingPickerPrice.textContent = money(
    selectedShipping.customer_price ?? selectedShipping.base_cost ?? 0
  );
}

function openShippingSheet() {
  if (!shippingOptions.length) return;
  shippingSheetBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeShippingSheet() {
  shippingSheetBackdrop.hidden = true;
  document.body.style.overflow = "";
}

function shippingLoading() {
  shippingState.hidden = false;
  shippingState.innerHTML = `
    <div class="shipping-loading">
      <div class="mini-spinner"></div>
      <div>
        <strong>Mencari layanan pengiriman…</strong>
        <span>Tarif dihitung dari alamat tujuan dan detail produk.</span>
      </div>
    </div>
  `;
  shippingList.innerHTML = "";
  shippingPickerButton.disabled = true;
  renderSelectedShipping();
}

function shippingUnavailable(message) {
  shippingState.hidden = false;
  shippingState.innerHTML = `
    <div class="shipping-error">
      <span class="courier-mark">!</span>
      <div>
        <strong>Pengiriman belum tersedia</strong>
        <span>${esc(message)}</span>
      </div>
    </div>
  `;
  shippingList.innerHTML = "";
  selectedShipping = null;
  currentQuote = null;
  shippingPickerButton.disabled = true;
  renderSelectedShipping();
  updateSummary();
}

async function loadCore() {
  const user = await requireUser();
  if (!user) return;

  clearError();

  try {
    if (offerId) {
      const { data, error } = await window.adaajaSupabase
        .from("offers")
        .select(`
          id,
          product_id,
          buyer_id,
          seller_id,
          offered_price,
          counter_price,
          status,
          expires_at
        `)
        .eq("id", offerId)
        .eq("buyer_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Negosiasi tidak ditemukan.");
      if (data.status !== "accepted") {
        throw new Error("Negosiasi belum disetujui atau sudah tidak berlaku.");
      }

      offer = data;
    }

    const resolvedProductId = offer?.product_id || productIdFromUrl;
    if (!resolvedProductId) throw new Error("Produk checkout tidak ditemukan.");

    // Ambil produk secara defensif dengan select("*").
    // Ini mencegah checkout gagal hanya karena ada kolom opsional
    // (mis. processing_time / weight / dimensions) yang belum ada di schema.
    const [productRes, imageRes, addressRes, settingsRes, paymentFeeRes] = await Promise.all([
      window.adaajaSupabase
        .from("products")
        .select("*")
        .eq("id", resolvedProductId)
        .maybeSingle(),

      window.adaajaSupabase
        .from("product_images")
        .select("storage_path,sort_order,is_cover")
        .eq("product_id", resolvedProductId)
        .order("sort_order", { ascending: true }),

      // Jangan bergantung pada kolom is_default karena schema address
      // existing Anda belum memiliki field tersebut.
      window.adaajaSupabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),

      window.adaajaSupabase
        .from("platform_checkout_settings")
        .select("*")
        .maybeSingle(),

      window.adaajaSupabase
        .from("payment_method_fees")
        .select("method_code, method_name, percent_fee, flat_fee")
        .eq("provider", "midtrans")
        .eq("is_active", true)
        .order("method_name", { ascending: true })
    ]);

    if (productRes.error) throw productRes.error;
    if (!productRes.data) throw new Error("Produk tidak ditemukan.");
    if (imageRes.error) console.warn("Product image query:", imageRes.error);
    if (addressRes.error) throw addressRes.error;
    if (settingsRes.error) throw settingsRes.error;

    product = {
      ...productRes.data,
      product_images: imageRes.data || []
    };
    settings = settingsRes.data || {
      marketplace_fee_percent: 5,
      service_fee_percent: 5,
      target_net_margin_percent: 12
    };

    if (product.seller_id === user.id) {
      throw new Error("Anda tidak dapat membeli produk sendiri.");
    }

    // Prioritas address dibuat kompatibel dengan berbagai schema:
    // is_default/default/is_primary bila suatu saat ada; jika tidak, gunakan
    // alamat terbaru dari hasil query.
    const addressRows = addressRes.data || [];
    address =
      addressRows.find((item) =>
        item.is_default === true ||
        item.default === true ||
        item.is_primary === true ||
        item.is_main === true
      ) ||
      addressRows[0] ||
      null;

    renderProduct();
    renderAddress();
    renderPaymentMethods(paymentFeeRes.data || []);

    if (!address) {
      shippingUnavailable("Tambahkan alamat pengiriman terlebih dahulu.");
      updateSummary();
      return;
    }

    await loadShippingRates();
  } catch (error) {
    console.error("Checkout load error:", error);
    showError(error.message || "Checkout gagal dimuat.");
    payButton.disabled = true;
  }
}

function renderProduct() {
  const images = [...(product.product_images || [])]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

  const cover = images.find((image) => image.is_cover) || images[0] || null;
  const imageUrl = publicUrl(cover?.storage_path || "");

  const unit = product.unit || "pcs";
  const minimum = Math.max(1, Number(product.minimum_order || 1));
  const stock = Number(product.stock || 0);

  const unitPrice = Number(
    offer
      ? (offer.counter_price || offer.offered_price || product.price || 0)
      : (product.price || 0)
  );

  quantityInput.min = minimum;
  quantityInput.max = stock > 0 ? stock : 999999;
  quantityInput.value = minimum;

  minimumOrderText.textContent = `Minimum order ${minimum} ${unit}`;

  productCard.innerHTML = `
    <div class="product-image">
      ${imageUrl
        ? `<img src="${esc(imageUrl)}" alt="${esc(product.name || "Produk")}">`
        : `<div class="skeleton-box" style="width:100%;height:100%"></div>`}
    </div>

    <div class="product-copy">
      <h3>${esc(product.name || "Produk")}</h3>
      <span>Stok ${stock} ${esc(unit)}</span>

      <div class="product-price">
        <strong>${money(unitPrice)}</strong>
        <span>/ ${esc(unit)}</span>
      </div>

      ${offer ? `<span class="deal-badge">Harga hasil negosiasi</span>` : ""}
    </div>
  `;

  updateSummary();
}

function renderAddress() {
  if (!address) {
    addressCard.innerHTML = `
      <h3>Belum ada alamat pengiriman</h3>
      <p>Tambahkan alamat terlebih dahulu sebelum melanjutkan checkout.</p>
    `;
    return;
  }

  const name =
    address.recipient_name ||
    address.full_name ||
    address.name ||
    "Penerima";

  const label = address.label || "Alamat Utama";
  const phone = address.phone || address.phone_number || "";

  const fullAddress =
    address.full_address ||
    [
      address.address_line,
      address.village,
      address.district,
      address.city,
      address.province,
      address.postal_code
    ].filter(Boolean).join(", ");

  addressCard.innerHTML = `
    <span class="address-label">${esc(label)}</span>
    <h3>${esc(name)}</h3>
    <p>${esc(fullAddress || "Alamat tersedia")}</p>
    ${phone ? `<small>${esc(phone)}</small>` : ""}
  `;
}

function renderPaymentMethods(rows) {
  const preferred =
    rows.find((row) => row.method_code === "default_estimate") ||
    rows[0] ||
    null;

  paymentMethodCode = preferred?.method_code || "default_estimate";
}

async function loadShippingRates() {
  if (!currentUser || !product || !address) return;

  shippingLoading();
  selectedShipping = null;
  currentQuote = null;
  updateSummary();

  try {
    const payload = {
      product_id: product.id,
      address_id: address.id,
      quantity: Number(quantityInput.value || 1)
    };

    const { data, error } = await window.adaajaSupabase.functions.invoke(
      "get-shipping-rates",
      { body: payload }
    );

    if (error) throw error;

    const rates =
      data?.rates ||
      data?.pricing ||
      data?.couriers ||
      [];

    if (!Array.isArray(rates) || !rates.length) {
      throw new Error("Belum ada layanan kurir yang tersedia untuk alamat ini.");
    }

    document.getElementById("shippingDestinationLabel").textContent =
      address?.city || address?.district || address?.postal_code || "Alamat Anda";

    shippingOptions = rates.map((rate, index) => ({
      id: rate.id || `${rate.courier_code || rate.company || "courier"}-${rate.service_code || rate.type || index}`,
      courier_company: rate.courier_company || rate.company || rate.courier_name || "Kurir",
      courier_code: rate.courier_code || rate.courier || rate.company || "",
      service_name: rate.courier_service_name || rate.service_name || rate.name || rate.type || "Reguler",
      service_code: rate.courier_service_code || rate.service_code || rate.type || "",
      base_cost: Number(rate.base_cost ?? rate.price ?? rate.cost ?? 0),
      estimated_min_days: rate.estimated_min_days ?? rate.duration_min ?? null,
      estimated_max_days: rate.estimated_max_days ?? rate.duration_max ?? null,
      estimated_text: rate.estimated_text || rate.duration || rate.shipment_duration_range || ""
    })).filter((rate) => rate.base_cost >= 0);

    renderShippingOptions();
  } catch (error) {
    console.error("Shipping rate error:", error);

    shippingUnavailable(
      "Integrasi tarif Biteship belum aktif atau rate belum tersedia. Deploy Edge Function get-shipping-rates agar checkout dapat melanjutkan pembayaran."
    );
  }
}

function renderShippingOptions() {
  shippingState.hidden = true;
  shippingPickerButton.disabled = false;

  shippingSheetList.innerHTML = shippingOptions.map((rate) => {
    const eta = shippingEta(rate);
    const active = selectedShipping?.id === rate.id;

    return `
      <button class="shipping-sheet-option ${active ? "active" : ""}" type="button" data-id="${esc(rate.id)}">
        <span class="courier-logo-badge" data-courier="${esc(String(rate.courier_code || "").toLowerCase())}">
          ${esc(courierBadgeText(rate))}
        </span>

        <span class="shipping-sheet-option-copy">
          <strong>${esc(rate.courier_company)} · ${esc(rate.service_name)}</strong>
          <span>${esc(eta)}</span>
          <em>${esc(String(rate.service_code || "service").toUpperCase())}</em>
        </span>

        <span class="shipping-sheet-option-price">
          <strong>${money(rate.customer_price ?? rate.base_cost)}</strong>
          <small>ongkir</small>
        </span>

        <span class="shipping-sheet-radio"></span>
      </button>
    `;
  }).join("");

  shippingSheetList.querySelectorAll(".shipping-sheet-option").forEach((button) => {
    button.addEventListener("click", async () => {
      shippingSheetList.querySelectorAll(".shipping-sheet-option").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      selectedShipping =
        shippingOptions.find((rate) => rate.id === button.dataset.id) ||
        null;

      currentQuote = null;
      renderSelectedShipping();
      closeShippingSheet();
      await refreshQuote();
    });
  });

  renderSelectedShipping();
}

async function refreshQuote() {
  if (!product || !selectedShipping || !currentUser) {
    currentQuote = null;
    updateSummary();
    return;
  }

  const myVersion = ++quoteVersion;
  payButton.disabled = true;
  document.getElementById("bottomHint").textContent = "Menghitung total…";

  try {
    const quantity = normalizeQuantity();

    const { data: quoteId, error } = await window.adaajaSupabase.rpc(
      "create_checkout_quote",
      {
        p_product_id: product.id,
        p_offer_id: offer?.id || null,
        p_quantity: quantity,
        p_shipping_base_cost: Number(selectedShipping.base_cost || 0),
        p_payment_method_code: paymentMethodCode
      }
    );

    if (error) throw error;
    if (myVersion !== quoteVersion) return;

    const { data: quote, error: quoteError } = await window.adaajaSupabase
      .from("checkout_quote_public")
      .select("*")
      .eq("quote_id", quoteId)
      .maybeSingle();

    if (quoteError) throw quoteError;
    if (!quote) throw new Error("Checkout quote tidak dapat dibaca.");

    if (myVersion !== quoteVersion) return;

    currentQuote = quote;

    // UI should show customer shipping price, not raw Biteship cost.
    const finalShipping = Number(quote.shipping_customer_price || 0);

    selectedShipping.customer_price = finalShipping;

    const sheetItem = shippingSheetList.querySelector(
      `.shipping-sheet-option[data-id="${CSS.escape(selectedShipping.id)}"]`
    );

    if (sheetItem) {
      const priceEl = sheetItem.querySelector(".shipping-sheet-option-price strong");
      if (priceEl) priceEl.textContent = money(finalShipping);
    }

    renderSelectedShipping();
    updateSummary();
  } catch (error) {
    console.error("Quote error:", error);
    currentQuote = null;
    showToast(error.message || "Total checkout gagal dihitung.");
    updateSummary();
  }
}

function normalizeQuantity() {
  const minimum = Math.max(1, Number(product?.minimum_order || 1));
  const stock = Number(product?.stock || 0);

  let quantity = Math.max(
    minimum,
    Number(quantityInput.value || minimum)
  );

  if (stock > 0) quantity = Math.min(quantity, stock);

  quantityInput.value = quantity;
  return quantity;
}

function currentUnitPrice() {
  return Number(
    offer
      ? (offer.counter_price || offer.offered_price || product?.price || 0)
      : (product?.price || 0)
  );
}

function updateSummary() {
  if (!product) return;

  const quantity = normalizeQuantity();
  const subtotal = currentUnitPrice() * quantity;

  document.getElementById("subtotal").textContent = money(subtotal);

  if (currentQuote) {
    document.getElementById("shippingSummary").textContent =
      money(currentQuote.shipping_customer_price);

    document.getElementById("serviceFee").textContent =
      money(currentQuote.service_fee_amount);

    document.getElementById("grandTotal").textContent =
      money(currentQuote.buyer_total);

    document.getElementById("bottomTotal").textContent =
      money(currentQuote.buyer_total);

    payButton.disabled = !address || !selectedShipping;
    document.getElementById("bottomHint").textContent =
      selectedShipping
        ? `${selectedShipping.courier_company} · ${selectedShipping.service_name}`
        : "Pilih pengiriman untuk melanjutkan";
  } else {
    document.getElementById("shippingSummary").textContent =
      selectedShipping ? "Menghitung…" : "—";

    document.getElementById("serviceFee").textContent =
      money(
        subtotal *
        (Number(settings?.service_fee_percent || 5) / 100)
      );

    document.getElementById("grandTotal").textContent = money(subtotal);
    document.getElementById("bottomTotal").textContent = money(subtotal);

    payButton.disabled = true;
    document.getElementById("bottomHint").textContent =
      selectedShipping
        ? "Menghitung total…"
        : "Pilih pengiriman untuk melanjutkan";
  }
}

function midtransSnapUrl() {
  return "https://app.sandbox.midtrans.com/snap/snap.js";
}

async function ensureSnapLoaded() {
  if (window.snap?.pay) return;

  const clientKey =
    window.ADAAJA_MIDTRANS_CLIENT_KEY ||
    window.MIDTRANS_CLIENT_KEY ||
    "";

  if (!clientKey) {
    throw new Error(
      "MIDTRANS_CLIENT_KEY Sandbox belum dipasang di frontend AdaAja."
    );
  }

  const existing = document.querySelector('script[data-adaaja-midtrans-snap="1"]');

  if (existing) {
    await new Promise((resolve, reject) => {
      if (window.snap?.pay) return resolve();
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });

    if (!window.snap?.pay) {
      throw new Error("Midtrans Snap gagal dimuat.");
    }

    return;
  }

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = midtransSnapUrl();
    script.setAttribute("data-client-key", clientKey);
    script.setAttribute("data-adaaja-midtrans-snap", "1");
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  if (!window.snap?.pay) {
    throw new Error("Midtrans Snap gagal dimuat.");
  }
}

async function inspectPaymentAfterSnapClose(orderId) {
  try {
    const { data, error } = await window.adaajaSupabase.functions.invoke(
      "get-midtrans-payment-status",
      { body: { order_id: orderId } }
    );

    if (error) throw error;

    const status = String(
      data?.transaction_status ||
      data?.payment_status ||
      ""
    ).toLowerCase();

    if (["settlement", "capture", "paid"].includes(status)) {
      location.href =
        `payment-pending.html?order_id=${encodeURIComponent(orderId)}&state=success`;
      return;
    }

    // Midtrans Status API starts returning payment_type after a payment
    // channel has actually been selected.
    if (
      data?.payment_channel_selected ||
      data?.payment_type ||
      (status === "pending" && data?.midtrans_status_found)
    ) {
      location.href =
        `payment-pending.html?order_id=${encodeURIComponent(orderId)}&state=pending`;
      return;
    }

    // Buyer closed Snap before selecting a payment channel.
    showToast("Metode pembayaran belum dipilih.");
  } catch (error) {
    console.warn("Check payment after Snap close:", error);
    showToast("Pembayaran belum dipilih. Silakan tekan Bayar Sekarang lagi.");
  }
}

function openSnapPayment(orderId, snapToken) {
  return ensureSnapLoaded().then(() => {
    window.snap.pay(snapToken, {
      onSuccess(result) {
        console.log("MIDTRANS SNAP SUCCESS", result);
        location.href =
          `payment-pending.html?order_id=${encodeURIComponent(orderId)}&state=success`;
      },

      onPending(result) {
        console.log("MIDTRANS SNAP PENDING", result);
        location.href =
          `payment-pending.html?order_id=${encodeURIComponent(orderId)}&state=pending`;
      },

      onError(result) {
        console.error("MIDTRANS SNAP ERROR", result);
        showToast("Pembayaran belum berhasil. Anda dapat mencoba lagi.");
      },

      onClose() {
        // Stay on checkout if the buyer closed Snap before selecting a channel.
        // Move to payment-pending only after Midtrans has a real payment channel.
        inspectPaymentAfterSnapClose(orderId);
      }
    });
  });
}

async function finalizeAndPay() {
  if (!currentUser || !product || !address || !selectedShipping || !currentQuote) {
    showToast("Lengkapi checkout terlebih dahulu.");
    return;
  }

  payButton.disabled = true;
  payButton.textContent = "Menyiapkan Pembayaran…";

  try {
    const { data, error } = await window.adaajaSupabase.rpc(
      "finalize_checkout_quote",
      {
        p_quote_id: currentQuote.quote_id,
        p_address_id: address.id,
        p_buyer_note: buyerNote.value.trim() || null
      }
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    const orderId = result?.order_id;

    if (!orderId) {
      throw new Error("Order ID tidak ditemukan setelah checkout.");
    }

    // Save chosen shipping service to the order for future Biteship booking.
    // This update may be blocked by RLS in stricter deployments; failure is non-fatal here.
    try {
      await window.adaajaSupabase
        .from("orders")
        .update({
          courier_code: selectedShipping.courier_code || null,
          courier_service: selectedShipping.service_code || selectedShipping.service_name || null
        })
        .eq("id", orderId)
        .eq("buyer_id", currentUser.id);
    } catch (_) {}

    const { data: paymentData, error: paymentError } =
      await window.adaajaSupabase.functions.invoke(
        "create-midtrans-snap",
        { body: { order_id: orderId } }
      );

    if (paymentError) {
      throw paymentError;
    }

    if (paymentData?.snap_token) {
      await openSnapPayment(orderId, paymentData.snap_token);
      return;
    }

    throw new Error("Midtrans tidak mengembalikan Snap token.");
  } catch (error) {
    console.error("Finalize checkout error:", error);
    showToast(error.message || "Checkout gagal diproses.");
    payButton.disabled = false;
  } finally {
    payButton.innerHTML = `
      Bayar Sekarang
      <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg>
    `;
  }
}

document.getElementById("changeAddressButton").addEventListener("click", () => {
  location.href =
    `my-address.html?return_to=${encodeURIComponent(location.href)}`;
});

document.getElementById("reloadShippingButton").addEventListener("click", loadShippingRates);

document.getElementById("retryCheckoutButton").addEventListener("click", loadCore);

document.getElementById("decreaseQty").addEventListener("click", async () => {
  quantityInput.value = Number(quantityInput.value || 1) - 1;
  normalizeQuantity();
  currentQuote = null;
  updateSummary();

  if (selectedShipping) {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(refreshQuote, 250);
  }
});

document.getElementById("increaseQty").addEventListener("click", async () => {
  quantityInput.value = Number(quantityInput.value || 1) + 1;
  normalizeQuantity();
  currentQuote = null;
  updateSummary();

  if (selectedShipping) {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(refreshQuote, 250);
  }
});

quantityInput.addEventListener("input", () => {
  normalizeQuantity();
  currentQuote = null;
  updateSummary();

  if (selectedShipping) {
    clearTimeout(quoteTimer);
    quoteTimer = setTimeout(refreshQuote, 350);
  }
});

buyerNote.addEventListener("input", () => {
  document.getElementById("noteCount").textContent = buyerNote.value.length;
});

shippingPickerButton.addEventListener("click", openShippingSheet);
document.getElementById("closeShippingSheet").addEventListener("click", closeShippingSheet);
shippingSheetBackdrop.addEventListener("click", (event) => {
  if (event.target === shippingSheetBackdrop) closeShippingSheet();
});

payButton.addEventListener("click", finalizeAndPay);

window.adaajaSupabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session?.user) {
    location.replace("login.html");
  }
});

loadCore();
