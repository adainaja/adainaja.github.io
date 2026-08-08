const BUCKET="product-images";
const ordersList=document.getElementById("ordersList"),searchInput=document.getElementById("searchInput"),sortSelect=document.getElementById("sortSelect"),statusTabs=document.getElementById("statusTabs"),resultCount=document.getElementById("resultCount"),refreshButton=document.getElementById("refreshButton"),trackingSheet=document.getElementById("trackingSheet"),trackingContent=document.getElementById("trackingContent"),toast=document.getElementById("toast");
let currentUser=null,orders=[],activeStatus="all",toastTimer=null,realtimeChannel=null;

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const money=v=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
function date(v){if(!v)return"-";const d=new Date(v);return isNaN(d)?"-":new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)}
const orderNo=id=>`ADA-${String(id||"").replaceAll("-","").slice(0,10).toUpperCase()}`;
const lower=v=>String(v||"").toLowerCase();
function effectiveStatus(o){
  const orderStatus=lower(o?.status);
  const paymentStatus=lower(o?.payment_status);
  const txStatus=lower(o?.payment?.transaction_status);
  const shipmentStatus=lower(o?.shipment?.status);

  if(["cancelled","canceled","expired","failed","deny","denied","refunded","refund"].includes(orderStatus) ||
     ["expire","expired","cancel","cancelled","deny","denied","failure","failed","refund","refunded","partial_refund"].includes(txStatus)){
    return "cancelled";
  }
  if(orderStatus==="completed") return "completed";
  if(["delivered","completed"].includes(shipmentStatus) || orderStatus==="delivered") return "delivered";
  if(["shipped","in_transit","picked_up","pickup","on_delivery","out_for_delivery"].includes(shipmentStatus) || orderStatus==="shipped") return "shipped";
  if(["processing","confirmed","ready_to_ship","packed"].includes(orderStatus)) return "processing";

  const paidByOrder=["paid","settlement","capture","success","successful"].includes(paymentStatus);
  const paidByMidtrans=txStatus==="settlement" || (txStatus==="capture" && lower(o?.payment?.fraud_status)!=="challenge");
  if(paidByOrder || paidByMidtrans || orderStatus==="paid") return "processing";

  return "pending_payment";
}
const norm=s=>({paid:"processing",delivered:"shipped",refunded:"cancelled"})[lower(s)]||lower(s);
function statusInfo(s){return({pending_payment:["Belum Bayar","status-pending"],processing:["Diproses","status-processing"],shipped:["Dikirim","status-shipped"],delivered:["Sudah Sampai","status-delivered"],completed:["Selesai","status-completed"],cancelled:["Dibatalkan","status-cancelled"]})[lower(s)]||[s||"-","status-pending"]}
function paymentLabel(o){
  const tx=lower(o?.payment?.transaction_status);
  const st=effectiveStatus(o);
  if(st==="cancelled") return tx==="refund"||tx==="refunded"?"Dana dikembalikan":"Pembayaran dibatalkan";
  if(["processing","shipped","delivered","completed"].includes(st)) return o?.payment?.payment_method||"Pembayaran berhasil";
  return o?.payment?.payment_method||"Pembayaran belum dipilih";
}
function publicUrl(path){if(!path)return"";return window.adaajaSupabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl||""}
function showToast(m){toast.textContent=m;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2200)}
async function requireUser(){const u=await window.AdaAjaAuth.getCurrentUser();if(!u){localStorage.setItem("redirectAfterLogin","my-orders.html");location.replace("login.html");return null}currentUser=u;return u}
function loading(){ordersList.innerHTML='<article class="skeleton-card shimmer"></article><article class="skeleton-card shimmer"></article>';resultCount.textContent="Memuat..."}
function errorState(m){ordersList.innerHTML=`<section class="empty-state"><span class="empty-icon">!</span><strong>Pembelian belum dapat dimuat</strong><p>${esc(m)}</p><button class="retry-button" id="retryButton">Muat ulang</button></section>`;document.getElementById("retryButton")?.addEventListener("click",loadOrders)}

