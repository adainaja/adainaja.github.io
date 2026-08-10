const qs = new URLSearchParams(location.search);
const orderId = qs.get("order_id");

let currentUser = null;
let statusData = null;
let pollTimer = null;
let countdownTimer = null;
let snapLoadingPromise = null;
let toastTimer = null;
let cancellingOrder = false;

const $ = (id) => document.getElementById(id);
const money = (v) => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

function toast(msg){
  $("toast").textContent = msg;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>$("toast").classList.remove("show"),2200);
}

async function requireUser(){
  const user = await window.AdaAjaAuth.getCurrentUser();
  if(!user){
    localStorage.setItem("redirectAfterLogin", location.pathname.split("/").pop()+location.search);
    location.replace("login.html");
    return null;
  }
  currentUser = user;
  return user;
}

function paymentName(data){
  const type = String(data?.payment_type || "");
  const bank = String(data?.bank || data?.va_bank || "").toUpperCase();
  if(type === "bank_transfer") return bank ? `${bank} Virtual Account` : "Virtual Account";
  if(type === "echannel") return "Mandiri Bill Payment";
  if(type === "qris") return "QRIS";
  if(type === "gopay") return "GoPay";
  if(type === "shopeepay") return "ShopeePay";
  if(type === "credit_card") return "Kartu Kredit / Debit";
  if(type) return type.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
  return "Belum memilih metode";
}

function methodMark(data){
  const bank = String(data?.bank || data?.va_bank || "").toUpperCase();
  if(bank) return bank.slice(0,4);
  const type = String(data?.payment_type || "");
  if(type === "qris") return "QR";
  if(type === "gopay") return "GP";
  if(type === "shopeepay") return "SP";
  if(type === "echannel") return "MDR";
  return "PAY";
}

function formatDate(value){
  if(!value) return "Mengikuti batas waktu Midtrans";
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID",{dateStyle:"medium",timeStyle:"short"}).format(d);
}

function parseExpiry(value){
  if(!value) return null;
  let normalized = String(value).trim();
  if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{4}$/.test(normalized)){
    normalized = normalized.replace(" ","T").replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2");
  }else if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)){
    normalized = normalized.replace(" ","T") + "+07:00";
  }
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startCountdown(expiry){
  clearInterval(countdownTimer);
  const end = parseExpiry(expiry);
  if(!end){
    $("countdown").textContent = "--:--:--";
    $("expiryText").textContent = "Mengikuti batas waktu Midtrans";
    return;
  }

  $("expiryText").textContent = formatDate(end.toISOString());

  const tick = () => {
    const diff = end.getTime() - Date.now();
    if(diff <= 0){
      $("countdown").textContent = "00:00:00";
      clearInterval(countdownTimer);
      return;
    }
    const total = Math.floor(diff/1000);
    const h = Math.floor(total/3600);
    const m = Math.floor((total%3600)/60);
    const s = total%60;
    $("countdown").textContent = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  };
  tick();
  countdownTimer = setInterval(tick,1000);
}

async function copyText(value){
  try{
    await navigator.clipboard.writeText(String(value));
    toast("Berhasil disalin.");
  }catch(_){
    const t=document.createElement("textarea");t.value=String(value);t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();document.execCommand("copy");t.remove();toast("Berhasil disalin.");
  }
}

