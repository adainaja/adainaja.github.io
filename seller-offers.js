const BUCKET="product-images";
const list=document.getElementById("offersList"),searchInput=document.getElementById("searchInput"),sortSelect=document.getElementById("sortSelect"),statusTabs=document.getElementById("statusTabs"),resultCount=document.getElementById("resultCount"),refreshButton=document.getElementById("refreshButton"),counterSheet=document.getElementById("counterSheet"),counterSummary=document.getElementById("counterSummary"),counterPriceInput=document.getElementById("counterPriceInput"),counterHint=document.getElementById("counterHint"),counterMessage=document.getElementById("counterMessage"),submitCounterButton=document.getElementById("submitCounterButton"),toast=document.getElementById("toast");
let currentUser=null,offers=[],activeStatus="all",counterOffer=null,realtimeChannel=null,toastTimer=null;

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const money=v=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
function date(v){if(!v)return"-";const d=new Date(v);if(Number.isNaN(d.getTime()))return"-";return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)}
function statusInfo(v){const s=String(v||"").toLowerCase();return{pending:["Menunggu","status-pending"],countered:["Harga Balasan","status-countered"],accepted:["Disetujui","status-accepted"],rejected:["Ditolak","status-rejected"],expired:["Kedaluwarsa","status-ended"],cancelled:["Dibatalkan","status-ended"]}[s]||[s||"-","status-pending"]}
function statusGroup(v){const s=String(v||"").toLowerCase();return["expired","cancelled"].includes(s)?"ended":s}
function publicUrl(path){if(!path)return"";return window.adaajaSupabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl||""}
function showToast(m){toast.textContent=m;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2200)}
async function requireUser(){const u=await window.AdaAjaAuth.getCurrentUser();if(!u){localStorage.setItem("redirectAfterLogin","seller-offers.html");location.replace("login.html");return null}currentUser=u;return u}
function loading(){resultCount.textContent="Memuat...";list.innerHTML='<article class="skeleton-card shimmer"></article><article class="skeleton-card shimmer"></article>'}

async function loadOffers(){
  const u=await requireUser();if(!u)return;loading();
  try{
    const {data:rawOffers,error}=await window.adaajaSupabase.from("offers").select("id,product_id,buyer_id,seller_id,original_price,offered_price,counter_price,status,expires_at,created_at,updated_at").eq("seller_id",u.id).order("created_at",{ascending:false});
    if(error)throw error;
    const rows=rawOffers||[],productIds=[...new Set(rows.map(x=>x.product_id).filter(Boolean))],buyerIds=[...new Set(rows.map(x=>x.buyer_id).filter(Boolean))];
    const [productsRes,buyersRes]=await Promise.all([
      productIds.length?window.adaajaSupabase.from("products").select("id,name,price,stock,unit,minimum_order,status,product_images(storage_path,sort_order,is_cover)").in("id",productIds):Promise.resolve({data:[]}),
      buyerIds.length?window.adaajaSupabase.from("profiles").select("id,username,full_name,avatar_url").in("id",buyerIds):Promise.resolve({data:[]})
    ]);
    const pmap=new Map((productsRes.data||[]).map(p=>{const imgs=[...(p.product_images||[])].sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));const cover=imgs.find(i=>i.is_cover)||imgs[0];return[p.id,{...p,cover_path:cover?.storage_path||""}]}));
    const bmap=new Map((buyersRes.data||[]).map(b=>[b.id,{name:b.username||b.full_name||"Pembeli AdaAja",avatar_url:b.avatar_url||""}]));
    offers=rows.map(o=>({...o,product:pmap.get(o.product_id)||null,buyer:bmap.get(o.buyer_id)||{name:"Pembeli AdaAja",avatar_url:""}}));
    updateStats();renderOffers();subscribeRealtime();
  }catch(e){console.error(e);list.innerHTML=`<section class="empty-state"><strong>Penawaran belum dapat dimuat</strong><p>${esc(e.message||"Silakan coba kembali.")}</p></section>`}
}

