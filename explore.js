const ADAAJA_CATEGORIES = {
  all: "Semua produk",
  electronics: "Elektronik",
  fashion: "Fashion",
  home: "Rumah Tangga",
  automotive: "Otomotif",
  beauty: "Kecantikan",
  hobby: "Hobi & Koleksi",
  baby: "Bayi & Anak",
  books: "Buku",
  sports: "Olahraga",
  food: "Makanan & Minuman",
  pets: "Hewan Peliharaan",
  services: "Jasa",
  property: "Properti",
  event: "Event & Tiket",
  other: "Lainnya"
};

const LEGACY_CATEGORY_MAP = {
  CAT_ELEKTRONIK: "electronics",
  CAT_FASHION: "fashion",
  CAT_RUMAH: "home",
  CAT_KENDARAAN: "automotive",
  CAT_MAKANAN: "food",
  CAT_JASA: "services",
  CAT_EVENT: "event",
  CAT_LAINNYA: "other",
  CAT_BARANG: "other"
};

const API_URL="https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const productGrid=document.getElementById("productGrid");
const searchInput=document.getElementById("searchInput");
const topHeader=document.getElementById("topHeader");
const notificationPanel=document.getElementById("notificationPanel");
const filterPanel=document.getElementById("filterPanel");
const accountPanel=document.getElementById("accountPanel");
const resultTitle=document.getElementById("resultTitle");
const resultCount=document.getElementById("resultCount");
const sortSelect=document.getElementById("sortSelect");

let products=[];
let activeCategory="all";
let activeCondition="all";
let minPrice=0;
let maxPrice=Infinity;

function getUser(){try{return JSON.parse(localStorage.getItem("user")||"null");}catch{return null;}}
function escapeHtml(value){return String(value||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function formatRupiah(value){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value||0));}
function convertDriveImage(url){if(!url)return"";if(url.includes("drive.google.com")){const id=url.match(/[-\w]{25,}/);if(id)return "https://drive.google.com/thumbnail?id="+id[0]+"&sz=w700";}return url;}
function normalizeCondition(value) {
  const condition = String(value || "").trim().toLowerCase();

  if (!condition) return "";

  if (condition === "baru" || condition === "new") {
    return "baru";
  }

  if (
    condition === "bekas" ||
    ["like_new", "good", "fair", "poor", "very_poor"].includes(condition)
  ) {
    return "bekas";
  }

  return condition;
}

function formatCondition(value) {
  const condition = normalizeCondition(value);

  if (condition === "baru") return "Baru";
  if (condition === "bekas") return "Bekas";

  return "";
}
function categoryLabel(value){
  return ADAAJA_CATEGORIES[value] || "Semua produk";
}

function normalizeCategory(product){
  const raw = String(
    product.category_id ||
    product.category_slug ||
    product.kategori_slug ||
    product.category ||
    product.kategori ||
    ""
  ).trim();

  if (!raw) return "";

  return LEGACY_CATEGORY_MAP[raw.toUpperCase()] ||
    raw.toLowerCase().replaceAll(" ", "_");
}

function setupAccount(){const user=getUser();const accountAvatar=document.getElementById("accountAvatar");if(!user)return;const photo=convertDriveImage(user.foto_profile||"");if(photo){accountAvatar.innerHTML=`<img src="${photo}" alt="${escapeHtml(user.username||user.nama_lengkap||"Akun")}">`;return;}const initial=String(user.username||user.nama_lengkap||"A").charAt(0).toUpperCase();accountAvatar.innerHTML=`<strong>${escapeHtml(initial)}</strong>`;}