async function loadOrders(){
 const u=await requireUser();if(!u)return;loading();
 try{
  const {data,error}=await window.adaajaSupabase.from("orders").select("*").eq("buyer_id",u.id).order("created_at",{ascending:false});if(error)throw error;
  const raw=data||[],ids=raw.map(x=>x.id);
  const [itemsRes,payRes,shipRes,sellerRes]=await Promise.all([
   ids.length?window.adaajaSupabase.from("order_items").select("*").in("order_id",ids):Promise.resolve({data:[]}),
   ids.length?window.adaajaSupabase.from("payments").select("order_id,transaction_status,payment_method,gross_amount,paid_at,fraud_status,created_at").in("order_id",ids).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
   ids.length?window.adaajaSupabase.from("shipments").select("id,order_id,courier_code,courier_name,courier_service,tracking_number,status,estimated_delivery_at").in("order_id",ids):Promise.resolve({data:[]}),
   raw.length?window.adaajaSupabase.from("profiles").select("id,username,full_name").in("id",[...new Set(raw.map(x=>x.seller_id))]):Promise.resolve({data:[]})
  ]);
  for(const r of [itemsRes,payRes,shipRes,sellerRes])if(r.error)console.warn(r.error);
  const items=itemsRes.data||[],productIds=[...new Set(items.map(x=>x.product_id).filter(Boolean))];
  const prodRes=productIds.length?await window.adaajaSupabase.from("products").select("id,name,unit,product_images(storage_path,sort_order,is_cover)").in("id",productIds):{data:[]};
  const prodMap=new Map((prodRes.data||[]).map(p=>{const imgs=[...(p.product_images||[])].sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));const cover=imgs.find(i=>i.is_cover)||imgs[0];return[p.id,{...p,cover:cover?.storage_path||""}]}));
  const itemMap=new Map();items.forEach(i=>{if(!itemMap.has(i.order_id))itemMap.set(i.order_id,[]);itemMap.get(i.order_id).push({...i,product:prodMap.get(i.product_id)||null})});
  const payMap=new Map();(payRes.data||[]).forEach(x=>{if(!payMap.has(x.order_id))payMap.set(x.order_id,x)});const shipMap=new Map((shipRes.data||[]).map(x=>[x.order_id,x])),sellerMap=new Map((sellerRes.data||[]).map(x=>[x.id,x.username||x.full_name||"Penjual AdaAja"]));
  orders=raw.map(o=>({...o,items:itemMap.get(o.id)||[],payment:payMap.get(o.id)||null,shipment:shipMap.get(o.id)||null,seller_name:sellerMap.get(o.seller_id)||"Penjual AdaAja"}));
  stats();render();subscribe();
 }catch(e){console.error(e);errorState(e.message||"Gagal memuat pembelian.")}
}
function stats(){
 const states=orders.map(effectiveStatus);
 document.getElementById("activeCount").textContent=states.filter(s=>["pending_payment","processing","shipped","delivered"].includes(s)).length;
 document.getElementById("shippedCount").textContent=states.filter(s=>["shipped","delivered"].includes(s)).length;
 document.getElementById("completedCount").textContent=states.filter(s=>s==="completed").length;
}
function filtered(){const q=searchInput.value.trim().toLowerCase();let d=orders.filter(o=>(activeStatus==="all"||norm(effectiveStatus(o))===activeStatus)&&(!q||[o.id,orderNo(o.id),o.seller_name,...o.items.map(i=>i.product_name||i.product?.name||""),o.shipment?.tracking_number].some(v=>String(v||"").toLowerCase().includes(q))));if(sortSelect.value==="oldest")d.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));else if(sortSelect.value==="total_high")d.sort((a,b)=>Number(b.total)-Number(a.total));else if(sortSelect.value==="total_low")d.sort((a,b)=>Number(a.total)-Number(b.total));else d.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));return d}
function card(o){
 const displayStatus=effectiveStatus(o),[label,klass]=statusInfo(displayStatus),i=o.items[0]||{},p=i.product||{},img=publicUrl(p.cover||""),qty=Number(i.quantity||1),unit=i.unit||p.unit||"pcs",name=i.product_name||p.name||"Produk",track=o.shipment?.tracking_number||o.tracking_number||"";
 return `<article class="order-card">
 <div class="order-head"><div><strong class="order-number">${esc(orderNo(o.id))}</strong><span class="order-date">${esc(date(o.created_at))}</span></div><span class="status-badge ${klass}">${esc(label)}</span></div>
 <div class="order-product"><div class="order-thumb">${img?`<img src="${esc(img)}" alt="${esc(name)}">`:'<div class="order-thumb-placeholder">Foto tidak tersedia</div>'}</div><div class="order-product-copy"><h3>${esc(name)}</h3><div class="seller-name">${esc(o.seller_name)}</div><div class="item-meta"><span class="accent">${qty} ${esc(unit)}</span>${o.items.length>1?`<span>+${o.items.length-1} produk lain</span>`:""}${track?`<span>Resi ${esc(track)}</span>`:""}</div></div></div>
 <div class="order-summary"><div><span>${o.items.length||1} produk</span><strong>${esc(paymentLabel(o))}</strong></div><div class="total"><span>Total pembayaran</span><strong>${money(o.total)}</strong></div></div>
 <div class="order-actions"><a class="secondary" href="${i.product_id?`product-detail.html?id=${encodeURIComponent(i.product_id)}`:"explore.html"}">Lihat Produk</a>${o.shipment?.id&&["shipped","delivered","completed"].includes(displayStatus)?`<button class="primary track-button" data-order-id="${esc(o.id)}">Lacak Paket</button>`:""}</div>
 </article>`}
