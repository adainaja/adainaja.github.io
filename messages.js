const conversationList=document.getElementById("conversationList"),searchInput=document.getElementById("searchInput"),sortSelect=document.getElementById("sortSelect"),resultCount=document.getElementById("resultCount"),refreshButton=document.getElementById("refreshButton"),toast=document.getElementById("toast");
let currentUser=null,conversations=[],realtimeChannel=null,toastTimer=null;
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
function relative(v){if(!v)return"-";const t=new Date(v).getTime(),d=Date.now()-t;if(!Number.isFinite(t))return"-";if(d<60000)return"Baru";if(d<3600000)return`${Math.floor(d/60000)} mnt`;if(d<86400000)return`${Math.floor(d/3600000)} jam`;return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short"}).format(new Date(v))}
function showToast(m){toast.textContent=m;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2200)}
async function requireUser(){const u=await window.AdaAjaAuth.getCurrentUser();if(!u){localStorage.setItem("redirectAfterLogin","messages.html");location.replace("login.html");return null}currentUser=u;return u}
function loading(){resultCount.textContent="Memuat...";conversationList.innerHTML='<article class="skeleton-card shimmer"></article><article class="skeleton-card shimmer"></article><article class="skeleton-card shimmer"></article>'}
async function load(){
 const u=await requireUser();if(!u)return;loading();
 try{
  const {data:members,error}=await window.adaajaSupabase.from("conversation_members").select("conversation_id,last_read_at").eq("user_id",u.id);if(error)throw error;
  const ids=(members||[]).map(x=>x.conversation_id);
  if(!ids.length){conversations=[];render();stats();subscribe();return}
  const {data:conv,error:ce}=await window.adaajaSupabase.from("conversations").select("id,product_id,order_id,conversation_type,last_message_at,created_at,updated_at").in("id",ids).order("last_message_at",{ascending:false,nullsFirst:false});if(ce)throw ce;
  const {data:allMembers}=await window.adaajaSupabase.from("conversation_members").select("conversation_id,user_id,role,last_read_at").in("conversation_id",ids);
  const otherIds=[...new Set((allMembers||[]).filter(x=>x.user_id!==u.id).map(x=>x.user_id))];
  const {data:profiles}=otherIds.length?await window.adaajaSupabase.from("profiles").select("id,username,full_name,avatar_url").in("id",otherIds):{data:[]};
  const productIds=[...new Set((conv||[]).map(x=>x.product_id).filter(Boolean))];
  const {data:products}=productIds.length?await window.adaajaSupabase.from("products").select("id,name").in("id",productIds):{data:[]};
  const {data:msgs}=await window.adaajaSupabase.from("messages").select("id,conversation_id,sender_id,message_text,created_at").in("conversation_id",ids).order("created_at",{ascending:false});
  const profMap=new Map((profiles||[]).map(p=>[p.id,p])),prodMap=new Map((products||[]).map(p=>[p.id,p.name]));
  const msgMap=new Map(),unreadMap=new Map();
  (msgs||[]).forEach(m=>{if(!msgMap.has(m.conversation_id))msgMap.set(m.conversation_id,m)});
  const myReadMap=new Map((members||[]).map(m=>[m.conversation_id,m.last_read_at]));
  (msgs||[]).forEach(m=>{if(m.sender_id===u.id)return;const lr=myReadMap.get(m.conversation_id);if(!lr||new Date(m.created_at)>new Date(lr))unreadMap.set(m.conversation_id,(unreadMap.get(m.conversation_id)||0)+1)});
  conversations=(conv||[]).map(c=>{const om=(allMembers||[]).find(m=>m.conversation_id===c.id&&m.user_id!==u.id),p=profMap.get(om?.user_id)||{};return{...c,other:p,context:prodMap.get(c.product_id)||(c.order_id?"Percakapan pesanan":"Percakapan"),last:msgMap.get(c.id)||null,unread:unreadMap.get(c.id)||0}});
  stats();render();subscribe();
 }catch(e){console.error(e);conversationList.innerHTML=`<section class="empty-state"><span class="empty-icon">!</span><strong>Pesan belum dapat dimuat</strong><p>${esc(e.message||"Silakan coba kembali.")}</p><button class="retry-button" id="retry">Muat ulang</button></section>`;document.getElementById("retry")?.addEventListener("click",load)}
}
function stats(){document.getElementById("conversationCount").textContent=conversations.length;document.getElementById("unreadCount").textContent=conversations.reduce((s,c)=>s+c.unread,0);const n=new Date();document.getElementById("todayCount").textContent=conversations.filter(c=>{const d=new Date(c.last?.created_at||c.last_message_at||0);return d.toDateString()===n.toDateString()}).length}
function filtered(){const q=searchInput.value.trim().toLowerCase();let d=conversations.filter(c=>!q||[c.other?.username,c.other?.full_name,c.context,c.last?.message_text].some(v=>String(v||"").toLowerCase().includes(q)));if(sortSelect.value==="unread")d.sort((a,b)=>b.unread-a.unread||new Date(b.last?.created_at||0)-new Date(a.last?.created_at||0));return d}
function render(){const d=filtered();resultCount.textContent=`${d.length} percakapan`;if(!d.length){conversationList.innerHTML='<section class="empty-state"><span class="empty-icon">✦</span><strong>Belum ada percakapan</strong><p>Mulai chat dari halaman produk atau transaksi.</p><a href="explore.html">Jelajahi Produk</a></section>';return}conversationList.innerHTML=d.map(c=>{const name=c.other?.username||c.other?.full_name||"Pengguna AdaAja",avatar=c.other?.avatar_url?`<img src="${esc(c.other.avatar_url)}" alt="${esc(name)}">`:esc(name.charAt(0).toUpperCase());return`<a class="conversation-card ${c.unread?"unread":""}" href="chat.html?conversation_id=${encodeURIComponent(c.id)}"><div class="avatar">${avatar}</div><div class="conversation-copy"><div class="conversation-top"><strong>${esc(name)}</strong>${c.unread?'<i class="unread-dot"></i>':""}</div><span class="conversation-context">${esc(c.context)}</span><span class="conversation-preview">${esc(c.last?.message_text||"Belum ada pesan")}</span></div><div class="conversation-side"><span class="conversation-time">${esc(relative(c.last?.created_at||c.last_message_at))}</span>${c.unread?`<span class="unread-badge">${c.unread}</span>`:""}</div></a>`}).join("")}
function subscribe(){if(realtimeChannel)window.adaajaSupabase.removeChannel(realtimeChannel);realtimeChannel=window.adaajaSupabase.channel(`messages-${currentUser.id}`).on("postgres_changes",{event:"*",schema:"public",table:"messages"},load).subscribe()}
searchInput.oninput=render;sortSelect.onchange=render;refreshButton.onclick=async()=>{refreshButton.disabled=true;await load();refreshButton.disabled=false;showToast("Pesan diperbarui.")};window.adaajaSupabase.auth.onAuthStateChange((e,s)=>{if(e==="SIGNED_OUT"||!s?.user)location.replace("login.html")});load();
