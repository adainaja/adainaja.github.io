const BUCKET="product-images";
const ordersList=document.getElementById("ordersList"),searchInput=document.getElementById("searchInput"),sortSelect=document.getElementById("sortSelect"),statusTabs=document.getElementById("statusTabs"),resultCount=document.getElementById("resultCount"),refreshButton=document.getElementById("refreshButton"),trackingSheet=document.getElementById("trackingSheet"),trackingContent=document.getElementById("trackingContent"),confirmReceivedSheet=document.getElementById("confirmReceivedSheet"),confirmOrderPreview=document.getElementById("confirmOrderPreview"),submitConfirmReceived=document.getElementById("submitConfirmReceived"),toast=document.getElementById("toast");
let currentUser=null,orders=[],activeStatus="all",toastTimer=null,realtimeChannel=null,confirmingOrderId=null;

const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const money=v=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
function date(v){if(!v)return"-";const d=new Date(v);return isNaN(d)?"-":new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)}
const orderNo=id=>`ADA-${String(id||"").replaceAll("-","").slice(0,10).toUpperCase()}`;
const lower=v=>String(v||"").toLowerCase();
function effectiveStatus(o){
  const orderStatus=lower(o?.status);
  const fulfillmentStatus=lower(o?.fulfillment_status);
  const paymentStatus=lower(o?.payment_status || o?.payment?.payment_status);
  const txStatus=lower(o?.payment?.transaction_status || o?.transaction_status);
  const shipmentStatus=lower(o?.shipment?.shipment_status || o?.shipment?.status);
  const escrowStatus=lower(o?.escrow_status);
  const buyerConfirmed=Boolean(o?.buyer_confirmed_at);

  if(["cancelled","canceled","expired","failed","deny","denied","refunded","refund"].includes(orderStatus) ||
     ["expire","expired","cancel","cancelled","deny","denied","failure","failed","refund","refunded","partial_refund"].includes(txStatus)){
    return "cancelled";
  }

  // Biteship/provider may already mark the order completed. For marketplace
  // settlement it is not final until buyer confirmation / escrow release.
  const deliveryDone =
    ["delivered","completed"].includes(shipmentStatus) ||
    ["delivered","completed"].includes(fulfillmentStatus) ||
    ["delivered","completed"].includes(orderStatus);

  if(deliveryDone && !buyerConfirmed && escrowStatus==="held"){
    return "delivered";
  }

  if(orderStatus==="completed" || fulfillmentStatus==="completed" || escrowStatus==="released"){
    return "completed";
  }

  if(deliveryDone) return "delivered";

  if(["shipped","in_transit","picked_up","pickup","on_delivery","out_for_delivery"].includes(shipmentStatus) ||
     orderStatus==="shipped" || fulfillmentStatus==="shipped"){
    return "shipped";
  }

  if(["processing","confirmed","ready_to_ship","packed"].includes(orderStatus) ||
     ["processing","ready_to_ship"].includes(fulfillmentStatus)){
    return "processing";
  }

  const paidByOrder=["paid","settlement","capture","success","successful"].includes(paymentStatus);
  const paidByMidtrans=["settlement","success","successful"].includes(txStatus) ||
    (txStatus==="capture" && !["challenge","deny","denied"].includes(lower(o?.payment?.fraud_status)));

  if(paidByOrder || paidByMidtrans || ["paid","settlement","capture"].includes(orderStatus)){
    return "processing";
  }

  return "pending_payment";
}
const norm=s=>({paid:"processing",refunded:"cancelled"})[lower(s)]||lower(s);
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
   ids.length?window.adaajaSupabase.from("payments").select("order_id,payment_status,transaction_status,payment_method,gross_amount,paid_at,fraud_status,created_at").in("order_id",ids).order("created_at",{ascending:false}):Promise.resolve({data:[]}),
   ids.length?window.adaajaSupabase.from("shipments").select("id,order_id,courier_code,courier_name,courier_service,tracking_number,status,shipment_status,provider_status,estimated_delivery_at,picked_up_at,in_transit_at,delivered_at").in("order_id",ids):Promise.resolve({data:[]}),
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
 document.getElementById("shippedCount").textContent=states.filter(s=>s==="shipped").length;
 document.getElementById("completedCount").textContent=states.filter(s=>s==="completed").length;
}
function filtered(){const q=searchInput.value.trim().toLowerCase();let d=orders.filter(o=>(activeStatus==="all"||norm(effectiveStatus(o))===activeStatus)&&(!q||[o.id,orderNo(o.id),o.seller_name,...o.items.map(i=>i.product_name||i.product?.name||""),o.shipment?.tracking_number].some(v=>String(v||"").toLowerCase().includes(q))));if(sortSelect.value==="oldest")d.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));else if(sortSelect.value==="total_high")d.sort((a,b)=>Number(b.total)-Number(a.total));else if(sortSelect.value==="total_low")d.sort((a,b)=>Number(a.total)-Number(b.total));else d.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));return d}
function card(o){
 const displayStatus=effectiveStatus(o),[label,klass]=statusInfo(displayStatus),i=o.items[0]||{},p=i.product||{},img=publicUrl(p.cover||""),qty=Number(i.quantity||1),unit=i.unit||p.unit||"pcs",name=i.product_name||p.name||"Produk",track=o.shipment?.tracking_number||o.tracking_number||"";
 const needsConfirmation=displayStatus==="delivered" && !o.buyer_confirmed_at && lower(o.escrow_status)==="held";
 const released=lower(o.escrow_status)==="released";

 return `<article class="order-card ${needsConfirmation?"awaiting-confirmation":""}">
 <div class="order-head"><div><strong class="order-number">${esc(orderNo(o.id))}</strong><span class="order-date">${esc(date(o.created_at))}</span></div><span class="status-badge ${klass}">${esc(label)}</span></div>
 <div class="order-product"><div class="order-thumb">${img?`<img src="${esc(img)}" alt="${esc(name)}">`:'<div class="order-thumb-placeholder">Foto tidak tersedia</div>'}</div><div class="order-product-copy"><h3>${esc(name)}</h3><div class="seller-name">${esc(o.seller_name)}</div><div class="item-meta"><span class="accent">${qty} ${esc(unit)}</span>${o.items.length>1?`<span>+${o.items.length-1} produk lain</span>`:""}${track?`<span>Resi ${esc(track)}</span>`:""}</div></div></div>

 ${needsConfirmation?`<div class="received-notice"><span class="received-notice-icon">✓</span><div><strong>Paket sudah sampai</strong><small>Periksa barang lalu konfirmasi penerimaan agar transaksi dapat diselesaikan.</small></div></div>`:""}
 ${released?`<div class="completed-notice"><span>✓</span><div><strong>Transaksi selesai</strong><small>Pesanan telah dikonfirmasi dan dana seller sudah dilepas dari escrow.</small></div></div>`:""}

 <div class="order-summary"><div><span>${o.items.length||1} produk</span><strong>${esc(paymentLabel(o))}</strong></div><div class="total"><span>Total pembayaran</span><strong>${money(o.total)}</strong></div></div>

 ${displayStatus==="pending_payment"
   ? `<div class="payment-pending-notice">
        <span class="payment-pending-notice-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v5l3 2"></path>
          </svg>
        </span>
        <div>
          <strong>Menunggu pembayaran</strong>
          <small>Buka detail pembayaran untuk melihat VA, batas waktu, status, atau mengganti metode pembayaran.</small>
        </div>
      </div>`
   : ""}

 <div class="order-actions">
   <a class="secondary" href="${i.product_id?`product-detail.html?id=${encodeURIComponent(i.product_id)}`:"explore.html"}">Lihat Produk</a>

   ${displayStatus==="pending_payment"
     ? `<a class="primary payment-pending-button" href="payment-pending.html?order_id=${encodeURIComponent(o.id)}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16v10H4z"></path>
            <path d="M8 11h8"></path>
            <path d="M8 14h5"></path>
          </svg>
          ${o?.payment?.payment_method ? "Lanjutkan Pembayaran" : "Bayar Sekarang"}
        </a>`
     : ""}

   ${o.shipment?.id&&["shipped","delivered","completed"].includes(displayStatus)?`<button class="secondary track-button" data-order-id="${esc(o.id)}">Lacak Paket</button>`:""}
   ${needsConfirmation?`<button class="primary confirm-received-button" data-order-id="${esc(o.id)}">Pesanan Diterima</button>`:""}
 </div>
 </article>`}
