const API_URL =
"https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";


const productId =
new URLSearchParams(
    location.search
).get("id");


const detailContent =
document.getElementById("detailContent");

const errorState =
document.getElementById("errorState");

const errorMessage =
document.getElementById("errorMessage");

const bottomAction =
document.getElementById("bottomAction");

const offerModal =
document.getElementById("offerModal");

const offerPrice =
document.getElementById("offerPrice");

const offerHint =
document.getElementById("offerHint");

const modalMessage =
document.getElementById("modalMessage");


let currentProduct = null;

let currentUser = getUser();



/**
 * ===============================
 * GET USER SESSION
 * ===============================
 */

function getUser(){

    try{

        return JSON.parse(
            localStorage.getItem("user") || "null"
        );

    }catch(error){

        console.error(
            "Session user tidak valid:",
            error
        );

        return null;

    }

}



/**
 * ===============================
 * CONVERT GOOGLE DRIVE IMAGE
 * ===============================
 */

function convertDriveImage(url){

    if(!url){
        return "";
    }

    if(url.includes("drive.google.com")){

        const id =
        url.match(/[-\w]{25,}/);

        if(id){

            return (
                "https://drive.google.com/thumbnail?id=" +
                id[0] +
                "&sz=w1200"
            );

        }

    }

    return url;

}



/**
 * ===============================
 * FORMAT RUPIAH
 * ===============================
 */

function formatRupiah(value){

    return new Intl.NumberFormat(
        "id-ID",
        {
            style:"currency",
            currency:"IDR",
            maximumFractionDigits:0
        }
    ).format(
        Number(value || 0)
    );

}



/**
 * ===============================
 * ESCAPE HTML
 * ===============================
 */

function escapeHtml(value){

    return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

}



/**
 * ===============================
 * FORMAT CONDITION
 * ===============================
 */

function formatCondition(value){

    const conditions = {

        new:
        "Baru, belum pernah digunakan",

        like_new:
        "Seperti baru",

        good:
        "Kondisi baik",

        fair:
        "Ada sedikit bekas pemakaian",

        poor:
        "Ada kerusakan atau noda",

        very_poor:
        "Kondisi kurang baik"

    };

    return conditions[value] || value || "-";

}



/**
 * ===============================
 * LOAD PRODUCT DETAIL
 * ===============================
 */

async function loadProduct(){

    if(!productId){

        showError(
            "ID produk tidak ditemukan."
        );

        return;

    }


    try{

        const response =
        await fetch(
            API_URL,
            {
                method:"POST",

                body:JSON.stringify({

                    action:
                    "getProductDetail",

                    product_id:
                    productId

                })
            }
        );


        const result =
        await response.json();


        if(
            result.status !== "success" ||
            !result.product
        ){

            throw new Error(
                result.message ||
                "Produk tidak ditemukan."
            );

        }


        currentProduct =
        result.product;


        renderProduct(
            result.product
        );


        bottomAction.classList.remove(
            "hidden"
        );


    }catch(error){

        console.error(
            "Gagal memuat produk:",
            error
        );

        showError(
            error.message ||
            "Server tidak terhubung"
        );

    }

}



/**
 * ===============================
 * SHOW ERROR
 * ===============================
 */

function showError(message){

    detailContent.classList.add(
        "hidden"
    );

    errorState.classList.remove(
        "hidden"
    );

    errorMessage.textContent =
    message;

}



/**
 * ===============================
 * RENDER PRODUCT
 * ===============================
 */

