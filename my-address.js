const REGION_API="https://www.emsifa.com/api-wilayah-indonesia/api/";
const listEl=document.getElementById("addressList"),editor=document.getElementById("editor"),actionSheet=document.getElementById("actionSheet"),locationSheet=document.getElementById("locationSheet"),deleteConfirm=document.getElementById("deleteConfirm"),form=document.getElementById("addressForm"),recipientName=document.getElementById("recipientName"),recipientPhone=document.getElementById("recipientPhone"),labelInput=document.getElementById("addressLabel"),detailInput=document.getElementById("addressDetail"),postalInput=document.getElementById("postalCode"),primaryToggle=document.getElementById("primaryToggle"),message=document.getElementById("formMessage"),latitudeInput=document.getElementById("latitudeInput"),longitudeInput=document.getElementById("longitudeInput"),latitudeText=document.getElementById("latitudeText"),longitudeText=document.getElementById("longitudeText"),gpsStatus=document.getElementById("gpsStatus"),locationList=document.getElementById("locationList"),locationSearch=document.getElementById("locationSearch"),loading=document.getElementById("loadingOverlay"),toast=document.getElementById("toast");
let user=null,rows=[],template=null,editing=null,actionItem=null,currentType="",locationData=[],toastTimer=null;
const selected={province:null,city:null,district:null,village:null};
const aliases={label:["label","address_label"],recipientName:["recipient_name","receiver_name","nama_penerima"],recipientPhone:["recipient_phone","receiver_phone","phone","nomor_hp"],province:["province","provinsi"],city:["city","kota","regency"],district:["district","kecamatan"],village:["village","kelurahan","subdistrict"],detail:["address_line","address","alamat","full_address"],postal:["postal_code","kode_pos"],latitude:["latitude","lat"],longitude:["longitude","lng","lon"]};
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function pick(r,ks,f=""){for(const k of ks)if(r&&r[k]!=null&&String(r[k]).trim()!=="")return r[k];return f}
function keyFor(r,ks){for(const k of ks)if(r&&Object.prototype.hasOwnProperty.call(r,k))return k;return ks[0]}
function norm(r){return{id:r.id,user_id:r.user_id,label:pick(r,aliases.label,"Alamat"),recipient_name:pick(r,aliases.recipientName),recipient_phone:pick(r,aliases.recipientPhone),province:pick(r,aliases.province),city:pick(r,aliases.city),district:pick(r,aliases.district),village:pick(r,aliases.village),detail:pick(r,aliases.detail),postal:pick(r,aliases.postal),latitude:pick(r,aliases.latitude),longitude:pick(r,aliases.longitude),is_primary:!!r.is_primary,raw:r}}
function setLoading(on,title="Memuat alamat",sub="Mohon tunggu..."){document.getElementById("loaderTitle").textContent=title;document.getElementById("loaderSubtitle").textContent=sub;loading.classList.toggle("active",on);document.body.classList.toggle("lock",on)}
function notify(t){toast.textContent=t;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2200)}
async function requireUser(){const u=await window.AdaAjaAuth.getCurrentUser();if(!u){localStorage.setItem("redirectAfterLogin","my-address.html");location.replace("login.html");return null}user=u;return u}
function render(){
  document.getElementById("addressCount").textContent=rows.length;
  document.getElementById("resultLabel").textContent=`${rows.length} alamat`;
  document.getElementById("primaryLabel").textContent=rows.find(x=>x.is_primary)?.label||"Belum ada";
  if(!rows.length){
    listEl.innerHTML='<div class="empty"><strong>Belum ada alamat</strong>Tambahkan alamat pertama Anda agar proses checkout dan pengiriman lebih cepat.</div>';
    return;
  }
  listEl.innerHTML=rows.map(a=>{
    const loc=[a.village,a.district,a.city,a.province,a.postal].filter(Boolean).join(", ");
    const recipient=[a.recipient_name,a.recipient_phone].filter(Boolean);
    const hasGps=a.latitude!==""&&a.latitude!=null&&a.longitude!==""&&a.longitude!=null;
    return `<article class="address-card ${a.is_primary?'primary':''}">
      <div class="address-top">
        <div class="address-id">
          <span class="pin"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
          <div><strong>${esc(a.label)}</strong><span>${a.is_primary?'Alamat pilihan utama':'Alamat tersimpan'}</span>${a.is_primary?'<b class="badge">UTAMA</b>':''}</div>
        </div>
        <button class="more" data-id="${esc(a.id)}"><svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button>
      </div>
      ${recipient.length?`<div class="recipient-line">${recipient.map(x=>`<span class="recipient-chip">${esc(x)}</span>`).join("")}</div>`:""}
      <p class="detail">${esc(a.detail||'Detail alamat belum tersedia.')}</p>
      <span class="loc"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/></svg>${esc(loc||'Wilayah belum tersedia')}</span>
      ${hasGps?'<span class="coordinate-badge">GPS tersimpan</span>':""}
    </article>`;
  }).join("");
  listEl.querySelectorAll(".more").forEach(b=>b.onclick=()=>openAction(b.dataset.id));
}
async function load(){const u=await requireUser();if(!u)return;setLoading(true);try{const{data,error}=await window.adaajaSupabase.from("addresses").select("*").eq("user_id",u.id).order("is_primary",{ascending:false}).order("created_at",{ascending:true});if(error)throw error;template=data?.[0]||null;rows=(data||[]).map(norm);render()}catch(e){console.error(e);listEl.innerHTML=`<div class="empty"><strong>Alamat gagal dimuat</strong>${esc(e.message||'Silakan coba lagi.')}</div>`}finally{setLoading(false)}}