function renderPayment(data){
  const status = String(data.transaction_status || data.payment_status || "pending");
  const paid = ["settlement","capture","paid"].includes(status);
  const failed = ["cancel","expire","deny","failure","failed","expired","cancelled"].includes(status);
  const hasMethod = Boolean(data.payment_type);
  const va = data.va_number || data.permata_va_number || null;

  $("heroAmount").textContent = money(data.gross_amount || data.buyer_total);
  $("orderNumber").textContent = data.order_number ? `Pesanan ${data.order_number}` : "Pesanan AdaAja";
  $("methodTitle").textContent = paymentName(data);

  $("statusHero").classList.remove("pending","success","failed");
  $("statusHero").classList.add(paid ? "success" : failed ? "failed" : "pending");

  if(paid){
    $("statusEyebrow").textContent = "PEMBAYARAN BERHASIL";
    $("statusTitle").textContent = "Pembayaran sudah dikonfirmasi";
    $("statusSubtitle").textContent = "Pesanan dapat dilanjutkan ke proses seller.";
    $("timerCard").style.display = "none";
    $("changeMethodBtn").hidden = true;
    $("continuePaymentBtn").hidden = true;
    $("paymentTimeline").classList.remove("active");
    $("paymentTimeline").classList.add("done");
    $("paymentTimelineTitle").textContent = "Pembayaran berhasil";
    $("paymentTimelineText").textContent = "Midtrans telah mengonfirmasi pembayaran.";
    $("processingTimeline").classList.add("active");
  }else if(failed){
    $("statusEyebrow").textContent = "PEMBAYARAN TIDAK AKTIF";
    $("statusTitle").textContent = status === "expire" || status === "expired" ? "Batas pembayaran berakhir" : "Pembayaran dibatalkan";
    $("statusSubtitle").textContent = "Anda dapat membuat metode pembayaran baru untuk pesanan ini.";
    $("timerCard").style.display = "none";
  }else{
    $("statusEyebrow").textContent = hasMethod ? "MENUNGGU PEMBAYARAN" : "PILIH METODE PEMBAYARAN";
    $("statusTitle").textContent = hasMethod ? "Selesaikan pembayaran Anda" : "Pembayaran belum dipilih";
    $("statusSubtitle").textContent = hasMethod
      ? "Anda boleh menutup halaman ini. Status akan diperbarui saat pembayaran diterima."
      : "Tekan Pilih Metode Pembayaran untuk membuka pilihan resmi Midtrans.";
    $("timerCard").style.display = "";
  }

  startCountdown(data.expiry_time);

  let detail = `
    <div class="method-box">
      <span class="method-mark">${esc(methodMark(data))}</span>
      <div>
        <strong>${esc(paymentName(data))}</strong>
        <small>${hasMethod ? "Metode pembayaran aktif" : "Belum ada payment channel yang dipilih"}</small>
      </div>
    </div>
  `;

  if(va){
    detail += `
      <div class="va-box">
        <span>Nomor Virtual Account</span>
        <div class="va-row">
          <strong>${esc(va)}</strong>
          <button class="copy-btn" type="button" data-copy="${esc(va)}">Salin</button>
        </div>
      </div>
      <div class="instruction-note">Transfer tepat sesuai total pembayaran. Status akan diperbarui otomatis setelah Midtrans menerima konfirmasi dari bank.</div>
    `;
  }else if(data.bill_key || data.biller_code){
    detail += `
      <div class="bill-grid">
        <div><span>Biller Code</span><strong>${esc(data.biller_code || "—")}</strong></div>
        <div><span>Bill Key</span><strong>${esc(data.bill_key || "—")}</strong></div>
      </div>
      ${data.bill_key ? `<div class="va-box"><span>Bill Key</span><div class="va-row"><strong>${esc(data.bill_key)}</strong><button class="copy-btn" type="button" data-copy="${esc(data.bill_key)}">Salin</button></div></div>` : ""}
    `;
  }else if(hasMethod && !paid){
    detail += `<div class="instruction-note">Untuk metode ini, lanjutkan pembayaran melalui popup Midtrans. Anda tetap dapat kembali ke halaman AdaAja setelahnya.</div>`;
  }

  $("paymentDetail").innerHTML = detail;
  $("paymentDetail").querySelectorAll("[data-copy]").forEach(btn=>btn.addEventListener("click",()=>copyText(btn.dataset.copy)));

  $("continuePaymentBtn").hidden = paid;
  $("continuePaymentText").textContent = hasMethod && !failed ? "Buka Pembayaran" : "Pilih Metode Pembayaran";
  $("changeMethodBtn").hidden = !hasMethod || paid || failed || status !== "pending";

  // Buyer may cancel only while payment has not succeeded.
  // Failed/expired/cancelled transactions do not need another cancel action.
  $("cancelOrderBtn").hidden = paid || failed;
}

