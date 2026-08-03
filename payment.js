const API_URL="https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const orderId=new URLSearchParams(location.search).get("order_id");
const paymentContent=document.getElementById("paymentContent");
const errorState=document.getElementById("errorState");
const errorMessage=document.getElementById("errorMessage");
const retryButton=document.getElementById("retryButton");
const bottomBar=document.getElementById("bottomBar");
const bottomTotal=document.getElementById("bottomTotal");
const payButton=document.getElementById("payButton");
const resultModal=document.getElementById("resultModal");
const resultIcon=document.getElementById("resultIcon");
const resultTitle=document.getElementById("resultTitle");
const resultText=document.getElementById("resultText");
const resultPrimaryButton=document.getElementById("resultPrimaryButton");
const resultSecondaryButton=document.getElementById("resultSecondaryButton");

let orderData=null;
let snapToken="";
let snapReady=false;
let creatingTransaction=false;

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

  const text=await response.text();

  if(!response.ok){
    throw new Error("Server mengembalikan HTTP "+response.status);
  }

  try{
    return JSON.parse(text);
  }catch{
    console.error("Respons server:",text);

    throw new Error(
      text.trim().startsWith("<")
      ? "Server mengirim halaman HTML, bukan JSON."
      : "Respons server tidak valid."
    );
  }
}

function showError(message){
  paymentContent.classList.add("hidden");
  bottomBar.classList.add("hidden");
  errorState.classList.remove("hidden");
  errorMessage.textContent=message;
}

function hideError(){
  errorState.classList.add("hidden");
  paymentContent.classList.remove("hidden");
}

