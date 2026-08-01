const API_URL = "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";


function toggle(id){

    let x=document.getElementById(id);

    x.type = x.type === "password" 
    ? "text" 
    : "password";

}



async function register(){

    let username = document.getElementById("name").value;
    let email = document.getElementById("contact").value;
    let passwordValue = document.getElementById("password").value;
    let confirmValue = document.getElementById("confirm").value;

    let m=document.getElementById("message");


    if(
        !username ||
        !email ||
        !passwordValue ||
        !confirmValue
    ){

        m.className="error";
        m.innerHTML="Lengkapi semua data";
        return;

    }


    if(passwordValue.length < 8){

        m.className="error";
        m.innerHTML="Password minimal 8 karakter";
        return;

    }


    if(passwordValue !== confirmValue){

        m.className="error";
        m.innerHTML="Password tidak sama";
        return;

    }


    if(!agree.checked){

        m.className="error";
        m.innerHTML="Setujui syarat terlebih dahulu";
        return;

    }



    m.innerHTML="Mengirim kode OTP...";



    try{


        let response = await fetch(API_URL,{

            method:"POST",

            body:JSON.stringify({

                action:"sendOTP",
                email:email

            })

        });



        let result = await response.json();



        if(result.status==="success"){


            localStorage.setItem(
                "register_email",
                email
            );


            localStorage.setItem(
                "register_username",
                username
            );


            localStorage.setItem(
                "register_password",
                passwordValue
            );



            m.className="success";

            m.innerHTML=
            "Kode OTP sudah dikirim ke email";


            setTimeout(()=>{


                location.href="otp.html";


            },1500);



        }
        else{


            m.className="error";
            m.innerHTML=result.message;


        }



    }
    catch(error){


        console.log(error);

        m.className="error";

        m.innerHTML=
        "Gagal terhubung server";


    }


}
