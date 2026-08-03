const API_URL="https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const offerId=new URLSearchParams(location.search).get("offer_id");

const checkoutContent=document.getElementById("checkoutContent");
const errorState=document.getElementById("errorState");
const errorMessage=document.getElementById("errorMessage");
const bottomBar=document.getElementById("bottomBar");
const bottomTotal=document.getElementById("bottomTotal");
const createOrderButton=document.getElementById("createOrderButton");
const successModal=document.getElementById("successModal");
const goToOrdersButton=document.getElementById("goToOrdersButton");

let checkoutData=null;
let createdOrderId="";

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
      return "https://drive.google.com/thumbnail?id="+id[0]+"&sz=w600";
    }
  }

  return url;
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

function showError(message){
  checkoutContent.classList.add("hidden");
  bottomBar.classList.add("hidden");
  errorState.classList.remove("hidden");
  errorMessage.textContent=message;
}

async function loadCheckout(){
  const user=getUser();

  if(!user?.user_id){
    location.href="login.html";
    return;
  }

  if(!offerId){
    showError("Offer ID tidak ditemukan.");
    return;
  }

  try{
    const result=await apiPost({
      action:"getCheckoutData",
      offer_id:offerId,
      buyer_id:user.user_id
    });

    if(result.status!=="success"||!result.checkout){
      throw new Error(result.message||"Data checkout tidak ditemukan.");
    }

    checkoutData=result.checkout;
    renderCheckout(checkoutData);
    bottomTotal.textContent=formatRupiah(checkoutData.total_bayar);
    bottomBar.classList.remove("hidden");

  }catch(error){
    showError(error.message||"Checkout tidak dapat dimuat.");
  }
}