async function loadOrder(){
  const user=getUser();

  if(!user?.user_id){
    location.href="login.html";
    return;
  }

  if(!orderId){
    showError("Order ID tidak ditemukan.");
    return;
  }

  hideError();

  paymentContent.innerHTML=`
    <section class="loading-state">
      <div class="loading-card hero-loading"></div>
      <div class="loading-card"></div>
      <div class="loading-card small"></div>
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

    orderData=result.orders.find(
      item=>String(item.order_id)===String(orderId)
    );

    if(!orderData){
      throw new Error("Pesanan tidak ditemukan atau bukan milik Anda.");
    }

    if(orderData.payment_status==="paid"){
      showResult(
        "success",
        "Pesanan sudah dibayar",
        "Pembayaran pesanan ini sudah berhasil dikonfirmasi."
      );
    }

    renderPayment(orderData);
    bottomTotal.textContent=formatRupiah(
      Number(orderData.total_bayar)+4000
    );
    bottomBar.classList.remove("hidden");

  }catch(error){
    showError(error.message||"Pembayaran tidak dapat dimuat.");
  }
}

function renderPayment(order){
  const image=convertDriveImage(order.image_url||"");

  const imageContent=image
    ? `<img src="${image}" alt="${escapeHtml(order.nama_produk)}">`
    : `<div class="product-placeholder">Foto tidak tersedia</div>`;

  const paymentFee=4000;
  const grossAmount=Number(order.total_bayar||0)+paymentFee;

  paymentContent.innerHTML=`
    <section class="payment-hero">
      <span class="hero-label">MIDTRANS SANDBOX</span>
      <h2>Pilih metode pembayaran yang paling nyaman</h2>
      <p>QRIS, Virtual Account, dan metode Sandbox tersedia melalui halaman aman Midtrans.</p>
      <span class="order-code">${escapeHtml(order.order_id)}</span>
    </section>

    <section class="payment-section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24">
            <path d="M6 8h12l1 12H5L6 8Z"></path>
            <path d="M9 8V6a3 3 0 0 1 6 0v2"></path>
          </svg>
        </div>

        <div>
          <h3>Pesanan</h3>
          <span>Periksa kembali sebelum membayar</span>
        </div>
      </div>

      <div class="product-card">
        <div class="product-image">${imageContent}</div>

        <div class="product-copy">
          <h3>${escapeHtml(order.nama_produk||"Produk")}</h3>
          <div class="seller-name">Penjual: ${escapeHtml(order.seller_name||"Penjual")}</div>

          <div class="product-price">
            <span>Total pesanan</span>
            <strong>${formatRupiah(order.total_bayar)}</strong>
          </div>
        </div>
      </div>
    </section>

    <section class="payment-section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24">
            <path d="M4 4h16v16H4z"></path>
            <path d="M8 9h8M8 13h8M8 17h5"></path>
          </svg>
        </div>

        <div>
          <h3>Ringkasan Pembayaran</h3>
          <span>Biaya ditampilkan transparan</span>
        </div>
      </div>

      <div class="summary-list">
        <div class="summary-row">
          <span>Total pesanan</span>
          <strong>${formatRupiah(order.total_bayar)}</strong>
        </div>

        <div class="summary-row">
          <span>Biaya layanan pembayaran</span>
          <strong>${formatRupiah(paymentFee)}</strong>
        </div>

        <div class="summary-row total">
          <span>Total pembayaran</span>
          <strong>${formatRupiah(grossAmount)}</strong>
        </div>
      </div>
    </section>

    <section class="payment-section">
      <div class="section-header">
        <div class="section-icon">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="14" rx="2"></rect>
            <path d="M3 10h18"></path>
          </svg>
        </div>

        <div>
          <h3>Metode Pembayaran</h3>
          <span>Pilihan tersedia di Midtrans Snap</span>
        </div>
      </div>

      <div class="method-grid">
        <div class="method-item">
          <div class="method-symbol">QR</div>
          <strong>QRIS</strong>
          <span>Scan QR</span>
        </div>

        <div class="method-item">
          <div class="method-symbol">VA</div>
          <strong>Virtual Account</strong>
          <span>Transfer bank</span>
        </div>

        <div class="method-item">
          <div class="method-symbol">EW</div>
          <strong>E-Wallet</strong>
          <span>Metode aktif</span>
        </div>
      </div>
    </section>

    <div class="security-note">
      <svg viewBox="0 0 24 24">
        <path d="M12 3 5 6v5c0 4.7 3 8.3 7 10 4-1.7 7-5.3 7-10V6l-7-3Z"></path>
        <path d="m9.5 12 1.7 1.7 3.8-4"></path>
      </svg>

      <div>
        <strong>Pembayaran diproses oleh Midtrans</strong>
        <span>AdaAja tidak menyimpan data kartu, PIN, atau kredensial pembayaran pengguna.</span>
      </div>
    </div>
  `;
}

function loadSnapScript(clientKey,isProduction){
  return new Promise((resolve,reject)=>{
    if(window.snap){
      snapReady=true;
      resolve();
      return;
    }

    const existing=document.getElementById("midtransSnapScript");

    if(existing){
      existing.addEventListener("load",()=>{
        snapReady=true;
        resolve();
      });

      existing.addEventListener("error",()=>{
        reject(new Error("Library Midtrans gagal dimuat."));
      });

      return;
    }

    const script=document.createElement("script");
    script.id="midtransSnapScript";
    script.src=isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key",clientKey);
    script.onload=()=>{
      snapReady=true;
      resolve();
    };
    script.onerror=()=>{
      reject(new Error("Library Midtrans gagal dimuat."));
    };

    document.head.appendChild(script);
  });
}

async function getSnapToken(){
  const user=getUser();
  const storageKey="adaaja_snap_"+orderId;
  const cachedToken=sessionStorage.getItem(storageKey);

  if(cachedToken){
    snapToken=cachedToken;

    const clientKey=sessionStorage.getItem(storageKey+"_client");
    const isProduction=sessionStorage.getItem(storageKey+"_production")==="true";

    if(clientKey){
      await loadSnapScript(clientKey,isProduction);
      return snapToken;
    }
  }

  const result=await apiPost({
    action:"createMidtransTransaction",
    order_id:orderId,
    buyer_id:user.user_id
  });

  if(result.status!=="success"||!result.snap_token){
    throw new Error(result.message||"Snap Token gagal dibuat.");
  }

  snapToken=result.snap_token;

  sessionStorage.setItem(storageKey,snapToken);
  sessionStorage.setItem(storageKey+"_client",result.client_key||"");
  sessionStorage.setItem(storageKey+"_production",String(Boolean(result.is_production)));

  await loadSnapScript(
    result.client_key,
    Boolean(result.is_production)
  );

  return snapToken;
}

async function checkStatus(){
  const user=getUser();

  try{
    const result=await apiPost({
      action:"checkMidtransStatus",
      order_id:orderId,
      buyer_id:user.user_id
    });

    return result;
  }catch(error){
    console.error("Pengecekan status gagal:",error);
    return null;
  }
}

function clearSnapCache(){
  const storageKey="adaaja_snap_"+orderId;
  sessionStorage.removeItem(storageKey);
  sessionStorage.removeItem(storageKey+"_client");
  sessionStorage.removeItem(storageKey+"_production");
}

function showResult(type,title,text){
  resultIcon.className="result-icon "+(type==="pending"?"pending":type==="error"?"error":"");
  resultTitle.textContent=title;
  resultText.textContent=text;
  resultModal.classList.add("active");
  resultModal.setAttribute("aria-hidden","false");
}

function closeResult(){
  resultModal.classList.remove("active");
  resultModal.setAttribute("aria-hidden","true");
}

payButton.onclick=async function(){
  if(creatingTransaction)return;

  const user=getUser();

  if(!user?.user_id){
    location.href="login.html";
    return;
  }

  creatingTransaction=true;
  this.disabled=true;
  this.textContent="Menyiapkan Pembayaran...";

  try{
    const token=await getSnapToken();

    if(!snapReady||!window.snap){
      throw new Error("Midtrans Snap belum siap.");
    }

    window.snap.pay(token,{
      onSuccess:async function(){
        clearSnapCache();
        await checkStatus();

        showResult(
          "success",
          "Pembayaran berhasil",
          "Pembayaran telah diterima. Status pesanan akan diperbarui otomatis."
        );
      },

      onPending:async function(){
        await checkStatus();

        showResult(
          "pending",
          "Menunggu pembayaran",
          "Instruksi pembayaran sudah dibuat. Selesaikan pembayaran sebelum batas waktu berakhir."
        );
      },

      onError:function(result){
        console.error("Midtrans error:",result);

        showResult(
          "error",
          "Pembayaran gagal",
          "Pembayaran belum berhasil. Silakan coba kembali atau gunakan metode lain."
        );
      },

      onClose:function(){
        creatingTransaction=false;
        payButton.disabled=false;
        payButton.textContent="Bayar Sekarang";
      }
    });

  }catch(error){
    console.error("Pembayaran gagal dibuka:",error);
    alert(error.message||"Pembayaran tidak dapat dibuka.");
  }finally{
    creatingTransaction=false;
    this.disabled=false;
    this.textContent="Bayar Sekarang";
  }
};

retryButton.onclick=loadOrder;

resultPrimaryButton.onclick=()=>{
  location.href="my-orders.html";
};

resultSecondaryButton.onclick=closeResult;

loadOrder();