function render(){const d=filtered();resultCount.textContent=`${d.length} pembelian`;if(!d.length){ordersList.innerHTML=`<section class="empty-state"><span class="empty-icon">□</span><strong>${activeStatus!=="all"||searchInput.value?"Tidak ada pembelian yang cocok":"Belum ada pembelian"}</strong><p>${activeStatus!=="all"||searchInput.value?"Coba ubah pencarian atau status.":"Produk yang Anda beli akan tampil di halaman ini."}</p><a href="explore.html">Mulai Belanja</a></section>`;return}ordersList.innerHTML=d.map(card).join("");ordersList.querySelectorAll(".track-button").forEach(b=>b.onclick=()=>openTracking(b.dataset.orderId))}
async function openTracking(id){const o=orders.find(x=>x.id===id);if(!o?.shipment?.id)return showToast("Data pengiriman belum tersedia.");trackingSheet.classList.add("active");document.body.classList.add("sheet-open");trackingContent.innerHTML=`<div class="tracking-summary"><span>${esc(o.shipment.courier_name||o.shipment.courier_code||"KURIR")}</span><strong>${esc(o.shipment.tracking_number||"Resi belum tersedia")}</strong><small>${esc(o.shipment.courier_service||"Layanan pengiriman")}</small></div><div class="timeline"><div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-copy"><strong>Memuat perjalanan paket...</strong></div></div></div>`;
 const {data,error}=await window.adaajaSupabase.from("shipment_tracking").select("status,description,location,event_time,created_at").eq("shipment_id",o.shipment.id).order("event_time",{ascending:false});if(error)return trackingContent.insertAdjacentHTML("beforeend",`<p>${esc(error.message)}</p>`);const rows=data||[];trackingContent.innerHTML+=rows.length?`<div class="timeline">${rows.map(r=>`<div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-copy"><strong>${esc(r.description||r.status||"Pembaruan")}</strong>${r.location?`<span>${esc(r.location)}</span>`:""}<small>${esc(date(r.event_time||r.created_at))}</small></div></div>`).join("")}</div>`:'<section class="empty-state"><strong>Belum ada riwayat perjalanan</strong><p>Pembaruan dari kurir akan tampil otomatis.</p></section>'}
function closeTracking(){trackingSheet.classList.remove("active");document.body.classList.remove("sheet-open")}
function subscribe(){if(!currentUser)return;if(realtimeChannel)window.adaajaSupabase.removeChannel(realtimeChannel);realtimeChannel=window.adaajaSupabase.channel(`buyer-orders-${currentUser.id}`).on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`buyer_id=eq.${currentUser.id}`},loadOrders).on("postgres_changes",{event:"*",schema:"public",table:"shipments",filter:`buyer_id=eq.${currentUser.id}`},loadOrders).subscribe()}
searchInput.oninput=render;sortSelect.onchange=render;statusTabs.querySelectorAll("button").forEach(b=>b.onclick=()=>{activeStatus=b.dataset.status;statusTabs.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));render()});refreshButton.onclick=async()=>{refreshButton.disabled=true;await loadOrders();refreshButton.disabled=false;showToast("Pembelian diperbarui.")};document.getElementById("trackingBackdrop").onclick=closeTracking;document.getElementById("closeTracking").onclick=closeTracking;window.adaajaSupabase.auth.onAuthStateChange((e,s)=>{if(e==="SIGNED_OUT"||!s?.user)location.replace("login.html")});window.addEventListener("beforeunload",()=>{if(realtimeChannel)window.adaajaSupabase.removeChannel(realtimeChannel)});loadOrders();