function renderProduct(product){

    const images =
    Array.isArray(product.images)
    ? product.images
    : [];


    const gallery =
    images.length > 0

    ? images.map(function(url,index){

        return `

            <div class="gallery-item">

                <img
                src="${convertDriveImage(url)}"
                alt="${escapeHtml(product.nama_produk)} ${index + 1}"
                loading="${index === 0 ? "eager" : "lazy"}"
                >

            </div>

        `;

    }).join("")

    : `

        <div class="gallery-placeholder">

            Foto produk tidak tersedia

        </div>

    `;


    const sellerName =

    product.seller?.username ||

    product.seller?.nama_lengkap ||

    "Penjual AdaAja";


    const sellerPhoto =

    convertDriveImage(

        product.seller?.foto_profile ||

        ""

    );


    detailContent.innerHTML = `

        <section class="gallery">

            <div
            class="gallery-track"
            id="galleryTrack">

                ${gallery}

            </div>

            <span
            class="gallery-counter"
            id="galleryCounter">

                1/${Math.max(images.length,1)}

            </span>

        </section>


        <section class="detail-section">

            <h1 class="product-title">

                ${escapeHtml(product.nama_produk)}

            </h1>


            <strong class="product-price">

                ${formatRupiah(product.harga)}

            </strong>


            <div class="product-meta">

                <span class="meta-chip primary">

                    ${escapeHtml(
                        formatCondition(
                            product.kondisi
                        )
                    )}

                </span>


                <span class="meta-chip">

                    Stok ${Number(product.stok || 0)}

                </span>


                <span class="meta-chip">

                    ${escapeHtml(
                        product.ship_from_region ||
                        "Lokasi belum tersedia"
                    )}

                </span>

            </div>

        </section>


        <section class="detail-section">

            <div class="section-title">

                <h2>
                    Deskripsi produk
                </h2>

            </div>

            <p class="product-description">

                ${escapeHtml(product.deskripsi)}

            </p>

        </section>


        <section class="detail-section">

            <div class="section-title">

                <h2>
                    Informasi produk
                </h2>

            </div>


            <div class="info-list">

                <div class="info-row">

                    <span>
                        Kategori
                    </span>

                    <strong>

                        ${escapeHtml(
                            product.category_id ||
                            "-"
                        )}

                    </strong>

                </div>


                <div class="info-row">

                    <span>
                        Merek
                    </span>

                    <strong>

                        ${escapeHtml(
                            product.brand ||
                            "Tidak ada merek"
                        )}

                    </strong>

                </div>


                <div class="info-row">

                    <span>
                        Biaya pengiriman
                    </span>

                    <strong>

                        ${
                            product.shipping_payer === "seller"
                            ? "Ditanggung penjual"
                            : "Ditanggung pembeli"
                        }

                    </strong>

                </div>


                <div class="info-row">

                    <span>
                        Metode pengiriman
                    </span>

                    <strong>

                        ${escapeHtml(
                            product.shipping_method ||
                            "-"
                        )}

                    </strong>

                </div>


                <div class="info-row">

                    <span>
                        Waktu proses
                    </span>

                    <strong>

                        ${escapeHtml(
                            product.processing_time ||
                            "-"
                        )}

                    </strong>

                </div>

            </div>

        </section>


        <section class="detail-section">

            <div class="section-title">

                <h2>
                    Penjual
                </h2>

            </div>


            <a
            href="seller-profile.html?id=${encodeURIComponent(
                product.seller_id || ""
            )}"
            class="seller-card">

                <div class="seller-avatar">

                    ${
                        sellerPhoto

                        ? `

                            <img
                            src="${sellerPhoto}"
                            alt="${escapeHtml(sellerName)}"
                            >

                          `

                        : escapeHtml(
                            sellerName
                            .charAt(0)
                            .toUpperCase()
                          )
                    }

                </div>


                <div class="seller-copy">

                    <strong>

                        ${escapeHtml(sellerName)}

                    </strong>

                    <span>

                        Lihat profil dan produk penjual

                    </span>

                </div>


                <span class="seller-chevron">

                    ›

                </span>

            </a>

        </section>

    `;


    document.title =

    product.nama_produk +

    " - AdaAja";


    document
    .getElementById(
        "modalCurrentPrice"
    )
    .textContent =

    formatRupiah(
        product.harga
    );


    setupGallery();

}



/**
 * ===============================
 * GALLERY SLIDER
 * ===============================
 */

function setupGallery(){

    const track =
    document.getElementById(
        "galleryTrack"
    );

    const counter =
    document.getElementById(
        "galleryCounter"
    );


    if(!track || !counter){
        return;
    }


    const total =
    track.children.length || 1;


    track.addEventListener(
        "scroll",
        function(){

            const index =

            Math.round(

                track.scrollLeft /

                track.clientWidth

            ) + 1;


            counter.textContent =

            Math.min(index,total) +

            "/" +

            total;

        }
    );

}



/**
 * ===============================
 * SHARE PRODUCT
 * ===============================
 */

document
.getElementById("shareButton")
.onclick = async function(){

    try{

        if(navigator.share){

            await navigator.share({

                title:
                currentProduct?.nama_produk ||
                "Produk AdaAja",

                text:
                currentProduct?.nama_produk ||
                "Lihat produk ini di AdaAja",

                url:
                location.href

            });

        }else{

            await navigator.clipboard.writeText(
                location.href
            );

            alert(
                "Link produk berhasil disalin"
            );

        }

    }catch(error){

        console.log(
            "Bagikan dibatalkan:",
            error
        );

    }

};



/**
 * ===============================
 * FAVORITE BUTTON
 * ===============================
 */

document
.getElementById("favoriteButton")
.onclick = function(event){

    if(!currentUser){

        location.href =
        "login.html";

        return;

    }


    event.currentTarget
    .classList.toggle(
        "active"
    );

};



/**
 * ===============================
 * OPEN OFFER MODAL
 * ===============================
 */