function render(){const d=filtered();resultCount.textContent=`${d.length} pembelian`;if(!d.length){ordersList.innerHTML=`<section class="empty-state"><span class="empty-icon">□</span><strong>${activeStatus!=="all"||searchInput.value?"Tidak ada pembelian yang cocok":"Belum ada pembelian"}</strong><p>${activeStatus!=="all"||searchInput.value?"Coba ubah pencarian atau status.":"Produk yang Anda beli akan tampil di halaman ini."}</p><a href="explore.html">Mulai Belanja</a></section>`;return}ordersList.innerHTML=d.map(card).join("");ordersList.querySelectorAll(".track-button").forEach(b=>b.onclick=()=>openTracking(b.dataset.orderId));
 ordersList.querySelectorAll(".confirm-received-button").forEach(b=>b.onclick=()=>openConfirmReceived(b.dataset.orderId))
}
function openConfirmReceived(id){
 const o=orders.find(x=>x.id===id);
 if(!o)return;
 confirmingOrderId=id;
 const first=o.items?.[0]||{};
 confirmOrderPreview.innerHTML=`<span>${esc(orderNo(o.id))}</span><strong>${esc(first.product_name||first.product?.name||"Pesanan AdaAja")}</strong><small>Total ${money(o.total)}${o.shipment?.tracking_number?` • Resi ${esc(o.shipment.tracking_number)}`:""}</small>`;
 confirmReceivedSheet.classList.add("active");
 confirmReceivedSheet.setAttribute("aria-hidden","false");
 document.body.classList.add("sheet-open");
}
function closeConfirmReceived(){
 confirmingOrderId=null;
 confirmReceivedSheet.classList.remove("active");
 confirmReceivedSheet.setAttribute("aria-hidden","true");
 if(!trackingSheet.classList.contains("active"))document.body.classList.remove("sheet-open");
}
async function confirmOrderReceived(){
 if(!confirmingOrderId||!currentUser)return;
 const id=confirmingOrderId;
 submitConfirmReceived.disabled=true;
 const original=submitConfirmReceived.textContent;
 submitConfirmReceived.textContent="Menyelesaikan...";
 try{
   const {data,error}=await window.adaajaSupabase.rpc("confirm_order_received",{p_order_id:id});
   if(error)throw error;
   if(data!==true)throw new Error("Konfirmasi penerimaan belum berhasil.");
   closeConfirmReceived();
   showToast("Pesanan selesai. Dana penjual telah diproses.");
   await loadOrders();
 }catch(e){
   console.error("Konfirmasi penerimaan gagal:",e);
   showToast(e?.message||"Pesanan belum dapat dikonfirmasi.");
 }finally{
   submitConfirmReceived.disabled=false;
   submitConfirmReceived.textContent=original;
 }
}
async function openTracking(id){const o=orders.find(x=>x.id===id);if(!o?.shipment?.id)return showToast("Data pengiriman belum tersedia.");trackingSheet.classList.add("active");document.body.classList.add("sheet-open");trackingContent.innerHTML=`<div class="tracking-summary"><span>${esc(o.shipment.courier_name||o.shipment.courier_code||"KURIR")}</span><strong>${esc(o.shipment.tracking_number||"Resi belum tersedia")}</strong><small>${esc(o.shipment.courier_service||"Layanan pengiriman")}</small></div><div class="timeline"><div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-copy"><strong>Memuat perjalanan paket...</strong></div></div></div>`;
 const {data,error}=await window.adaajaSupabase.from("shipment_tracking").select("status,description,location,event_time,created_at").eq("shipment_id",o.shipment.id).order("event_time",{ascending:false});if(error)return trackingContent.insertAdjacentHTML("beforeend",`<p>${esc(error.message)}</p>`);const rows=data||[];trackingContent.innerHTML+=rows.length?`<div class="timeline">${rows.map(r=>`<div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-copy"><strong>${esc(r.description||r.status||"Pembaruan")}</strong>${r.location?`<span>${esc(r.location)}</span>`:""}<small>${esc(date(r.event_time||r.created_at))}</small></div></div>`).join("")}</div>`:'<section class="empty-state"><strong>Belum ada riwayat perjalanan</strong><p>Pembaruan dari kurir akan tampil otomatis.</p></section>'}
function closeTracking(){trackingSheet.classList.remove("active");document.body.classList.remove("sheet-open")}
function subscribe(){if(!currentUser)return;if(realtimeChannel)window.adaajaSupabase.removeChannel(realtimeChannel);realtimeChannel=window.adaajaSupabase.channel(`buyer-orders-${currentUser.id}`).on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`buyer_id=eq.${currentUser.id}`},loadOrders).on("postgres_changes",{event:"*",schema:"public",table:"payments"},loadOrders).on("postgres_changes",{event:"*",schema:"public",table:"shipments",filter:`buyer_id=eq.${currentUser.id}`},loadOrders).subscribe()}
searchInput.oninput=render;sortSelect.onchange=render;statusTabs.querySelectorAll("button").forEach(b=>b.onclick=()=>{activeStatus=b.dataset.status;statusTabs.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));render()});refreshButton.onclick=async()=>{refreshButton.disabled=true;await loadOrders();refreshButton.disabled=false;showToast("Pembelian diperbarui.")};document.getElementById("confirmReceivedBackdrop").onclick=closeConfirmReceived;
document.getElementById("cancelConfirmReceived").onclick=closeConfirmReceived;
submitConfirmReceived.onclick=confirmOrderReceived;
document.getElementById("trackingBackdrop").onclick=closeTracking;document.getElementById("closeTracking").onclick=closeTracking;document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeConfirmReceived();closeTracking();}});
window.adaajaSupabase.auth.onAuthStateChange((e,s)=>{if(e==="SIGNED_OUT"||!s?.user)location.replace("login.html")});window.addEventListener("beforeunload",()=>{if(realtimeChannel)window.adaajaSupabase.removeChannel(realtimeChannel)});loadOrders();
