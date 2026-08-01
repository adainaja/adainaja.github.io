const API_URL="https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";


async function sendOTP(){

const email=document.getElementById("email").value.trim();
const message=document.getElementById("message");


if(!email){

message.className="error";
message.innerHTML="Masukkan email terlebih dahulu";
return;

}


message.innerHTML="Mengirim OTP...";


try{

const response=await fetch(API_URL,{
method:"POST",
body:JSON.stringify({
action:"sendOTP",
email:email
})
});


const result=await response.json();


if(result.status==="success"){

localStorage.setItem("login_email",email);

message.className="success";
message.innerHTML="OTP berhasil dikirim";


setTimeout(()=>{

location.href="otp-login.html";

},1000);


}else{

message.className="error";
message.innerHTML=result.message;

}


}catch(error){

message.className="error";
message.innerHTML="Gagal terhubung server";

}


}
