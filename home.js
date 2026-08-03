const API_URL="https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const productGrid=document.getElementById("productGrid");
const searchInput=document.getElementById("searchInput");
const topHeader=document.getElementById("topHeader");
const notificationPanel=document.getElementById("notificationPanel");

let products=[];

function getUser(){
  try{
    return JSON.parse(localStorage.getItem("user")||"null");
  }catch{
    return null;
  }
}

function escapeHtml(value){
  return String(value||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function formatRupiah(value){
  return new Intl.NumberFormat("id-ID",{
    style:"currency",
    currency:"IDR",
    maximumFractionDigits:0
  }).format(Number(value||0));
}

function convertDriveImage(url){
  if(!url)return"";

  if(url.includes("drive.google.com")){
    const id=url.match(/[-\w]{25,}/);

    if(id){
      return "https://drive.google.com/thumbnail?id="+id[0]+"&sz=w700";
    }
  }

  return url;
}

function formatCondition(value){
  return({
    new:"Baru",
    like_new:"Seperti baru",
    good:"Kondisi baik",
    fair:"Bekas pemakaian",
    poor:"Ada kerusakan",
    very_poor:"Kurang baik"
  })[value]||value||"";
}

function setupAccount(){
  const user=getUser();
  const accountButton=document.getElementById("accountButton");
  const accountAvatar=document.getElementById("accountAvatar");

  if(!user)return;

  accountButton.href="profile.html";

  const photo=convertDriveImage(user.foto_profile||"");

  if(photo){
    accountAvatar.innerHTML=
      `<img src="${photo}" alt="${escapeHtml(user.username||user.nama_lengkap||"Akun")}">`;
    return;
  }

  const initial=String(user.username||user.nama_lengkap||"A")
    .charAt(0)
    .toUpperCase();

  accountAvatar.innerHTML=`<strong>${escapeHtml(initial)}</strong>`;
}

function renderProductCard(product){
  const image=convertDriveImage(product.image_url||"");

  const imageHtml=image
    ? `<img src="${image}" alt="${escapeHtml(product.nama_produk||"Produk")}" loading="lazy">`
    : `<div class="product-image-placeholder">Foto tidak tersedia</div>`;

  const condition=formatCondition(product.kondisi);

  return `
    <a href="product-detail.html?id=${encodeURIComponent(product.product_id)}" class="product-card">
      <div class="product-image">
        ${imageHtml}

        ${condition
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
        <h3>${escapeHtml(product.nama_produk||"Produk")}</h3>
        <strong>${formatRupiah(product.harga)}</strong>

        <div class="product-footer">
          <span>${escapeHtml(product.ship_from_region||"Lokasi belum tersedia")}</span>
          <span>Stok ${Number(product.stok||0)}</span>
        </div>
      </div>
    </a>
  `;
}

function renderProducts(data){
  if(!data.length){
    productGrid.innerHTML=`
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

  productGrid.innerHTML=data.map(renderProductCard).join("");
}

async function loadProducts(){
  try{
    const response=await fetch(
      API_URL+"?t="+Date.now(),
      {
        method:"POST",
        redirect:"follow",
        headers:{
          "Content-Type":"text/plain;charset=utf-8"
        },
        body:JSON.stringify({
          action:"getLatestProducts"
        })
      }
    );

    const text=await response.text();
    const result=JSON.parse(text);

    if(result.status!=="success"||!Array.isArray(result.products)){
      throw new Error(result.message||"Produk gagal dimuat");
    }

    products=result.products;
    renderProducts(products);

    const heroProductCount=document.getElementById("heroProductCount");
    if(heroProductCount){
      heroProductCount.textContent=products.length;
    }

  }catch(error){
    productGrid.innerHTML=`
      <div class="empty-state">
        <strong>Produk belum dapat dimuat</strong>
        <p>${escapeHtml(error.message||"Silakan muat ulang halaman.")}</p>
        <button type="button" onclick="loadProducts()">Muat ulang</button>
      </div>
    `;
  }
}

function openNotification(){
  notificationPanel.classList.add("active");
  notificationPanel.setAttribute("aria-hidden","false");
  document.body.classList.add("panel-open");
}

function closeNotification(){
  notificationPanel.classList.remove("active");
  notificationPanel.setAttribute("aria-hidden","true");
  document.body.classList.remove("panel-open");
}

searchInput.addEventListener("input",()=>{
  const keyword=searchInput.value.trim().toLowerCase();

  if(!keyword){
    renderProducts(products);
    return;
  }

  renderProducts(
    products.filter(product=>{
      return [
        product.nama_produk,
        product.brand,
        product.ship_from_region,
        product.kondisi
      ]
      .some(value=>
        String(value||"").toLowerCase().includes(keyword)
      );
    })
  );
});

document.getElementById("notificationButton").onclick=openNotification;
document.getElementById("closeNotification").onclick=closeNotification;
document.getElementById("notificationBackdrop").onclick=closeNotification;

window.addEventListener("scroll",()=>{
  topHeader.classList.toggle("scrolled",window.scrollY>8);
},{passive:true});

setupAccount();
loadProducts();