function renderOrder(data){
  $("subtotal").textContent = money(data.merchandise_subtotal);
  $("shipping").textContent = money(data.shipping_customer_price);
  $("serviceFee").textContent = money(data.service_fee_amount);
  $("total").textContent = money(data.buyer_total || data.gross_amount);

  const img = data.product_image_url;
  $("productRow").innerHTML = `
    ${img ? `<img src="${esc(img)}" alt="${esc(data.product_name || "Produk")}">` : `<div class="product-placeholder"></div>`}
    <div>
      <strong>${esc(data.product_name || "Produk AdaAja")}</strong>
      <small>${esc(data.quantity || 1)} ${esc(data.unit || "pcs")} · ${money(data.unit_price || 0)}</small>
    </div>
  `;
}

async function fetchStatus(silent=false){
  if(!orderId) throw new Error("order_id tidak tersedia.");
  if(!silent) $("checkStatusBtn").textContent = "Memeriksa…";

  try{
    const {data,error} = await window.adaajaSupabase.functions.invoke(
      "get-midtrans-payment-status",
      {body:{order_id:orderId}}
    );
    if(error) throw error;
    if(!data?.ok) throw new Error(data?.error || "Status pembayaran gagal dibaca.");
    statusData = data;
    renderPayment(data);
    renderOrder(data);
    return data;
  }catch(err){
    console.error(err);
    if(!silent) toast(err.message || "Status pembayaran gagal diperiksa.");
    throw err;
  }finally{
    $("checkStatusBtn").textContent = "Cek status";
  }
}

async function ensureSnap(){
  if(window.snap?.pay) return;
  if(snapLoadingPromise) return snapLoadingPromise;

  const key = window.ADAAJA_MIDTRANS_CLIENT_KEY || window.MIDTRANS_CLIENT_KEY || "";
  if(!key) throw new Error("Midtrans Client Key belum terpasang.");

  snapLoadingPromise = new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key",key);
    script.onload=resolve;
    script.onerror=()=>reject(new Error("Snap Midtrans gagal dimuat."));
    document.head.appendChild(script);
  });

  await snapLoadingPromise;
}

async function openSnap(replacePending=false){
  try{
    $("continuePaymentBtn").disabled = true;
    $("changeMethodBtn").disabled = true;

    const {data,error} = await window.adaajaSupabase.functions.invoke(
      "create-midtrans-snap",
      {body:{order_id:orderId, replace_pending_payment:replacePending}}
    );
    if(error) throw error;
    if(!data?.snap_token) throw new Error(data?.error || "Snap token tidak tersedia.");

    await ensureSnap();

    window.snap.pay(data.snap_token,{
      onSuccess(){ location.href=`payment-pending.html?order_id=${encodeURIComponent(orderId)}&state=success`; },
      onPending(){ location.href=`payment-pending.html?order_id=${encodeURIComponent(orderId)}&state=pending`; },
      onError(){ toast("Pembayaran belum berhasil."); setTimeout(()=>fetchStatus(true),600); },
      onClose(){ fetchStatus(true).catch(()=>{}); }
    });
  }catch(err){
    console.error(err);
    toast(err.message || "Pembayaran gagal dibuka.");
  }finally{
    $("continuePaymentBtn").disabled = false;
    $("changeMethodBtn").disabled = false;
  }
}

