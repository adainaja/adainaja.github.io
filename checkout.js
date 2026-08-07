const params=new URLSearchParams(location.search);
const productId=params.get("product_id")||params.get("id");
const offerId=params.get("offer_id");
const addressCard=document.getElementById("addressCard"),productCard=document.getElementById("productCard"),qtyInput=document.getElementById("quantityInput"),minimumOrderText=document.getElementById("minimumOrderText"),buyerNote=document.getElementById("buyerNote"),createOrderButton=document.getElementById("createOrderButton"),successModal=document.getElementById("successModal"),toast=document.getElementById("toast");
let currentUser=null,product=null,offer=null,address=null,unitPrice=0,shippingCost=0,adminFee=0,createdOrderId=null,toastTimer=null;
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const money=v=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(v||0));
function publicUrl(path){if(!path)return"";return window.adaajaSupabase.storage.from("product-images").getPublicUrl(path).data?.publicUrl||""}
function showToast(m){toast.textContent=m;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2400)}
async function requireUser(){const u=await window.AdaAjaAuth.getCurrentUser();if(!u){localStorage.setItem("redirectAfterLogin",location.pathname.split("/").pop()+location.search);location.replace("login.html");return null}currentUser=u;return u}
async function load(){
 const u=await requireUser();if(!u)return;
 try{
  if(offerId){const {data:o,error}=await window.adaajaSupabase.from("offers").select("*").eq("id",offerId).eq("buyer_id",u.id).maybeSingle();if(error)throw error;if(!o)throw new Error("Negosiasi tidak ditemukan.");offer=o}
  const resolvedProductId=offer?.product_id||productId;if(!resolvedProductId)throw new Error("Produk checkout tidak ditemukan.");
  const {data:p,error:pe}=await window.adaajaSupabase.from("products").select(`id,name,price,stock,unit,minimum_order,seller_id,shipping_method,shipping_payer,processing_time,status,product_images(storage_path,sort_order,is_cover)`).eq("id",resolvedProductId).maybeSingle();if(pe)throw pe;if(!p)throw new Error("Produk tidak ditemukan.");product=p;
  if(product.seller_id===u.id)throw new Error("Anda tidak dapat membeli produk sendiri.");
  const {data:addrs,error:ae}=await window.adaajaSupabase.from("addresses").select("*").eq("user_id",u.id).order("is_default",{ascending:false}).order("created_at",{ascending:false}).limit(10);if(ae)throw ae;address=(addrs||[]).find(a=>a.is_default)||(addrs||[])[0]||null;
  unitPrice=Number(offer?.status==="accepted"?(offer.counter_price||offer.offered_price):product.price||0);
  render();calc();
 }catch(e){console.error(e);showToast(e.message||"Checkout gagal dimuat.");createOrderButton.disabled=true}
}
function render(){
 const imgs=[...(product.product_images||[])].sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));const cover=imgs.find(i=>i.is_cover)||imgs[0],img=publicUrl(cover?.storage_path||""),unit=product.unit||"pcs",min=Math.max(1,Number(product.minimum_order||1));
 qtyInput.min=min;qtyInput.max=Math.max(min,Number(product.stock||9999));qtyInput.value=min;minimumOrderText.textContent=`Minimum order ${min} ${unit}`;
 productCard.innerHTML=`<div class="product-image">${img?`<img src="${esc(img)}" alt="${esc(product.name)}">`:'<div class="skeleton-box" style="width:100%;height:100%"></div>'}</div><div class="product-copy"><h3>${esc(product.name||"Produk")}</h3><span>Stok ${Number(product.stock||0)} ${esc(unit)}</span><div class="product-price"><strong>${money(unitPrice)}</strong><span>/ ${esc(unit)}</span></div>${offer?'<span class="deal-badge">Harga hasil negosiasi</span>':""}</div>`;
 if(address){const name=address.recipient_name||address.full_name||address.name||"Penerima",label=address.label||"Alamat Utama",phone=address.phone||address.phone_number||"",full=address.full_address||[address.address_line,address.village,address.district,address.city,address.province,address.postal_code].filter(Boolean).join(", ");addressCard.innerHTML=`<span class="address-label">${esc(label)}</span><h3>${esc(name)}</h3><p>${esc(full||"Alamat tersedia")}</p>${phone?`<small>${esc(phone)}</small>`:""}`}else{addressCard.innerHTML='<h3>Belum ada alamat pengiriman</h3><p>Tambahkan alamat terlebih dahulu sebelum membuat pesanan.</p>'}
 document.getElementById("shippingMethod").textContent=product.shipping_method||"Pengiriman standar";document.getElementById("shippingInfo").textContent=product.processing_time?`Diproses ${product.processing_time}. Pilihan kurir realtime akan tersedia saat Biteship diaktifkan.`:"Pilihan kurir realtime akan tersedia saat Biteship diaktifkan.";
}
function calc(){if(!product)return;const min=Math.max(1,Number(product.minimum_order||1)),stock=Number(product.stock||0);let q=Math.max(min,Number(qtyInput.value||min));if(stock>0)q=Math.min(q,stock);qtyInput.value=q;const subtotal=unitPrice*q,total=subtotal+shippingCost+adminFee;document.getElementById("unitPrice").textContent=money(unitPrice);document.getElementById("summaryQty").textContent=`${q} ${product.unit||"pcs"}`;document.getElementById("subtotal").textContent=money(subtotal);document.getElementById("shippingPrice").textContent=money(shippingCost);document.getElementById("shippingSummary").textContent=money(shippingCost);document.getElementById("adminFee").textContent=money(adminFee);document.getElementById("grandTotal").textContent=money(total);document.getElementById("bottomTotal").textContent=money(total)}
document.getElementById("decreaseQty").onclick=()=>{qtyInput.value=Number(qtyInput.value||1)-1;calc()};document.getElementById("increaseQty").onclick=()=>{qtyInput.value=Number(qtyInput.value||1)+1;calc()};qtyInput.oninput=calc;buyerNote.oninput=()=>document.getElementById("noteCount").textContent=buyerNote.value.length;
document.getElementById("changeAddressButton").onclick=()=>{location.href=`my-address.html?return_to=${encodeURIComponent(location.href)}`};
createOrderButton.onclick=async()=>{
 if(!currentUser||!product)return;if(!address?.id){showToast("Tambahkan alamat pengiriman terlebih dahulu.");return}
 const qty=Number(qtyInput.value||1),min=Math.max(1,Number(product.minimum_order||1)),stock=Number(product.stock||0);if(qty<min){showToast(`Minimum pembelian ${min} ${product.unit||"pcs"}.`);return}if(stock<qty){showToast("Jumlah melebihi stok tersedia.");return}
 createOrderButton.disabled=true;createOrderButton.textContent="Membuat Pesanan...";
 try{
  const subtotal=unitPrice*qty,total=subtotal+shippingCost+adminFee;
  const {data:o,error:oe}=await window.adaajaSupabase.from("orders").insert({buyer_id:currentUser.id,seller_id:product.seller_id,offer_id:offer?.id||null,address_id:address.id,status:"pending_payment",subtotal,shipping_cost:shippingCost,admin_fee:adminFee,discount:0,total,buyer_note:buyerNote.value.trim()||null,courier_code:null,courier_service:product.shipping_method||null}).select("id").single();if(oe)throw oe;
  const {error:ie}=await window.adaajaSupabase.from("order_items").insert({order_id:o.id,product_id:product.id,product_name:product.name,quantity:qty,unit:product.unit||"pcs",minimum_order:min,unit_price:unitPrice,subtotal});if(ie){await window.adaajaSupabase.from("orders").delete().eq("id",o.id).eq("buyer_id",currentUser.id);throw ie}
  createdOrderId=o.id;successModal.classList.add("active");successModal.setAttribute("aria-hidden","false");
 }catch(e){console.error(e);showToast(e.message||"Pesanan gagal dibuat.")}finally{createOrderButton.disabled=false;createOrderButton.innerHTML='Buat Pesanan <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg>'}
};
document.getElementById("goToOrdersButton").onclick=()=>{location.href=createdOrderId?`my-orders.html?order_id=${encodeURIComponent(createdOrderId)}`:"my-orders.html"};
window.adaajaSupabase.auth.onAuthStateChange((e,s)=>{if(e==="SIGNED_OUT"||!s?.user)location.replace("login.html")});load();