function updateStats(){
  document.getElementById("pendingCount").textContent=offers.filter(o=>String(o.status||"").toLowerCase()==="pending").length;
  document.getElementById("counteredCount").textContent=offers.filter(o=>String(o.status||"").toLowerCase()==="countered").length;
  document.getElementById("acceptedCount").textContent=offers.filter(o=>String(o.status||"").toLowerCase()==="accepted").length;
}
function filtered(){
  const q=searchInput.value.trim().toLowerCase();
  let d=offers.filter(o=>(activeStatus==="all"||statusGroup(o.status)===activeStatus)&&(!q||[o.product?.name,o.buyer?.name,o.id].some(v=>String(v||"").toLowerCase().includes(q))));
  if(sortSelect.value==="oldest")d.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  else if(sortSelect.value==="offer_high")d.sort((a,b)=>Number(b.offered_price)-Number(a.offered_price));
  else if(sortSelect.value==="offer_low")d.sort((a,b)=>Number(a.offered_price)-Number(b.offered_price));
  else d.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  return d;
}
function noteForStatus(s){return{pending:["pending","Pembeli sedang menunggu keputusan Anda."],countered:["countered","Harga balasan sudah dikirim. Menunggu keputusan pembeli."],accepted:["accepted","Penawaran sudah disetujui."],rejected:["rejected","Penawaran ini sudah ditolak."],expired:["ended","Masa berlaku penawaran telah berakhir."],cancelled:["ended","Penawaran dibatalkan pembeli."]}[String(s||"").toLowerCase()]||["pending","Status penawaran diperbarui."]}

function card(o){
  const [label,cls]=statusInfo(o.status),[noteCls,note]=noteForStatus(o.status),p=o.product||{},img=publicUrl(p.cover_path||""),s=String(o.status||"").toLowerCase();
  const priceBoxes=[`<div class="price-box"><span>Harga produk</span><strong>${money(o.original_price||p.price)}</strong></div>`,`<div class="price-box accent"><span>Penawaran pembeli</span><strong>${money(o.offered_price)}</strong></div>`];
  if(Number(o.counter_price||0)>0)priceBoxes.push(`<div class="price-box counter"><span>Harga balasan Anda</span><strong>${money(o.counter_price)}</strong></div>`);
  let actions="";
  if(s==="pending")actions=`<button class="reject action-reject" data-id="${esc(o.id)}">Tolak</button><button class="counter action-counter" data-id="${esc(o.id)}">Harga Balasan</button><button class="accept action-accept" data-id="${esc(o.id)}">Terima</button>`;
  else if(s==="countered")actions=`<button class="secondary">Menunggu Pembeli</button><button class="counter action-counter wide" data-id="${esc(o.id)}">Ubah Harga Balasan</button>`;
  else actions=`<a class="secondary wide" href="product-detail.html?id=${encodeURIComponent(o.product_id)}">Lihat Produk</a>`;
  return `<article class="offer-card ${s==="pending"?"urgent":""}"><div class="offer-head"><div><strong class="offer-id">NEG-${esc(String(o.id).replaceAll("-","").slice(0,8).toUpperCase())}</strong><span class="offer-date">${esc(date(o.created_at))}</span></div><span class="status-badge ${cls}">${esc(label)}</span></div><div class="offer-product"><div class="offer-thumb">${img?`<img src="${esc(img)}" alt="${esc(p.name||"Produk")}">`:'<div class="offer-thumb-placeholder">Foto tidak tersedia</div>'}</div><div class="offer-copy"><h3>${esc(p.name||"Produk")}</h3><div class="buyer-name">Pembeli: ${esc(o.buyer?.name||"Pembeli AdaAja")}</div><div class="price-grid">${priceBoxes.join("")}</div></div></div><div class="offer-note ${noteCls}">${esc(note)}</div><div class="offer-actions">${actions}</div></article>`;
}
function renderOffers(){
  const d=filtered();resultCount.textContent=`${d.length} penawaran`;
  if(!d.length){list.innerHTML='<section class="empty-state"><strong>Belum ada penawaran masuk</strong><p>Saat pembeli mengajukan harga pada produk Anda, penawarannya akan muncul di sini.</p></section>';return}
  list.innerHTML=d.map(card).join("");
  list.querySelectorAll(".action-accept").forEach(b=>b.onclick=()=>acceptOffer(b.dataset.id,b));
  list.querySelectorAll(".action-reject").forEach(b=>b.onclick=()=>rejectOffer(b.dataset.id,b));
  list.querySelectorAll(".action-counter").forEach(b=>b.onclick=()=>openCounter(b.dataset.id));
}

