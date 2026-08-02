const API_URL="https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";
const box=document.getElementById("offersContainer");
const modal=document.getElementById("confirmModal");
const modalTitle=document.getElementById("modalTitle");
const modalText=document.getElementById("modalText");
const confirmAction=document.getElementById("confirmAction");
let offers=[],filter="all",pending=null;

function user(){try{return JSON.parse(localStorage.getItem("user")||"null")}catch{return null}}
function money(v){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0))}
function esc(v){return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function img(url){if(!url)return"";if(url.includes("drive.google.com")){const id=url.match(/[-\w]{25,}/);if(id)return"https://drive.google.com/thumbnail?id="+id[0]+"&sz=w400"}return url}
function date(v){const d=new Date(v);return isNaN(d)? "-":new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(d)}
function statusLabel(v){return({pending:"Menunggu",accepted:"Diterima",rejected:"Ditolak",cancelled:"Dibatalkan"})[v]||v}

async function load(){
 const u=user(); if(!u?.user_id){location.href="login.html";return}
 box.innerHTML='<section class="state"><div class="spinner"></div><strong>Memuat penawaran...</strong></section>';
 try{
  const r=await fetch(API_URL,{method:"POST",body:JSON.stringify({action:"getSellerOffers",seller_id:u.user_id})});
  const j=await r.json(); if(j.status!=="success"||!Array.isArray(j.offers))throw new Error(j.message||"Gagal memuat");
  offers=j.offers; summary(); render();
 }catch(e){box.innerHTML=`<section class="state"><strong>Penawaran belum dapat dimuat</strong><span>${esc(e.message)}</span></section>`}
}

function summary(){
 document.getElementById("pendingCount").textContent=offers.filter(x=>x.status==="pending").length;
 document.getElementById("acceptedCount").textContent=offers.filter(x=>x.status==="accepted").length;
 document.getElementById("rejectedCount").textContent=offers.filter(x=>x.status==="rejected").length;
}

function render(){
 const data=filter==="all"?offers:offers.filter(x=>x.status===filter);
 if(!data.length){box.innerHTML='<section class="state"><strong>Belum ada penawaran</strong><span>Penawaran pembeli akan tampil di sini.</span></section>';return}
 box.innerHTML=data.map(card).join("");
 document.querySelectorAll("[data-accept]").forEach(b=>b.onclick=()=>openModal(b.dataset.accept,"accepted"));
 document.querySelectorAll("[data-reject]").forEach(b=>b.onclick=()=>openModal(b.dataset.reject,"rejected"));
}

function card(o){
 const photo=img(o.image_url||"");
 const photoHtml=photo?`<img src="${photo}" alt="${esc(o.nama_produk)}">`:'<div class="placeholder">Foto tidak tersedia</div>';
 let action="";
 if(o.status==="pending") action=`<div class="actions"><button class="reject" data-reject="${esc(o.offer_id)}">Tolak</button><button class="accept" data-accept="${esc(o.offer_id)}">Terima</button></div>`;
 else action=`<div class="done-note ${esc(o.status)}">Penawaran ${statusLabel(o.status).toLowerCase()}</div>`;
 return `<article class="offer-card">
 <div class="offer-main"><div class="product-image">${photoHtml}</div><div>
 <div class="status-row"><span class="badge ${esc(o.status)}">${esc(statusLabel(o.status))}</span><span class="date">${esc(date(o.created_at))}</span></div>
 <h2 class="product-name">${esc(o.nama_produk||"Produk")}</h2>
 <div class="buyer">Ditawar oleh ${esc(o.buyer_name||o.buyer_id||"Pembeli")}</div>
 <div class="prices"><div><span>Harga produk</span><strong>${money(o.harga_asli)}</strong></div><div class="offer"><span>Harga ditawar</span><strong>${money(o.harga_penawaran)}</strong></div></div>
 </div></div>
 ${o.catatan?`<p class="note">${esc(o.catatan)}</p>`:""}
 ${action}</article>`;
}

function openModal(id,status){
 pending={id,status};
 modalTitle.textContent=status==="accepted"?"Terima penawaran?":"Tolak penawaran?";
 modalText.textContent=status==="accepted"?"Pembeli dapat melanjutkan checkout dengan harga ini.":"Penawaran akan ditandai sebagai ditolak.";
 confirmAction.textContent=status==="accepted"?"Terima":"Tolak";
 modal.classList.add("active");
}
function closeModal(){modal.classList.remove("active");pending=null}
document.querySelectorAll("[data-close]").forEach(x=>x.onclick=closeModal);

confirmAction.onclick=async function(){
 if(!pending)return;
 const u=user(); this.disabled=true; this.textContent="Memproses...";
 try{
  const r=await fetch(API_URL,{method:"POST",body:JSON.stringify({action:"updateOfferStatus",offer_id:pending.id,seller_id:u.user_id,status:pending.status})});
  const j=await r.json(); if(j.status!=="success")throw new Error(j.message||"Gagal memperbarui");
  closeModal(); await load();
 }catch(e){alert(e.message||"Server tidak terhubung")}finally{this.disabled=false;this.textContent="Lanjutkan"}
};

document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
 b.classList.add("active"); filter=b.dataset.status; render();
});
document.getElementById("refreshButton").onclick=load;
load();