function openCancelOrderModal(){
  if(cancellingOrder) return;
  $("cancelOrderModal").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeCancelOrderModal(){
  if(cancellingOrder) return;
  $("cancelOrderModal").hidden = true;
  document.body.style.overflow = "";
}

async function cancelOrder(){
  if(cancellingOrder || !orderId) return;

  cancellingOrder = true;

  const confirmButton = $("confirmCancelOrderBtn");
  const closeButton = $("closeCancelOrderModalBtn");
  const cancelMainButton = $("cancelOrderBtn");
  const changeButton = $("changeMethodBtn");
  const continueButton = $("continuePaymentBtn");

  const originalText = confirmButton.textContent;

  confirmButton.disabled = true;
  closeButton.disabled = true;
  cancelMainButton.disabled = true;
  changeButton.disabled = true;
  continueButton.disabled = true;
  confirmButton.textContent = "Membatalkan Pesanan…";

  try{
    // Always refresh first. This prevents cancelling an order that has
    // just been paid while the page still shows stale pending data.
    const latest = await fetchStatus(true);

    const latestStatus = String(
      latest?.transaction_status ||
      latest?.payment_status ||
      ""
    ).toLowerCase();

    if(["settlement","capture","paid"].includes(latestStatus)){
      closeCancelOrderModal();
      renderPayment(latest);
      toast("Pembayaran sudah berhasil. Pesanan tidak dapat dibatalkan.");
      return;
    }

    const reason = $("cancelReasonSelect").value || "Dibatalkan oleh pembeli";

    const {data,error} = await window.adaajaSupabase.functions.invoke(
      "cancel-order-payment",
      {
        body:{
          order_id:orderId,
          reason
        }
      }
    );

    if(error) throw error;

    if(!data?.ok){
      throw new Error(data?.error || "Pesanan belum dapat dibatalkan.");
    }

    $("cancelOrderModal").hidden = true;
    document.body.style.overflow = "";

    clearInterval(pollTimer);
    clearInterval(countdownTimer);

    toast("Pesanan berhasil dibatalkan.");

    setTimeout(()=>{
      location.href =
        `my-orders.html?order_id=${encodeURIComponent(orderId)}&status=cancelled`;
    },900);

  }catch(err){
    console.error("Cancel order error:",err);

    const message =
      err?.context?.body?.error ||
      err?.message ||
      "Pesanan belum dapat dibatalkan.";

    toast(message);

    // Re-sync UI because Midtrans may have changed while cancellation ran.
    try{
      const latest = await fetchStatus(true);
      renderPayment(latest);
    }catch(_){}
  }finally{
    cancellingOrder = false;
    confirmButton.disabled = false;
    closeButton.disabled = false;
    cancelMainButton.disabled = false;
    changeButton.disabled = false;
    continueButton.disabled = false;
    confirmButton.textContent = originalText;
  }
}

$("continuePaymentBtn").addEventListener("click",()=>openSnap(false));
$("changeMethodBtn").addEventListener("click",()=>{$("changeModal").hidden=false;});
$("cancelOrderBtn").addEventListener("click",openCancelOrderModal);
$("closeCancelOrderModalBtn").addEventListener("click",closeCancelOrderModal);
$("confirmCancelOrderBtn").addEventListener("click",cancelOrder);
$("cancelOrderModal").addEventListener("click",(event)=>{
  if(event.target === $("cancelOrderModal")) closeCancelOrderModal();
});
$("cancelChangeBtn").addEventListener("click",()=>{$("changeModal").hidden=true;});
$("confirmChangeBtn").addEventListener("click",async()=>{
  $("changeModal").hidden=true;
  await openSnap(true);
});
$("checkStatusBtn").addEventListener("click",()=>fetchStatus(false));
$("refreshTopBtn").addEventListener("click",()=>fetchStatus(false));
$("ordersBtn").addEventListener("click",()=>location.href=`my-orders.html?order_id=${encodeURIComponent(orderId||"")}`);
$("backBtn").addEventListener("click",()=>location.href=`my-orders.html?order_id=${encodeURIComponent(orderId||"")}`);

document.addEventListener("keydown",(event)=>{
  if(event.key === "Escape"){
    if(!$("cancelOrderModal").hidden) closeCancelOrderModal();
    if(!$("changeModal").hidden) $("changeModal").hidden = true;
  }
});

(async()=>{
  if(!orderId){ toast("Pesanan tidak ditemukan."); return; }
  const user=await requireUser(); if(!user) return;
  try{ await fetchStatus(false); }catch(_){}
  pollTimer=setIntervaldocument.addEventListener("keydown",(event)=>{
  if(event.key === "Escape"){
    if(!$("cancelOrderModal").hidden) closeCancelOrderModal();
    if(!$("changeModal").hidden) $("changeModal").hidden = true;
  }
});

(async()=>{
    try{
      const data=await fetchStatus(true);
      const s=String(data.transaction_status||data.payment_status||"");
      if(["settlement","capture","paid"].includes(s)){
        clearInterval(pollTimer);
        setTimeout(()=>location.href=`my-orders.html?order_id=${encodeURIComponent(orderId)}&payment=success`,1800);
      }
    }catch(_){}
  },8000);
})();

window.addEventListener("beforeunload",()=>{clearInterval(pollTimer);clearInterval(countdownTimer);});