function renderProductCard(product){const image=convertDriveImage(product.image_url||"");const imageHtml=image?`<img src="${image}" alt="${escapeHtml(product.nama_produk||"Produk")}" loading="lazy">`:`<div class="product-image-placeholder">Foto tidak tersedia</div>`;const condition=formatCondition(product.kondisi);return `<a href="product-detail.html?id=${encodeURIComponent(product.product_id||"")}" class="product-card"><div class="product-image">${imageHtml}${condition?`<span class="product-condition">${escapeHtml(condition)}</span>`:""}<span class="favorite-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"></path></svg></span></div><div class="product-body"><h3>${escapeHtml(product.nama_produk||"Produk")}</h3><strong>${formatRupiah(product.harga)}</strong><div class="product-footer"><span>${escapeHtml(product.ship_from_region||"Lokasi belum tersedia")}</span><span>Stok ${Number(product.stok||0)}</span></div></div></a>`;}

function getFilteredProducts(){const keyword=searchInput.value.trim().toLowerCase();let data=products.filter(product=>{const price=Number(product.harga||0);const categoryMatch=activeCategory==="all"||normalizeCategory(product)===activeCategory;const conditionMatch=activeCondition==="all"||normalizeCondition(product.kondisi)===activeCondition;const priceMatch=price>=minPrice&&price<=maxPrice;const searchMatch=!keyword||[product.nama_produk,product.brand,product.ship_from_region,normalizeCondition(product.kondisi),formatCondition(product.kondisi),product.category_id,product.category,product.kategori].some(value=>String(value||"").toLowerCase().includes(keyword));return categoryMatch&&conditionMatch&&priceMatch&&searchMatch;});
  if(sortSelect.value==="price_low")data.sort((a,b)=>Number(a.harga||0)-Number(b.harga||0));
  if(sortSelect.value==="price_high")data.sort((a,b)=>Number(b.harga||0)-Number(a.harga||0));
  if(sortSelect.value==="stock")data.sort((a,b)=>Number(b.stok||0)-Number(a.stok||0));
  return data;
}

function renderProducts(){const data=getFilteredProducts();resultTitle.textContent=searchInput.value.trim()?`Hasil pencarian`:categoryLabel(activeCategory);resultCount.textContent=`${data.length} produk ditemukan`;
  if(!data.length){const hasFilters=searchInput.value.trim()||activeCategory!=="all"||activeCondition!=="all"||minPrice>0||maxPrice!==Infinity;productGrid.innerHTML=`<div class="search-empty"><span class="empty-icon"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg></span><strong>${hasFilters?"Produk tidak ditemukan":"Belum ada produk"}</strong><p>${hasFilters?"Coba ubah kata pencarian, kategori, atau filter yang digunakan.":"Produk terbaru dari pengguna akan muncul di halaman ini."}</p>${hasFilters?`<button type="button" id="clearAllButton">Hapus pencarian & filter</button>`:`<a href="upload.html">Jual produk pertama</a>`}</div>`;document.getElementById("clearAllButton")?.addEventListener("click",resetAll);return;}
  productGrid.innerHTML=data.map(renderProductCard).join("");
}

async function loadProducts(){try{const response=await fetch(API_URL+"?t="+Date.now(),{method:"POST",redirect:"follow",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"getLatestProducts"})});const result=JSON.parse(await response.text());if(result.status!=="success"||!Array.isArray(result.products))throw new Error(result.message||"Produk gagal dimuat");products=result.products;renderProducts();}catch(error){resultCount.textContent="Gagal memuat";productGrid.innerHTML=`<div class="search-empty"><strong>Produk belum dapat dimuat</strong><p>${escapeHtml(error.message||"Silakan muat ulang halaman.")}</p><button type="button" id="reloadButton">Muat ulang</button></div>`;document.getElementById("reloadButton").onclick=loadProducts;}}

function openPanel(panel){panel.classList.add("active");panel.setAttribute("aria-hidden","false");document.body.classList.add("panel-open");}
function closePanel(panel){panel.classList.remove("active");panel.setAttribute("aria-hidden","true");if(!document.querySelector(".notification-panel.active,.filter-panel.active,.account-panel.active"))document.body.classList.remove("panel-open");}

function openAccountPanel(){openPanel(accountPanel);}
function closeAccountPanel(){closePanel(accountPanel);}
function handleAccountClick(){
  if(getUser()){
    window.location.href="profile.html";
    return;
  }
  openAccountPanel();
}

