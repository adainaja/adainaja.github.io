const API_URL = "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const MAX_PHOTOS = 10;
const photos = [];
let shippingPayer = "";

const form = document.getElementById("productForm");
const photoInput = document.getElementById("photoInput");
const photoGrid = document.getElementById("photoGrid");
const photoCount = document.getElementById("photoCount");
const productName = document.getElementById("productName");
const description = document.getElementById("description");
const price = document.getElementById("price");
const stock = document.getElementById("stock");
const message = document.getElementById("formMessage");
const publishButton = document.getElementById("publishButton");
const loadingOverlay = document.getElementById("loadingOverlay");

function getUser(){
  try{
    return JSON.parse(localStorage.getItem("user") || "null");
  }catch{
    return null;
  }
}

function showMessage(text,type="error"){
  message.textContent = text;
  message.className = `notice ${type}`;
  message.scrollIntoView({behavior:"smooth",block:"center"});
}

function clearMessage(){
  message.textContent = "";
  message.className = "notice";
}

productName.addEventListener("input",()=>{
  document.getElementById("nameCount").textContent = productName.value.length;
});

description.addEventListener("input",()=>{
  document.getElementById("descriptionCount").textContent = description.value.length;
});

price.addEventListener("input",()=>{
  const raw = price.value.replace(/\D/g,"").slice(0,12);
  price.dataset.value = raw;
  price.value = raw ? new Intl.NumberFormat("id-ID").format(Number(raw)) : "";
});

document.querySelectorAll("#shippingPayerGroup button").forEach(button=>{
  button.addEventListener("click",()=>{
    document.querySelectorAll("#shippingPayerGroup button").forEach(item=>item.classList.remove("active"));
    button.classList.add("active");
    shippingPayer = button.dataset.value;
  });
});

document.getElementById("decreaseStock").addEventListener("click",()=>{
  stock.value = Math.max(1,Number(stock.value || 1)-1);
});

document.getElementById("increaseStock").addEventListener("click",()=>{
  stock.value = Math.min(9999,Number(stock.value || 1)+1);
});

photoInput.addEventListener("change",async event=>{
  const available = MAX_PHOTOS - photos.length;
  const files = Array.from(event.target.files).slice(0,available);

  for(const file of files){
    if(!file.type.startsWith("image/")) continue;
    const dataUrl = await compressImage(file,1280,.78);
    photos.push({name:file.name,dataUrl});
  }

  photoInput.value = "";
  renderPhotos();
});

function renderPhotos(){
  photoGrid.querySelectorAll(".photo-preview").forEach(item=>item.remove());

  photos.forEach((photo,index)=>{
    const item = document.createElement("div");
    item.className = "photo-preview";
    item.innerHTML = `
      <img src="${photo.dataUrl}" alt="Foto produk ${index+1}">
      ${index===0?'<span class="cover-badge">Sampul</span>':""}
      <button type="button" class="remove-photo" aria-label="Hapus foto">×</button>
    `;
    item.querySelector(".remove-photo").addEventListener("click",()=>{
      photos.splice(index,1);
      renderPhotos();
    });
    photoGrid.appendChild(item);
  });

  photoCount.textContent = photos.length;
  document.querySelector(".photo-add").style.display = photos.length >= MAX_PHOTOS ? "none" : "flex";
}

function compressImage(file,maxSize,quality){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ()=>{
      const image = new Image();
      image.onerror = reject;
      image.onload = ()=>{
        let {width,height} = image;
        const scale = Math.min(1,maxSize/Math.max(width,height));
        width = Math.round(width*scale);
        height = Math.round(height*scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(image,0,0,width,height);
        resolve(canvas.toDataURL("image/jpeg",quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById("draftButton").addEventListener("click",()=>{
  const draft = collectFormData(false);
  localStorage.setItem("adaaja_product_draft",JSON.stringify(draft));
  showMessage("Draf produk berhasil disimpan di perangkat ini.","success");
});

function collectFormData(includeImages=true){
  const user = getUser();
  return {
    action:"uploadProduct",
    seller_id:user?.user_id || "",
    category_id:document.getElementById("category").value,
    brand:document.getElementById("brand").value.trim(),
    nama_produk:productName.value.trim(),
    deskripsi:description.value.trim(),
    kondisi:document.getElementById("condition").value,
    shipping_payer:shippingPayer,
    shipping_method:document.getElementById("shippingMethod").value,
    ship_from_region:document.getElementById("shipFromRegion").value.trim(),
    processing_time:document.getElementById("processingTime").value,
    harga:Number(price.dataset.value || 0),
    stok:Number(stock.value || 1),
    images:includeImages ? photos.map(item=>item.dataUrl) : []
  };
}

function validate(data){
  if(!getUser()) return "Silakan login terlebih dahulu.";
  if(photos.length===0) return "Tambahkan minimal satu foto produk.";
  if(!data.nama_produk) return "Nama produk belum diisi.";
  if(!data.deskripsi) return "Deskripsi produk belum diisi.";
  if(!data.category_id) return "Pilih kategori produk.";
  if(!data.kondisi) return "Pilih kondisi produk.";
  if(!data.shipping_payer) return "Pilih pihak yang menanggung ongkir.";
  if(!data.shipping_method) return "Pilih metode pengiriman.";
  if(!data.ship_from_region) return "Isi wilayah asal pengiriman.";
  if(!data.processing_time) return "Pilih waktu proses.";
  if(data.harga<=0) return "Masukkan harga jual yang benar.";
  if(data.stok<1) return "Stok minimal satu.";
  return "";
}

form.addEventListener("submit",async event=>{
  event.preventDefault();
  clearMessage();

  const data = collectFormData(true);
  const error = validate(data);

  if(error){
    showMessage(error);
    return;
  }

  publishButton.disabled = true;
  loadingOverlay.classList.add("active");

  try{
    const response = await fetch(API_URL,{
      method:"POST",
      body:JSON.stringify(data)
    });

    const result = await response.json();

    if(result.status!=="success"){
      throw new Error(result.message || "Produk gagal diterbitkan.");
    }

    localStorage.removeItem("adaaja_product_draft");
    showMessage("Produk berhasil diterbitkan.","success");

    setTimeout(()=>{
      location.href = `home.html?product=${encodeURIComponent(result.product_id || "")}`;
    },900);

  }catch(error){
    showMessage(error.message || "Tidak dapat terhubung ke server.");
  }finally{
    publishButton.disabled = false;
    loadingOverlay.classList.remove("active");
  }
});

(function restoreDraft(){
  try{
    const draft = JSON.parse(localStorage.getItem("adaaja_product_draft") || "null");
    if(!draft) return;

    productName.value = draft.nama_produk || "";
    description.value = draft.deskripsi || "";
    document.getElementById("category").value = draft.category_id || "";
    document.getElementById("brand").value = draft.brand || "";
    document.getElementById("condition").value = draft.kondisi || "";
    document.getElementById("shippingMethod").value = draft.shipping_method || "";
    document.getElementById("shipFromRegion").value = draft.ship_from_region || "";
    document.getElementById("processingTime").value = draft.processing_time || "";
    stock.value = draft.stok || 1;

    if(draft.harga){
      price.dataset.value = draft.harga;
      price.value = new Intl.NumberFormat("id-ID").format(draft.harga);
    }

    if(draft.shipping_payer){
      const button = document.querySelector(`#shippingPayerGroup button[data-value="${draft.shipping_payer}"]`);
      if(button){
        button.click();
      }
    }

    productName.dispatchEvent(new Event("input"));
    description.dispatchEvent(new Event("input"));
  }catch{}
})();