async function notify(userId,title,message,referenceId){
  if(!userId)return;
  const {error}=await window.adaajaSupabase.from("notifications").insert({user_id:userId,type:"offer",title,message,reference_id:referenceId,is_read:false});
  if(error)console.warn("Notifikasi gagal:",error);
}
async function acceptOffer(id,b){
  const o=offers.find(x=>x.id===id);if(!o)return;b.disabled=true;b.textContent="Memproses...";
  try{
    const {error}=await window.adaajaSupabase.from("offers").update({status:"accepted",updated_at:new Date().toISOString()}).eq("id",id).eq("seller_id",currentUser.id);if(error)throw error;
    await notify(o.buyer_id,"Penawaran disetujui",`${o.product?.name||"Produk"} disetujui. Lanjutkan ke checkout.`,o.id);
    showToast("Penawaran berhasil diterima.");await loadOffers();
  }catch(e){showToast(e.message||"Gagal menerima penawaran.")}finally{b.disabled=false;b.textContent="Terima"}
}
async function rejectOffer(id,b){
  const o=offers.find(x=>x.id===id);if(!o)return;b.disabled=true;b.textContent="Memproses...";
  try{
    const {error}=await window.adaajaSupabase.from("offers").update({status:"rejected",updated_at:new Date().toISOString()}).eq("id",id).eq("seller_id",currentUser.id);if(error)throw error;
    await notify(o.buyer_id,"Penawaran ditolak",`Penawaran untuk ${o.product?.name||"produk"} belum disetujui penjual.`,o.id);
    showToast("Penawaran ditolak.");await loadOffers();
  }catch(e){showToast(e.message||"Gagal menolak penawaran.")}finally{b.disabled=false;b.textContent="Tolak"}
}
function openCounter(id){
  counterOffer=offers.find(x=>x.id===id);if(!counterOffer)return;
  counterSummary.innerHTML=`<div><span>Harga produk</span><strong>${money(counterOffer.original_price||counterOffer.product?.price)}</strong></div><div><span>Tawaran pembeli</span><strong>${money(counterOffer.offered_price)}</strong></div>`;
  counterPriceInput.value=counterOffer.counter_price?new Intl.NumberFormat("id-ID").format(counterOffer.counter_price):"";
  counterPriceInput.dataset.value=counterOffer.counter_price||"";
  counterHint.textContent="Masukkan harga balasan di antara tawaran pembeli dan harga produk.";
  counterMessage.textContent="";
  counterSheet.classList.add("active");document.body.classList.add("sheet-open");
}
function closeCounter(){counterSheet.classList.remove("active");document.body.classList.remove("sheet-open");counterOffer=null}
counterPriceInput.oninput=()=>{const n=Number(String(counterPriceInput.value).replace(/[^\d]/g,""))||0;counterPriceInput.dataset.value=n?String(n):"";counterPriceInput.value=n?new Intl.NumberFormat("id-ID").format(n):""};
submitCounterButton.onclick=async()=>{
  if(!counterOffer)return;
  const value=Number(counterPriceInput.dataset.value||0),buyer=Number(counterOffer.offered_price||0),original=Number(counterOffer.original_price||counterOffer.product?.price||0);
  counterMessage.textContent="";
  if(!value){counterMessage.textContent="Masukkan harga balasan.";return}
  if(value<=buyer){counterMessage.textContent="Harga balasan harus lebih tinggi dari tawaran pembeli.";return}
  if(original&&value>original){counterMessage.textContent="Harga balasan tidak boleh melebihi harga produk.";return}
  submitCounterButton.disabled=true;submitCounterButton.textContent="Mengirim...";
  try{
    const {error}=await window.adaajaSupabase.from("offers").update({counter_price:value,status:"countered",updated_at:new Date().toISOString()}).eq("id",counterOffer.id).eq("seller_id",currentUser.id);if(error)throw error;
    await notify(counterOffer.buyer_id,"Harga balasan dari penjual",`${counterOffer.product?.name||"Produk"} mendapat harga balasan ${money(value)}.`,counterOffer.id);
    showToast("Harga balasan berhasil dikirim.");closeCounter();await loadOffers();
  }catch(e){counterMessage.textContent=e.message||"Gagal mengirim harga balasan."}finally{submitCounterButton.disabled=false;submitCounterButton.textContent="Kirim Harga Balasan"}
};

function subscribeRealtime(){
  if(!currentUser)return;
  if(realtimeChannel)window.adaajaSupabase.removeChannel(realtimeChannel);
  realtimeChannel=window.adaajaSupabase.channel(`seller-offers-${currentUser.id}`).on("postgres_changes",{event:"*",schema:"public",table:"offers",filter:`seller_id=eq.${currentUser.id}`},loadOffers).subscribe();
}
searchInput.oninput=renderOffers;sortSelect.onchange=renderOffers;
statusTabs.querySelectorAll("button").forEach(b=>b.onclick=()=>{activeStatus=b.dataset.status;statusTabs.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));renderOffers()});
refreshButton.onclick=async()=>{refreshButton.disabled=true;await loadOffers();refreshButton.disabled=false;showToast("Penawaran diperbarui.")};
document.getElementById("counterSheetBackdrop").onclick=closeCounter;document.getElementById("closeCounterSheet").onclick=closeCounter;
window.adaajaSupabase.auth.onAuthStateChange((e,s)=>{if(e==="SIGNED_OUT"||!s?.user)location.replace("login.html")});
loadOffers();