function selectCategory(category){activeCategory=category;document.querySelectorAll(".category-chip").forEach(button=>button.classList.toggle("active",button.dataset.category===category));const url=new URL(location.href);category==="all"?url.searchParams.delete("category"):url.searchParams.set("category",category);history.replaceState({},"",url);renderProducts();}
function updateFilterIndicator(){document.getElementById("filterButton").classList.toggle("has-filter",activeCondition!=="all"||minPrice>0||maxPrice!==Infinity);}
function resetAll(){searchInput.value="";activeCondition="all";minPrice=0;maxPrice=Infinity;document.getElementById("minPrice").value="";document.getElementById("maxPrice").value="";sortSelect.value="latest";document.querySelectorAll("[data-condition]").forEach(button=>button.classList.toggle("selected",button.dataset.condition==="all"));selectCategory("all");updateFilterIndicator();}

document.querySelectorAll(".category-chip").forEach(button=>button.addEventListener("click",()=>selectCategory(button.dataset.category)));
document.querySelectorAll("[data-condition]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-condition]").forEach(item=>item.classList.remove("selected"));button.classList.add("selected");activeCondition=button.dataset.condition;}));
searchInput.addEventListener("input",renderProducts);sortSelect.addEventListener("change",renderProducts);
document.getElementById("notificationButton").onclick=()=>openPanel(notificationPanel);
document.getElementById("accountButton").onclick=handleAccountClick;
document.getElementById("closeAccountPanel").onclick=closeAccountPanel;
document.getElementById("accountBackdrop").onclick=closeAccountPanel;document.getElementById("closeNotification").onclick=()=>closePanel(notificationPanel);document.getElementById("notificationBackdrop").onclick=()=>closePanel(notificationPanel);
document.getElementById("filterButton").onclick=()=>openPanel(filterPanel);document.getElementById("closeFilter").onclick=()=>closePanel(filterPanel);document.getElementById("filterBackdrop").onclick=()=>closePanel(filterPanel);
document.getElementById("applyFilter").onclick=()=>{minPrice=Math.max(0,Number(document.getElementById("minPrice").value||0));const max=Number(document.getElementById("maxPrice").value||0);maxPrice=max>0?max:Infinity;if(maxPrice<minPrice){[minPrice,maxPrice]=[maxPrice,minPrice];document.getElementById("minPrice").value=minPrice;document.getElementById("maxPrice").value=maxPrice;}updateFilterIndicator();closePanel(filterPanel);renderProducts();};
document.getElementById("resetFilter").onclick=()=>{activeCondition="all";minPrice=0;maxPrice=Infinity;document.getElementById("minPrice").value="";document.getElementById("maxPrice").value="";document.querySelectorAll("[data-condition]").forEach(button=>button.classList.toggle("selected",button.dataset.condition==="all"));updateFilterIndicator();renderProducts();};
document.getElementById("nearbyButton").onclick=()=>{searchInput.value=getUser()?.kota||"";searchInput.focus();renderProducts();};
window.addEventListener("scroll",()=>topHeader.classList.toggle("scrolled",window.scrollY>8),{passive:true});


/* Login wajib untuk seluruh tautan menuju halaman jual produk. */
function setupSellAuthGuard(){
  document.addEventListener("click",event=>{
    const sellLink=event.target.closest('a[href]');
    if(!sellLink)return;

    const destination=new URL(sellLink.href,window.location.href);
    const isUploadPage=destination.pathname.toLowerCase().endsWith("/upload.html");
    if(!isUploadPage||getUser())return;

    event.preventDefault();
    localStorage.setItem(
      "redirectAfterLogin",
      destination.pathname.split("/").pop()+destination.search+destination.hash
    );
    window.location.href="login.html";
  });
}

const initialCategory=new URLSearchParams(location.search).get("category")||"all";
if(document.querySelector(`[data-category="${CSS.escape(initialCategory)}"]`))selectCategory(initialCategory);
setupAccount();
setupSellAuthGuard();
loadProducts();
