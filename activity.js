const recentActivity=document.getElementById("recentActivity");
const refreshButton=document.getElementById("refreshButton");
const roleSwitch=document.getElementById("roleSwitch");
const buyerPanel=document.getElementById("buyerPanel");
const sellerPanel=document.getElementById("sellerPanel");
const toast=document.getElementById("toast");

let currentUser=null;
let realtimeChannels=[];
let toastTimer=null;

const esc=(value)=>String(value??"")
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;")
  .replaceAll("'","&#039;");

function date(value){
  if(!value)return"-";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return"-";
  return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(d);
}
function relativeDate(value){
  if(!value)return"-";
  const time=new Date(value).getTime();
  const diff=Date.now()-time;
  if(!Number.isFinite(time))return"-";
  if(diff<60000)return"Baru saja";
  if(diff<3600000)return`${Math.floor(diff/60000)} mnt`;
  if(diff<86400000)return`${Math.floor(diff/3600000)} jam`;
  return date(value);
}
function showToast(message){
  toast.textContent=message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove("show"),2200);
}
async function requireUser(){
  const user=await window.AdaAjaAuth.getCurrentUser();
  if(!user){
    localStorage.setItem("redirectAfterLogin","activity.html");
    location.replace("login.html");
    return null;
  }
  currentUser=user;
  return user;
}
function iconForType(type){
  const t=String(type||"").toLowerCase();
  if(t==="offer")return'<svg viewBox="0 0 24 24"><path d="M4 7h16v10H4z"></path><path d="M8 11h8"></path></svg>';
  if(t==="order")return'<svg viewBox="0 0 24 24"><path d="M6 3h12l2 5-8 4-8-4 2-5Z"></path><path d="M4 8v10l8 3 8-3V8"></path></svg>';
  if(t==="message")return'<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5Z"></path></svg>';
  return'<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>';
}
function setRole(role){
  const isSeller=role==="seller";
  buyerPanel.hidden=isSeller;
  sellerPanel.hidden=!isSeller;
  roleSwitch.querySelectorAll(".role-tab").forEach(btn=>{
    const active=btn.dataset.role===role;
    btn.classList.toggle("active",active);
    btn.setAttribute("aria-selected",String(active));
  });
  localStorage.setItem("adaajaActivityRole",role);
}
roleSwitch.querySelectorAll(".role-tab").forEach(btn=>{
  btn.addEventListener("click",()=>setRole(btn.dataset.role));
});

async function loadActivity(){
  const user=await requireUser();
  if(!user)return;

  try{
    const [notificationsRes,buyerOrdersRes,sellerOrdersRes,buyerOffersRes,sellerOffersRes]=await Promise.all([
      window.adaajaSupabase.from("notifications").select("id,type,title,message,is_read,reference_id,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(12),
      window.adaajaSupabase.from("orders").select("id,status,created_at").eq("buyer_id",user.id).order("created_at",{ascending:false}).limit(4),
      window.adaajaSupabase.from("orders").select("id,status,created_at").eq("seller_id",user.id).order("created_at",{ascending:false}).limit(4),
      window.adaajaSupabase.from("offers").select("id,status,created_at,updated_at").eq("buyer_id",user.id).order("created_at",{ascending:false}).limit(4),
      window.adaajaSupabase.from("offers").select("id,status,created_at,updated_at").eq("seller_id",user.id).order("created_at",{ascending:false}).limit(4)
    ]);

    const rows=[];
    (notificationsRes.data||[]).slice(0,5).forEach(item=>rows.push({type:item.type||"system",title:item.title||"Notifikasi",subtitle:item.message||"",created_at:item.created_at}));
    (buyerOrdersRes.data||[]).slice(0,2).forEach(item=>rows.push({type:"order",title:"Aktivitas pembelian",subtitle:`Status: ${String(item.status||"").replaceAll("_"," ")}`,created_at:item.created_at}));
    (sellerOrdersRes.data||[]).slice(0,2).forEach(item=>rows.push({type:"order",title:"Aktivitas penjualan",subtitle:`Status: ${String(item.status||"").replaceAll("_"," ")}`,created_at:item.created_at}));
    (buyerOffersRes.data||[]).slice(0,1).forEach(item=>rows.push({type:"offer",title:"Negosiasi Anda",subtitle:`Status: ${String(item.status||"").replaceAll("_"," ")}`,created_at:item.updated_at||item.created_at}));
    (sellerOffersRes.data||[]).slice(0,1).forEach(item=>rows.push({type:"offer",title:"Penawaran masuk",subtitle:`Status: ${String(item.status||"").replaceAll("_"," ")}`,created_at:item.updated_at||item.created_at}));

    rows.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    renderRecent(rows.slice(0,7));
    subscribeRealtime();
  }catch(error){
    console.error("Gagal memuat aktivitas:",error);
    recentActivity.innerHTML=`<div class="empty-recent">Aktivitas belum dapat dimuat. ${esc(error.message||"")}</div>`;
  }
}

function renderRecent(rows){
  if(!rows.length){
    recentActivity.innerHTML='<div class="empty-recent">Belum ada aktivitas terbaru.</div>';
    return;
  }
  recentActivity.innerHTML=rows.map(row=>`
    <div class="recent-row">
      <span class="recent-icon">${iconForType(row.type)}</span>
      <div class="recent-copy">
        <strong>${esc(row.title)}</strong>
        <span>${esc(row.subtitle)}</span>
      </div>
      <span class="recent-time">${esc(relativeDate(row.created_at))}</span>
    </div>
  `).join("");
}

function subscribeRealtime(){
  if(!currentUser)return;
  realtimeChannels.forEach(ch=>window.adaajaSupabase.removeChannel(ch));
  realtimeChannels=[];

  const orders=window.adaajaSupabase.channel(`activity-orders-${currentUser.id}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`buyer_id=eq.${currentUser.id}`},loadActivity)
    .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:`seller_id=eq.${currentUser.id}`},loadActivity)
    .subscribe();

  const offers=window.adaajaSupabase.channel(`activity-offers-${currentUser.id}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"offers",filter:`buyer_id=eq.${currentUser.id}`},loadActivity)
    .on("postgres_changes",{event:"*",schema:"public",table:"offers",filter:`seller_id=eq.${currentUser.id}`},loadActivity)
    .subscribe();

  const notifications=window.adaajaSupabase.channel(`activity-notifications-${currentUser.id}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`user_id=eq.${currentUser.id}`},loadActivity)
    .subscribe();

  realtimeChannels.push(orders,offers,notifications);
}

refreshButton.addEventListener("click",async()=>{
  refreshButton.disabled=true;
  await loadActivity();
  refreshButton.disabled=false;
  showToast("Aktivitas diperbarui.");
});

window.adaajaSupabase.auth.onAuthStateChange((event,session)=>{
  if(event==="SIGNED_OUT"||!session?.user)location.replace("login.html");
});
window.addEventListener("beforeunload",()=>{
  realtimeChannels.forEach(ch=>window.adaajaSupabase.removeChannel(ch));
});

setRole(localStorage.getItem("adaajaActivityRole")==="seller"?"seller":"buyer");
loadActivity();
