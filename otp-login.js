const API_URL="https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";


async function verifyLogin(){

const kode=document.getElementById("otp").value;
const email=localStorage.getItem("login_email");

const message=document.getElementById("message");


if(!kode || kode.length!==6){

message.className="error";
message.innerHTML="Masukkan kode OTP 6 digit";
return;

}


try{


const response=await fetch(API_URL,{

method:"POST",

body:JSON.stringify({

action:"verifyOTP",

email:email,

kode:kode

})

});


const result=await response.json();


if(result.status==="success"){


const login=await fetch(API_URL,{

method:"POST",

body:JSON.stringify({

action:"loginUser",

email:email

})

});


const userData=await login.json();


if(userData.status==="success"){


localStorage.setItem(
"user",
JSON.stringify(userData.user)
);


message.className="success";
message.innerHTML="Login berhasil";


setTimeout(()=>{

location.href="home.html";

},1000);


}


}else{


message.className="error";
message.innerHTML=result.message;


}


}catch(error){

message.className="error";
message.innerHTML="Server tidak terhubung";

}


}