document
.getElementById("offerButton")
.onclick = function(){

    currentUser = getUser();


    if(!currentUser){

        location.href =
        "login.html";

        return;

    }


    if(!currentProduct){
        return;
    }


    if(
        String(currentUser.user_id) ===
        String(currentProduct.seller_id)
    ){

        alert(
            "Anda tidak dapat menawar produk sendiri."
        );

        return;

    }


    modalMessage.textContent = "";

    modalMessage.style.color = "";

    offerPrice.value = "";

    offerPrice.dataset.value = "";

    offerHint.textContent = "";


    offerModal
    .classList.add(
        "active"
    );

};



/**
 * ===============================
 * CLOSE OFFER MODAL
 * ===============================
 */

document
.querySelectorAll(
    "[data-close-modal]"
)
.forEach(function(element){

    element.onclick = function(){

        offerModal
        .classList.remove(
            "active"
        );

    };

});



/**
 * ===============================
 * FORMAT OFFER INPUT
 * ===============================
 */

offerPrice.oninput = function(){

    const raw =

    offerPrice.value
    .replace(/\D/g,"")
    .slice(0,12);


    offerPrice.dataset.value =
    raw;


    offerPrice.value =

    raw

    ? new Intl.NumberFormat(
        "id-ID"
      ).format(
        Number(raw)
      )

    : "";


    if(
        currentProduct &&
        raw
    ){

        const difference =

        Number(currentProduct.harga) -

        Number(raw);


        offerHint.textContent =

        difference > 0

        ? formatRupiah(difference) +
          " lebih rendah dari harga sekarang"

        : "Harga penawaran harus lebih rendah dari harga sekarang";

    }else{

        offerHint.textContent = "";

    }

};



/**
 * ===============================
 * SUBMIT OFFER
 * ===============================
 */

document
.getElementById("submitOffer")
.onclick = async function(){

    const submitButton =
    this;


    currentUser =
    getUser();


    const hargaPenawaran =

    Number(

        offerPrice.dataset.value ||

        0

    );


    modalMessage.textContent = "";

    modalMessage.style.color = "";


    if(!currentUser){

        location.href =
        "login.html";

        return;

    }


    if(!currentProduct){

        modalMessage.textContent =

        "Data produk belum tersedia.";

        return;

    }


    if(
        String(currentUser.user_id) ===
        String(currentProduct.seller_id)
    ){

        modalMessage.textContent =

        "Anda tidak dapat menawar produk sendiri.";

        return;

    }


    if(hargaPenawaran <= 0){

        modalMessage.textContent =

        "Masukkan harga penawaran yang benar.";

        return;

    }


    if(
        hargaPenawaran >=
        Number(currentProduct.harga)
    ){

        modalMessage.textContent =

        "Penawaran harus lebih rendah dari harga saat ini.";

        return;

    }


    submitButton.disabled = true;

    submitButton.textContent =
    "Mengirim...";


    try{

        const response =

        await fetch(
            API_URL,
            {

                method:"POST",

                body:JSON.stringify({

                    action:
                    "submitOffer",

                    product_id:
                    currentProduct.product_id,

                    buyer_id:
                    currentUser.user_id,

                    seller_id:
                    currentProduct.seller_id,

                    harga_asli:
                    Number(
                        currentProduct.harga
                    ),

                    harga_penawaran:
                    hargaPenawaran,

                    catatan:
                    ""

                })

            }
        );


        const result =
        await response.json();


        if(
            result.status !== "success"
        ){

            throw new Error(

                result.message ||

                "Penawaran gagal dikirim."

            );

        }


        modalMessage.style.color =
        "#15803d";


        modalMessage.textContent =

        "Penawaran berhasil dikirim kepada penjual.";


        setTimeout(
            function(){

                offerModal
                .classList.remove(
                    "active"
                );


                modalMessage.textContent = "";

                modalMessage.style.color = "";

            },
            1500
        );


    }catch(error){

        console.error(
            "Gagal mengirim penawaran:",
            error
        );


        modalMessage.style.color = "";

        modalMessage.textContent =

        error.message ||

        "Server tidak terhubung.";

    }finally{

        submitButton.disabled = false;

        submitButton.textContent =

        "Kirim Penawaran";

    }

};



/**
 * ===============================
 * BUY BUTTON
 * ===============================
 */

document
.getElementById("buyButton")
.onclick = function(){

    currentUser =
    getUser();


    if(!currentUser){

        location.href =
        "login.html";

        return;

    }


    if(!currentProduct){
        return;
    }


    if(
        String(currentUser.user_id) ===
        String(currentProduct.seller_id)
    ){

        alert(
            "Anda tidak dapat membeli produk sendiri."
        );

        return;

    }


    location.href =

    "checkout.html?id=" +

    encodeURIComponent(

        currentProduct.product_id

    );

};



/**
 * ===============================
 * START PAGE
 * ===============================
 */

loadProduct();
