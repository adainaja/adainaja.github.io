const API_URL="https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const ordersContainer=document.getElementById("ordersContainer");
const refreshButton=document.getElementById("refreshButton");

let allOrders=[];
let activeFilter="all";

function getUser(){
  try{
    return JSON.parse(localStorage.getItem("user")||"null");
  }catch{
    return null;
  }
}

function formatRupiah(value){
  return new Intl.NumberFormat("id-ID",{
    style:"currency",
    currency:"IDR",
    maximumFractionDigits:0
  }).format(Number(value||0));
}

function escapeHtml(value){
  return String(value||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function convertDriveImage(url){
  if(!url)return"";

  if(url.includes("drive.google.com")){
    const id=url.match(/[-\w]{25,}/);

    if(id){
      return "https://drive.google.com/thumbnail?id="+id[0]+"&sz=w500";
    }
  }

  return url;
}

function formatDate(value){
  const date=new Date(value);

  if(Number.isNaN(date.getTime())){
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID",{
    day:"2-digit",
    month:"short",
    year:"numeric"
  }).format(date);
}

function statusLabel(status){
  const labels={
    waiting_payment:"Menunggu Pembayaran",
    paid:"Sudah Dibayar",
    packed:"Sedang Dikemas",
    shipped:"Sedang Dikirim",
    completed:"Selesai",
    cancelled:"Dibatalkan"
  };

  return labels[status]||status||"-";
}

function paymentLabel(status){
  const labels={
    unpaid:"Belum dibayar",
    pending:"Menunggu verifikasi",
    paid:"Lunas",
    failed:"Gagal",
    expired:"Kedaluwarsa"
  };

  return labels[status]||status||"-";
}

function progressValue(status){
  const values={
    waiting_payment:0,
    paid:33,
    packed:50,
    shipped:66,
    completed:100,
    cancelled:0
  };

  return values[status]??0;
}

function progressClass(status,index){
  const map={
    waiting_payment:0,
    paid:1,
    packed:1,
    shipped:2,
    completed:3
  };

  const current=map[status]??0;

  if(index<current)return"done";
  if(index===current)return"active";
  return"";
}

function statusNote(status){
  const notes={
    waiting_payment:"Pesanan sudah dibuat. Selesaikan pembayaran agar penjual dapat memproses barang.",
    paid:"Pembayaran diterima. Penjual akan segera menyiapkan pesanan Anda.",
    packed:"Pesanan sedang dikemas oleh penjual.",
    shipped:"Pesanan sedang dalam perjalanan menuju alamat Anda.",
    completed:"Pesanan selesai. Terima kasih telah bertransaksi di AdaAja.",
    cancelled:"Pesanan ini telah dibatalkan."
  };

  return notes[status]||"Status pesanan sedang diperbarui.";
}

async function apiPost(payload){
  const response=await fetch(
    API_URL+"?t="+Date.now(),
    {
      method:"POST",
      redirect:"follow",
      headers:{
        "Content-Type":"text/plain;charset=utf-8"
      },
      body:JSON.stringify(payload)
    }
  );

  const responseText=await response.text();

  if(!response.ok){
    throw new Error("Server mengembalikan HTTP "+response.status);
  }

  try{
    return JSON.parse(responseText);
  }catch{
    console.error("Respons server:",responseText);

    throw new Error(
      responseText.trim().startsWith("<")
      ? "Server mengirim halaman HTML, bukan JSON."
      : "Respons server tidak valid."
    );
  }
}

async function loadOrders(){
  const user=getUser();

  if(!user?.user_id){
    location.href="login.html";
    return;
  }

  ordersContainer.innerHTML=`
    <section class="state-card">
      <div class="spinner"></div>
      <strong>Memuat pesanan...</strong>
      <span>Mohon tunggu sebentar.</span>
    </section>
  `;

  try{
    const result=await apiPost({
      action:"getBuyerOrders",
      buyer_id:user.user_id
    });

    if(result.status!=="success"||!Array.isArray(result.orders)){
      throw new Error(result.message||"Pesanan gagal dimuat.");
    }

    allOrders=result.orders;
    updateSummary();
    renderOrders();

  }catch(error){
    ordersContainer.innerHTML=`
      <section class="state-card">
        <strong>Pesanan belum dapat dimuat</strong>
        <span>${escapeHtml(error.message||"Server tidak terhubung.")}</span>
      </section>
    `;
  }
}

function updateSummary(){
  document.getElementById("unpaidCount").textContent=
    allOrders.filter(item=>item.status==="waiting_payment").length;

  document.getElementById("processCount").textContent=
    allOrders.filter(item=>["paid","packed","shipped"].includes(item.status)).length;

  document.getElementById("completedCount").textContent=
    allOrders.filter(item=>item.status==="completed").length;
}

function renderOrders(){
  let filtered=allOrders;

  if(activeFilter==="waiting_payment"){
    filtered=allOrders.filter(item=>item.status==="waiting_payment");
  }

  if(activeFilter==="process"){
    filtered=allOrders.filter(item=>["paid","packed","shipped"].includes(item.status));
  }

  if(activeFilter==="completed"){
    filtered=allOrders.filter(item=>item.status==="completed");
  }

  if(activeFilter==="cancelled"){
    filtered=allOrders.filter(item=>item.status==="cancelled");
  }

  if(filtered.length===0){
    ordersContainer.innerHTML=`
      <section class="state-card">
        <strong>Belum ada pesanan</strong>
        <span>Transaksi yang Anda buat akan tampil di sini.</span>
      </section>
    `;
    return;
  }

  ordersContainer.innerHTML=filtered.map(renderOrderCard).join("");
}

function renderOrderCard(order){
  const image=convertDriveImage(order.image_url||"");

  const imageContent=image
    ? `<img src="${image}" alt="${escapeHtml(order.nama_produk)}">`
    : `<div class="product-placeholder">Foto tidak tersedia</div>`;

  let actions=`
    <div class="actions">
      <a class="secondary-button" href="order-detail.html?id=${encodeURIComponent(order.order_id)}">
        Lihat Detail
      </a>
    </div>
  `;

  if(order.status==="waiting_payment"){
    actions=`
      <div class="actions two">
        <a class="secondary-button" href="order-detail.html?id=${encodeURIComponent(order.order_id)}">
          Lihat Detail
        </a>

        <a class="primary-button" href="payment.html?order_id=${encodeURIComponent(order.order_id)}">
          Bayar Sekarang
        </a>
      </div>
    `;
  }

  if(order.status==="completed"){
    actions=`
      <div class="actions two">
        <a class="secondary-button" href="order-detail.html?id=${encodeURIComponent(order.order_id)}">
          Lihat Detail
        </a>

        <a class="primary-button" href="review.html?order_id=${encodeURIComponent(order.order_id)}">
          Beri Ulasan
        </a>
      </div>
    `;
  }

  return `
    <article class="order-card">

      <div class="order-head">
        <div class="order-code">
          <span>ID Pesanan</span>
          <strong>${escapeHtml(order.order_id)}</strong>
        </div>

        <span class="status-badge status-${escapeHtml(order.status)}">
          ${escapeHtml(statusLabel(order.status))}
        </span>
      </div>

      <div class="order-main">

        <div class="product-image">
          ${imageContent}
        </div>

        <div class="product-copy">
          <h2>${escapeHtml(order.nama_produk||"Produk")}</h2>

          <div class="seller-name">
            Penjual: ${escapeHtml(order.seller_name||order.seller_id||"Penjual")}
          </div>

          <div class="price-block">
            <span>Total pembayaran</span>
            <strong>${formatRupiah(order.total_bayar)}</strong>
          </div>
        </div>

      </div>

      <div class="order-meta">

        <div class="meta-box">
          <span>Pembayaran</span>
          <strong>${escapeHtml(paymentLabel(order.payment_status))}</strong>
        </div>

        <div class="meta-box">
          <span>Dibuat</span>
          <strong>${escapeHtml(formatDate(order.created_at))}</strong>
        </div>

      </div>

      <div class="progress-wrap">
        <div class="progress-track" style="--progress:${progressValue(order.status)}%">

          <div class="progress-step ${progressClass(order.status,0)}">
            <div class="progress-dot"></div>
            <span>Dibuat</span>
          </div>

          <div class="progress-step ${progressClass(order.status,1)}">
            <div class="progress-dot"></div>
            <span>Diproses</span>
          </div>

          <div class="progress-step ${progressClass(order.status,2)}">
            <div class="progress-dot"></div>
            <span>Dikirim</span>
          </div>

          <div class="progress-step ${progressClass(order.status,3)}">
            <div class="progress-dot"></div>
            <span>Selesai</span>
          </div>

        </div>
      </div>

      <div class="status-note ${escapeHtml(order.status)}">
        ${escapeHtml(statusNote(order.status))}
      </div>

      ${actions}

    </article>
  `;
}

document.querySelectorAll(".filter-tabs button").forEach(button=>{
  button.onclick=()=>{
    document.querySelectorAll(".filter-tabs button")
      .forEach(item=>item.classList.remove("active"));

    button.classList.add("active");
    activeFilter=button.dataset.status;
    renderOrders();
  };
});

refreshButton.onclick=loadOrders;

loadOrders();
