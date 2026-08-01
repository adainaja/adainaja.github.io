const API_URL="https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";
const email=localStorage.getItem("register_email");
const username=localStorage.getItem("register_username");
document.getElementById("emailText").innerHTML=email;

function getOTP(){
 let c="";
 document.querySelectorAll(".otp-input input").forEach(x=>c+=x.value);
 return c;
}

async function verify(){
 let message=document.getElementById("message");
 let r=await fetch(API_URL,{method:"POST",body:JSON.stringify({action:"verifyOTP",email:email,kode:getOTP()})});
 let result=await r.json();
 if(result.status==="success"){message.className="success";message.innerHTML="OTP berhasil diverifikasi";setTimeout(register,1000);}
 else{message.className="error";message.innerHTML=result.message;}
}

async function register(){
 let r=await fetch(API_URL,{method:"POST",body:JSON.stringify({action:"registerUser",email:email,username:username,nama_lengkap:""})});
 let result=await r.json();
 if(result.status==="success") location.href="complete-account.html";
}

function resend(){
 fetch(API_URL,{method:"POST",body:JSON.stringify({action:"sendOTP",email:email})});
 alert("Kode OTP baru telah dikirim");
}