function normalizePhone(v){return String(v||"").replace(/[^\d+]/g,"").replace(/^(\+62)0/,"+62").replace(/^62/,"+62")}
function updateGpsDisplay(lat="",lng=""){latitudeInput.value=lat??"";longitudeInput.value=lng??"";latitudeText.textContent=lat!==""&&lat!=null?String(lat):"—";longitudeText.textContent=lng!==""&&lng!=null?String(lng):"—";gpsStatus.textContent=lat!==""&&lng!==""?"Koordinat lokasi tersimpan":"Belum ada koordinat tersimpan"}
async function getCurrentPosition(){
  if(!navigator.geolocation)throw new Error("GPS tidak didukung pada perangkat ini.");
  return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,e=>{
    const m={1:"Izin lokasi ditolak. Aktifkan izin lokasi browser.",2:"Lokasi perangkat tidak tersedia.",3:"Permintaan lokasi terlalu lama."};
    reject(new Error(m[e.code]||"Lokasi perangkat gagal didapatkan."));
  },{enableHighAccuracy:true,timeout:15000,maximumAge:30000}));
}
async function useCurrentLocation(openForm=false){
  if(openForm&&!editor.classList.contains("active"))openEditor();
  gpsStatus.textContent="Mengambil koordinat...";
  try{
    const p=await getCurrentPosition();
    const lat=Number(p.coords.latitude).toFixed(6),lng=Number(p.coords.longitude).toFixed(6);
    updateGpsDisplay(lat,lng);notify("Lokasi perangkat berhasil didapatkan.");
  }catch(e){gpsStatus.textContent="Koordinat belum tersedia";notify(e.message||"Gagal mendapatkan lokasi.");}
}
function openEditor(a=null){
  editing=a;message.textContent="";
  document.getElementById("editorEyebrow").textContent=a?"EDIT ALAMAT":"ALAMAT BARU";
  document.getElementById("editorTitle").textContent=a?"Perbarui alamat":"Tambah alamat";
  recipientName.value=a?.recipient_name||"";
  recipientPhone.value=a?.recipient_phone||"";
  labelInput.value=a?.label||"";
  detailInput.value=a?.detail||"";
  postalInput.value=a?.postal||"";
  primaryToggle.checked=!!a?.is_primary;
  selected.province=a?.province?{name:a.province}:null;
  selected.city=a?.city?{name:a.city}:null;
  selected.district=a?.district?{name:a.district}:null;
  selected.village=a?.village?{name:a.village}:null;
  document.getElementById("provinceText").textContent=a?.province||"Pilih provinsi";
  document.getElementById("cityText").textContent=a?.city||"Pilih kota";
  document.getElementById("districtText").textContent=a?.district||"Pilih kecamatan";
  document.getElementById("villageText").textContent=a?.village||"Pilih kelurahan";
  updateGpsDisplay(a?.latitude??"",a?.longitude??"");
  document.querySelectorAll("[data-label]").forEach(b=>b.classList.toggle("active",b.dataset.label===labelInput.value));
  editor.classList.add("active");editor.setAttribute("aria-hidden","false");document.body.classList.add("lock");
}
function closeEditorFn(){editor.classList.remove("active");document.body.classList.remove("lock");editing=null}
function fmt(n=""){return String(n).toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()).replace("Dki Jakarta","DKI Jakarta").replace("Di Yogyakarta","DI Yogyakarta")}
function endpoint(t){if(t==="province")return REGION_API+"provinces.json";if(t==="city"&&selected.province?.id)return REGION_API+`regencies/${selected.province.id}.json`;if(t==="district"&&selected.city?.id)return REGION_API+`districts/${selected.city.id}.json`;if(t==="village"&&selected.district?.id)return REGION_API+`villages/${selected.district.id}.json`;return""}
async function openLocation(t){const ep=endpoint(t);if(!ep&&t!=="province"){notify(t==="city"?"Pilih provinsi terlebih dahulu.":t==="district"?"Pilih kota terlebih dahulu.":"Pilih kecamatan terlebih dahulu.");return}currentType=t;locationSearch.value="";document.getElementById("locationTitle").textContent={province:"Pilih provinsi",city:"Pilih kota/kabupaten",district:"Pilih kecamatan",village:"Pilih kelurahan/desa"}[t];locationSheet.classList.add("active");locationList.innerHTML='<div style="padding:20px;text-align:center;font-size:8px;color:#788493">Memuat wilayah...</div>';try{const r=await fetch(ep||REGION_API+"provinces.json");if(!r.ok)throw new Error("Data wilayah gagal dimuat.");locationData=await r.json();renderOptions()}catch(e){locationList.innerHTML=`<div style="padding:20px;text-align:center;font-size:8px;color:#788493">${esc(e.message)}</div>`}}
function renderOptions(){const q=locationSearch.value.trim().toLowerCase();const data=q?locationData.filter(x=>fmt(x.name).toLowerCase().includes(q)):locationData;locationList.innerHTML=data.map(x=>`<button type="button" data-id="${esc(x.id)}">${esc(fmt(x.name))}</button>`).join("");locationList.querySelectorAll("button").forEach(b=>b.onclick=()=>choose(locationData.find(x=>String(x.id)===b.dataset.id)))}
function choose(item){if(!item)return;selected[currentType]=item;if(currentType==="province"){selected.city=selected.district=selected.village=null;provinceText.textContent=fmt(item.name);cityText.textContent="Pilih kota";districtText.textContent="Pilih kecamatan";villageText.textContent="Pilih kelurahan"}if(currentType==="city"){selected.district=selected.village=null;cityText.textContent=fmt(item.name);districtText.textContent="Pilih kecamatan";villageText.textContent="Pilih kelurahan"}if(currentType==="district"){selected.village=null;districtText.textContent=fmt(item.name);villageText.textContent="Pilih kelurahan"}if(currentType==="village")villageText.textContent=fmt(item.name);locationSheet.classList.remove("active")}
function payload(){
  const src=editing?.raw||template||{};
  const p={user_id:user.id,is_primary:primaryToggle.checked};
  p[keyFor(src,aliases.label)]=labelInput.value.trim()||"Alamat";
  p[keyFor(src,aliases.recipientName)]=recipientName.value.trim();
  p[keyFor(src,aliases.recipientPhone)]=normalizePhone(recipientPhone.value);
  p[keyFor(src,aliases.province)]=selected.province?fmt(selected.province.name):"";
  p[keyFor(src,aliases.city)]=selected.city?fmt(selected.city.name):"";
  p[keyFor(src,aliases.district)]=selected.district?fmt(selected.district.name):"";
  p[keyFor(src,aliases.village)]=selected.village?fmt(selected.village.name):"";
  p[keyFor(src,aliases.detail)]=detailInput.value.trim();
  p[keyFor(src,aliases.postal)]=postalInput.value.trim();
  const lat=latitudeInput.value.trim(),lng=longitudeInput.value.trim();
  if(Object.prototype.hasOwnProperty.call(src,keyFor(src,aliases.latitude))||lat)p[keyFor(src,aliases.latitude)]=lat?Number(lat):null;
  if(Object.prototype.hasOwnProperty.call(src,keyFor(src,aliases.longitude))||lng)p[keyFor(src,aliases.longitude)]=lng?Number(lng):null;
  if(Object.prototype.hasOwnProperty.call(src,"updated_at"))p.updated_at=new Date().toISOString();
  return p;
}
async function clearPrimary(except=null){let q=window.adaajaSupabase.from("addresses").update({is_primary:false}).eq("user_id",user.id);if(except)q=q.neq("id",except);const{error}=await q;if(error)throw error}
form.onsubmit=async e=>{e.preventDefault();message.textContent="";
const phone=normalizePhone(recipientPhone.value);
if(recipientName.value.trim().length<2){message.textContent="Nama penerima wajib diisi.";return}
if(!/^(\+62|0)\d{8,13}$/.test(phone)){message.textContent="Nomor HP penerima belum valid.";return}
if(!selected.province||!selected.city||!selected.district||!selected.village){message.textContent="Lengkapi wilayah hingga kelurahan/desa.";return}
if(detailInput.value.trim().length<8){message.textContent="Alamat lengkap minimal 8 karakter.";return}
if(postalInput.value.trim()&&!/^\d{5,10}$/.test(postalInput.value.trim())){message.textContent="Kode pos harus 5–10 angka.";return}await requireUser();setLoading(true,"Menyimpan alamat","Memperbarui data pengiriman...");try{const p=payload();if(!rows.length)p.is_primary=true;if(p.is_primary)await clearPrimary(editing?.id||null);const res=editing?await window.adaajaSupabase.from("addresses").update(p).eq("id",editing.id).eq("user_id",user.id):await window.adaajaSupabase.from("addresses").insert(p);if(res.error)throw res.error;closeEditorFn();notify("Alamat berhasil disimpan.");await load()}catch(err){console.error(err);message.textContent=err.message||"Alamat gagal disimpan."}finally{setLoading(false)}};
function openAction(id){actionItem=rows.find(x=>String(x.id)===String(id));if(!actionItem)return;document.getElementById("actionAddressName").textContent=actionItem.label;document.getElementById("makePrimaryAction").style.display=actionItem.is_primary?"none":"block";actionSheet.classList.add("active");document.body.classList.add("lock")}
function closeAction(){actionSheet.classList.remove("active");document.body.classList.remove("lock")}
document.getElementById("editAddressAction").onclick=()=>{const a=actionItem;closeAction();openEditor(a)};document.getElementById("makePrimaryAction").onclick=async()=>{const a=actionItem;closeAction();setLoading(true,"Mengubah alamat utama","Mohon tunggu...");try{await clearPrimary(a.id);const p={is_primary:true};if(Object.prototype.hasOwnProperty.call(a.raw,"updated_at"))p.updated_at=new Date().toISOString();const{error}=await window.adaajaSupabase.from("addresses").update(p).eq("id",a.id).eq("user_id",user.id);if(error)throw error;notify("Alamat utama berhasil diubah.");await load()}catch(e){notify(e.message||"Gagal mengubah alamat utama.")}finally{setLoading(false)}};document.getElementById("deleteAddressAction").onclick=()=>{const a=actionItem;if(!a)return;if(a.is_primary&&rows.length>1){notify("Pilih alamat utama lain sebelum menghapus alamat ini.");return}document.getElementById("deleteDescription").textContent=`Alamat "${a.label}" akan dihapus dari akun Anda.`;actionSheet.classList.remove("active");deleteConfirm.classList.add("active");document.body.classList.add("lock")};
document.getElementById("confirmDelete").onclick=async()=>{const a=actionItem;if(!a)return;deleteConfirm.classList.remove("active");setLoading(true,"Menghapus alamat","Mohon tunggu...");try{const{error}=await window.adaajaSupabase.from("addresses").delete().eq("id",a.id).eq("user_id",user.id);if(error)throw error;actionItem=null;notify("Alamat berhasil dihapus.");await load()}catch(e){notify(e.message||"Alamat gagal dihapus.")}finally{setLoading(false)}};
document.getElementById("deleteBackdrop").onclick=document.getElementById("cancelDelete").onclick=()=>{deleteConfirm.classList.remove("active");document.body.classList.remove("lock")};
document.querySelectorAll("[data-label]").forEach(b=>b.onclick=()=>{labelInput.value=b.dataset.label;document.querySelectorAll("[data-label]").forEach(x=>x.classList.toggle("active",x===b))});document.querySelectorAll("[data-location]").forEach(b=>b.onclick=()=>openLocation(b.dataset.location));locationSearch.oninput=renderOptions;recipientPhone.oninput=()=>recipientPhone.value=recipientPhone.value.replace(/[^\d+]/g,"");
postalInput.oninput=()=>postalInput.value=postalInput.value.replace(/\D/g,"").slice(0,10);
document.getElementById("useCurrentLocation").onclick=()=>useCurrentLocation(false);
document.getElementById("useCurrentLocationTop").onclick=()=>useCurrentLocation(true);
document.getElementById("addTop").onclick=document.getElementById("addLarge").onclick=()=>openEditor();document.getElementById("editorBackdrop").onclick=document.getElementById("closeEditor").onclick=closeEditorFn;document.getElementById("locationBackdrop").onclick=document.getElementById("closeLocation").onclick=()=>locationSheet.classList.remove("active");document.getElementById("actionBackdrop").onclick=document.getElementById("cancelAction").onclick=closeAction;load();
