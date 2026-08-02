const API_URL =
"https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";


const box =
document.getElementById("offersContainer");

const modal =
document.getElementById("confirmModal");

const modalTitle =
document.getElementById("modalTitle");

const modalText =
document.getElementById("modalText");

const confirmAction =
document.getElementById("confirmAction");

const refreshButton =
document.getElementById("refreshButton");


let offers = [];

let filter = "all";

let pending = null;



/**
 * =====================================
 * USER SESSION
 * =====================================
 */

function user(){

    try{

        return JSON.parse(
            localStorage.getItem("user") ||
            "null"
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
 * =====================================
 * FORMAT RUPIAH
 * =====================================
 */

function money(value){

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
 * =====================================
 * ESCAPE HTML
 * =====================================
 */

function esc(value){

    return String(value || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

}



/**
 * =====================================
 * CONVERT GOOGLE DRIVE IMAGE
 * =====================================
 */

function img(url){

    if(!url){
        return "";
    }


    if(
        url.includes(
            "drive.google.com"
        )
    ){

        const id =
        url.match(/[-\w]{25,}/);


        if(id){

            return (
                "https://drive.google.com/thumbnail?id=" +
                id[0] +
                "&sz=w400"
            );

        }

    }


    return url;

}



/**
 * =====================================
 * FORMAT DATE
 * =====================================
 */

function date(value){

    const itemDate =
    new Date(value);


    if(
        Number.isNaN(
            itemDate.getTime()
        )
    ){

        return "-";

    }


    return new Intl.DateTimeFormat(
        "id-ID",
        {
            day:"2-digit",
            month:"short",
            year:"numeric"
        }
    ).format(itemDate);

}



/**
 * =====================================
 * STATUS LABEL
 * =====================================
 */

function statusLabel(value){

    const labels = {

        pending:"Menunggu",

        accepted:"Diterima",

        rejected:"Ditolak",

        cancelled:"Dibatalkan"

    };


    return labels[value] ||
    value ||
    "-";

}



/**
 * =====================================
 * DELAY
 * =====================================
 */

function delay(milliseconds){

    return new Promise(
        function(resolve){

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}



/**
 * =====================================
 * REQUEST KE APPS SCRIPT
 *
 * Respons dibaca sebagai text dahulu,
 * supaya HTML error tidak langsung
 * menyebabkan response.json() gagal.
 * =====================================
 */

async function apiPost(
    payload,
    retryCount = 1
){

    let lastError = null;


    for(
        let attempt = 0;
        attempt <= retryCount;
        attempt++
    ){

        try{

            const controller =
            new AbortController();


            const timeout =
            setTimeout(
                function(){

                    controller.abort();

                },
                30000
            );


            const response =
            await fetch(
                API_URL +
                "?request_time=" +
                Date.now(),
                {

                    method:"POST",

                    redirect:"follow",

                    headers:{

                        "Content-Type":
                        "text/plain;charset=utf-8"

                    },

                    body:
                    JSON.stringify(payload),

                    signal:
                    controller.signal

                }
            );


            clearTimeout(timeout);


            const responseText =
            await response.text();


            if(!response.ok){

                console.error(
                    "HTTP error:",
                    response.status,
                    responseText
                );


                throw new Error(
                    "Server mengembalikan HTTP " +
                    response.status
                );

            }


            let result;


            try{

                result =
                JSON.parse(responseText);

            }catch(parseError){

                console.error(
                    "Respons server bukan JSON:",
                    responseText
                );


                if(
                    responseText
                    .trim()
                    .startsWith("<")
                ){

                    throw new Error(
                        "Server mengirim halaman HTML, bukan data JSON. Pastikan Apps Script sudah di-deploy sebagai Web App terbaru."
                    );

                }


                throw new Error(
                    "Respons server tidak valid."
                );

            }


            return result;


        }catch(error){

            lastError = error;


            console.error(
                "API request gagal, percobaan:",
                attempt + 1,
                error
            );


            if(
                attempt < retryCount
            ){

                await delay(1000);

            }

        }

    }


    if(
        lastError?.name ===
        "AbortError"
    ){

        throw new Error(
            "Server terlalu lama merespons."
        );

    }


    throw lastError ||
    new Error(
        "Server tidak terhubung."
    );

}



/**
 * =====================================
 * LOAD SELLER OFFERS
 * =====================================
 */

async function load(){

    const currentUser =
    user();


    if(
        !currentUser?.user_id
    ){

        location.href =
        "login.html";

        return;

    }


    box.innerHTML = `

        <section class="state">

            <div class="spinner"></div>

            <strong>
                Memuat penawaran...
            </strong>

        </section>

    `;


    try{

        const result =
        await apiPost({

            action:
            "getSellerOffers",

            seller_id:
            currentUser.user_id

        });


        if(
            result.status !==
            "success"
        ){

            throw new Error(
                result.message ||
                "Gagal memuat penawaran."
            );

        }


        if(
            !Array.isArray(
                result.offers
            )
        ){

            throw new Error(
                "Format data penawaran tidak valid."
            );

        }


        offers =
        result.offers;


        summary();

        render();


    }catch(error){

        console.error(
            "Gagal memuat penawaran:",
            error
        );


        box.innerHTML = `

            <section class="state">

                <strong>
                    Penawaran belum dapat dimuat
                </strong>

                <span>
                    ${esc(
                        error.message ||
                        "Server tidak terhubung."
                    )}
                </span>

            </section>

        `;

    }

}



/**
 * =====================================
 * SUMMARY
 * =====================================
 */

function summary(){

    document
    .getElementById(
        "pendingCount"
    )
    .textContent =

    offers.filter(
        function(item){

            return (
                item.status ===
                "pending"
            );

        }
    ).length;


    document
    .getElementById(
        "acceptedCount"
    )
    .textContent =

    offers.filter(
        function(item){

            return (
                item.status ===
                "accepted"
            );

        }
    ).length;


    document
    .getElementById(
        "rejectedCount"
    )
    .textContent =

    offers.filter(
        function(item){

            return (
                item.status ===
                "rejected"
            );

        }
    ).length;

}



/**
 * =====================================
 * RENDER LIST
 * =====================================
 */

function render(){

    const data =

    filter === "all"

    ? offers

    : offers.filter(
        function(item){

            return (
                item.status ===
                filter
            );

        }
    );


    if(
        data.length === 0
    ){

        box.innerHTML = `

            <section class="state">

                <strong>
                    Belum ada penawaran
                </strong>

                <span>
                    Penawaran pembeli akan tampil di sini.
                </span>

            </section>

        `;

        return;

    }


    box.innerHTML =

    data
    .map(card)
    .join("");


    document
    .querySelectorAll(
        "[data-accept]"
    )
    .forEach(
        function(button){

            button.onclick =
            function(){

                openModal(
                    button.dataset.accept,
                    "accepted"
                );

            };

        }
    );


    document
    .querySelectorAll(
        "[data-reject]"
    )
    .forEach(
        function(button){

            button.onclick =
            function(){

                openModal(
                    button.dataset.reject,
                    "rejected"
                );

            };

        }
    );

}



/**
 * =====================================
 * OFFER CARD
 * =====================================
 */

function card(offer){

    const photo =
    img(
        offer.image_url ||
        ""
    );


    const photoHtml =

    photo

    ? `

        <img
        src="${photo}"
        alt="${esc(
            offer.nama_produk
        )}"
        loading="lazy"
        >

      `

    : `

        <div class="placeholder">

            Foto tidak tersedia

        </div>

      `;


    let action = "";


    if(
        offer.status ===
        "pending"
    ){

        action = `

            <div class="actions">

                <button
                class="reject"
                data-reject="${esc(
                    offer.offer_id
                )}">

                    Tolak

                </button>


                <button
                class="accept"
                data-accept="${esc(
                    offer.offer_id
                )}">

                    Terima

                </button>

            </div>

        `;

    }else{

        action = `

            <div
            class="done-note ${esc(
                offer.status
            )}">

                Penawaran
                ${esc(
                    statusLabel(
                        offer.status
                    ).toLowerCase()
                )}

            </div>

        `;

    }


    return `

        <article class="offer-card">

            <div class="offer-main">

                <div class="product-image">

                    ${photoHtml}

                </div>


                <div>

                    <div class="status-row">

                        <span
                        class="badge ${esc(
                            offer.status
                        )}">

                            ${esc(
                                statusLabel(
                                    offer.status
                                )
                            )}

                        </span>


                        <span class="date">

                            ${esc(
                                date(
                                    offer.created_at
                                )
                            )}

                        </span>

                    </div>


                    <h2 class="product-name">

                        ${esc(
                            offer.nama_produk ||
                            "Produk"
                        )}

                    </h2>


                    <div class="buyer">

                        Ditawar oleh

                        ${esc(
                            offer.buyer_name ||
                            offer.buyer_id ||
                            "Pembeli"
                        )}

                    </div>


                    <div class="prices">

                        <div>

                            <span>
                                Harga produk
                            </span>

                            <strong>

                                ${money(
                                    offer.harga_asli
                                )}

                            </strong>

                        </div>


                        <div class="offer">

                            <span>
                                Harga ditawar
                            </span>

                            <strong>

                                ${money(
                                    offer.harga_penawaran
                                )}

                            </strong>

                        </div>

                    </div>

                </div>

            </div>


            ${
                offer.catatan

                ? `

                    <p class="note">

                        ${esc(
                            offer.catatan
                        )}

                    </p>

                  `

                : ""
            }


            ${action}

        </article>

    `;

}



/**
 * =====================================
 * OPEN CONFIRMATION MODAL
 * =====================================
 */

function openModal(
    offerId,
    status
){

    pending = {

        id:offerId,

        status:status

    };


    if(
        status ===
        "accepted"
    ){

        modalTitle.textContent =
        "Terima penawaran?";


        modalText.textContent =
        "Pembeli dapat melanjutkan checkout dengan harga ini.";


        confirmAction.textContent =
        "Terima";

    }else{

        modalTitle.textContent =
        "Tolak penawaran?";


        modalText.textContent =
        "Penawaran akan ditandai sebagai ditolak.";


        confirmAction.textContent =
        "Tolak";

    }


    modal.classList.add(
        "active"
    );

}



/**
 * =====================================
 * CLOSE MODAL
 * =====================================
 */

function closeModal(){

    modal.classList.remove(
        "active"
    );

    pending = null;

}



/**
 * Tombol tutup modal
 */

document
.querySelectorAll(
    "[data-close]"
)
.forEach(
    function(element){

        element.onclick =
        closeModal;

    }
);



/**
 * =====================================
 * CONFIRM ACCEPT / REJECT
 * =====================================
 */

confirmAction.onclick =
async function(){

    if(!pending){
        return;
    }


    const currentUser =
    user();


    if(
        !currentUser?.user_id
    ){

        location.href =
        "login.html";

        return;

    }


    /*
     * Salin data pending terlebih dahulu.
     * Jadi tetap aman jika modal ditutup.
     */

    const requestData = {

        offerId:
        pending.id,

        status:
        pending.status

    };


    const originalText =
    requestData.status ===
    "accepted"

    ? "Terima"

    : "Tolak";


    this.disabled = true;

    this.textContent =
    "Memproses...";


    try{

        const result =
        await apiPost({

            action:
            "updateOfferStatus",

            offer_id:
            requestData.offerId,

            seller_id:
            currentUser.user_id,

            status:
            requestData.status

        });


        if(
            result.status !==
            "success"
        ){

            throw new Error(
                result.message ||
                "Gagal memperbarui penawaran."
            );

        }


        closeModal();


        await load();


    }catch(error){

        console.error(
            "Update penawaran gagal:",
            error
        );


        alert(
            error.message ||
            "Server tidak terhubung."
        );

    }finally{

        this.disabled = false;

        this.textContent =
        originalText;

    }

};



/**
 * =====================================
 * FILTER BUTTONS
 * =====================================
 */

document
.querySelectorAll(
    ".tabs button"
)
.forEach(
    function(button){

        button.onclick =
        function(){

            document
            .querySelectorAll(
                ".tabs button"
            )
            .forEach(
                function(item){

                    item.classList.remove(
                        "active"
                    );

                }
            );


            button.classList.add(
                "active"
            );


            filter =
            button.dataset.status;


            render();

        };

    }
);



/**
 * =====================================
 * REFRESH
 * =====================================
 */

if(refreshButton){

    refreshButton.onclick =
    load;

}



/**
 * =====================================
 * START PAGE
 * =====================================
 */

load();