function renderCheckout(data){
  const image=convertDriveImage(data.image_url||"");

  const imageContent=image
    ? `<img src="${image}" alt="${escapeHtml(data.nama_produk)}">`
    : `<div class="product-placeholder">Foto tidak tersedia</div>`;

  const address=data.address||{};

  checkoutContent.innerHTML=`
    <section class="checkout-section">
      <div class="section-header">
        <div class="section-title">
          <div class="section-icon">
            <svg viewBox="0 0 24 24">
              <path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z"></path>
              <circle cx="12" cy="10" r="2.4"></circle>
            </svg>
          </div>
          <div>
            <h2>Alamat Pengiriman</h2>
            <span>Pastikan alamat sudah benar</span>
          </div>
        </div>

        <button type="button" class="change-link" id="changeAddressButton">
          Ubah
        </button>
      </div>

      <div class="address-card">
        <div class="address-top">
          <div>
            <span class="address-label">
              ${escapeHtml(address.label||"Alamat Utama")}
            </span>
          </div>

          <span class="address-phone">
            ${escapeHtml(address.phone||"")}
          </span>
        </div>

        <div class="address-name">
          ${escapeHtml(address.recipient_name||data.buyer_name||"Pembeli")}
        </div>

        <p class="address-text">
          ${escapeHtml(address.full_address||"Alamat belum tersedia")}
        </p>
      </div>
    </section>

    <section class="checkout-section">
      <div class="section-header">
        <div class="section-title">
          <div class="section-icon">
            <svg viewBox="0 0 24 24">
              <path d="M6 8h12l1 12H5L6 8Z"></path>
              <path d="M9 8V6a3 3 0 0 1 6 0v2"></path>
            </svg>
          </div>
          <div>
            <h2>Produk</h2>
            <span>Harga hasil penawaran</span>
          </div>
        </div>
      </div>

      <div class="product-card">
        <div class="product-image">
          ${imageContent}
        </div>

        <div class="product-copy">
          <h3>${escapeHtml(data.nama_produk)}</h3>

          <div class="seller-name">
            Penjual: ${escapeHtml(data.seller_name||data.seller_id||"Penjual")}
          </div>

          <div class="price-row">
            <div>
              <span>Harga deal</span>
              <strong>${formatRupiah(data.harga_deal)}</strong>
            </div>

            <strong class="original-price">
              ${formatRupiah(data.harga_produk)}
            </strong>
          </div>
        </div>
      </div>
    </section>

    <section class="checkout-section">
      <div class="section-header">
        <div class="section-title">
          <div class="section-icon">
            <svg viewBox="0 0 24 24">
              <path d="M3 7h11v10H3z"></path>
              <path d="M14 10h4l3 3v4h-7z"></path>
              <circle cx="7" cy="18" r="2"></circle>
              <circle cx="18" cy="18" r="2"></circle>
            </svg>
          </div>
          <div>
            <h2>Pengiriman</h2>
            <span>Metode dari penjual</span>
          </div>
        </div>
      </div>

      <div class="shipping-option">
        <div class="shipping-copy">
          <strong>${escapeHtml(data.shipping_method||"Pengiriman standar")}</strong>
          <span>${escapeHtml(data.processing_time||"Diproses sesuai waktu penjual")}</span>
        </div>

        <div class="shipping-price">
          ${Number(data.ongkir||0)===0 ? "Gratis" : formatRupiah(data.ongkir)}
        </div>
      </div>
    </section>

    <section class="checkout-section">
      <div class="section-header">
        <div class="section-title">
          <div class="section-icon">
            <svg viewBox="0 0 24 24">
              <path d="M4 4h16v16H4z"></path>
              <path d="M8 9h8M8 13h8M8 17h5"></path>
            </svg>
          </div>
          <div>
            <h2>Ringkasan Pembayaran</h2>
            <span>Periksa sebelum membuat pesanan</span>
          </div>
        </div>
      </div>

      <div class="summary-list">
        <div class="summary-row">
          <span>Harga produk</span>
          <strong>${formatRupiah(data.harga_produk)}</strong>
        </div>

        <div class="summary-row">
          <span>Harga setelah penawaran</span>
          <strong>${formatRupiah(data.harga_deal)}</strong>
        </div>

        <div class="summary-row">
          <span>Ongkos kirim</span>
          <strong>${formatRupiah(data.ongkir)}</strong>
        </div>

        <div class="summary-row total">
          <span>Total pembayaran</span>
          <strong>${formatRupiah(data.total_bayar)}</strong>
        </div>
      </div>
    </section>

    <div class="security-note">
      <svg viewBox="0 0 24 24">
        <path d="M12 3 5 6v5c0 4.7 3 8.3 7 10 4-1.7 7-5.3 7-10V6l-7-3Z"></path>
        <path d="m9.5 12 1.7 1.7 3.8-4"></path>
      </svg>

      <div>
        <strong>Transaksi terlindungi</strong>
        <span>Pesanan baru dibuat setelah Anda menekan tombol Buat Pesanan.</span>
      </div>
    </div>
  `;

  const changeAddressButton=document.getElementById("changeAddressButton");

  if(changeAddressButton){
    changeAddressButton.onclick=()=>{
      location.href="addresses.html?return_to="+encodeURIComponent(location.href);
    };
  }
}

createOrderButton.onclick=async function(){
  const user=getUser();

  if(!user?.user_id){
    location.href="login.html";
    return;
  }

  if(!checkoutData){
    return;
  }

  if(!checkoutData.address?.address_id){
    alert("Silakan pilih alamat pengiriman terlebih dahulu.");
    return;
  }

  this.disabled=true;
  this.textContent="Membuat Pesanan...";

  try{
    const result=await apiPost({
      action:"createOrder",
      offer_id:checkoutData.offer_id,
      buyer_id:user.user_id,
      alamat_id:checkoutData.address.address_id
    });

    if(result.status!=="success"){
      throw new Error(result.message||"Pesanan gagal dibuat.");
    }

    createdOrderId=result.order_id||"";
    successModal.classList.add("active");
    successModal.setAttribute("aria-hidden","false");

  }catch(error){
    alert(error.message||"Server tidak terhubung.");
  }finally{
    this.disabled=false;
    this.textContent="Buat Pesanan";
  }
};

goToOrdersButton.onclick=()=>{
  location.href=createdOrderId
    ? "my-orders.html?order_id="+encodeURIComponent(createdOrderId)
    : "my-orders.html";
};

loadCheckout();
