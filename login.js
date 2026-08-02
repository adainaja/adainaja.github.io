const API_URL =
"https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";


async function sendOTP(){

    const emailInput =
    document.getElementById("email");

    const message =
    document.getElementById("message");

    const email =
    emailInput.value.trim();


    if(!email){

        message.className = "error";

        message.textContent =
        "Masukkan email terlebih dahulu";

        emailInput.focus();

        return;

    }


    const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if(!emailPattern.test(email)){

        message.className = "error";

        message.textContent =
        "Format email tidak valid";

        emailInput.focus();

        return;

    }


    message.className = "";

    message.textContent =
    "Mengirim OTP...";


    try{

        const response =
        await fetch(API_URL,{

            method:"POST",

            redirect:"follow",

            headers:{

                "Content-Type":
                "text/plain;charset=utf-8"

            },

            body:JSON.stringify({

                action:"sendOTP",

                email:email

            })

        });


        const responseText =
        await response.text();


        if(!response.ok){

            console.error(
                "HTTP Error:",
                response.status,
                responseText
            );

            throw new Error(
                "HTTP " + response.status
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

            throw new Error(
                "Respons server tidak valid"
            );

        }


        if(result.status === "success"){

            localStorage.setItem(
                "login_email",
                email
            );


            message.className =
            "success";

            message.textContent =
            "OTP berhasil dikirim";


            setTimeout(function(){

                location.href =
                "otp-login.html";

            },1000);

        }else{

            message.className =
            "error";

            message.textContent =
            result.message ||
            "OTP gagal dikirim";

        }


    }catch(error){

        console.error(
            "Gagal mengirim OTP:",
            error
        );


        message.className =
        "error";


        if(
            error.message.includes("404")
        ){

            message.textContent =
            "Endpoint server tidak ditemukan";

        }else if(
            error.message.includes(
                "Respons server tidak valid"
            )
        ){

            message.textContent =
            "Respons server tidak valid";

        }else{

            message.textContent =
            "Gagal terhubung server";

        }

    }

}
