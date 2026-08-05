const API_URL =
  "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const emailInput = document.getElementById("email");
const message = document.getElementById("message");
const sendOtpButton = document.getElementById("sendOtpButton");

function getUser(){
  try{
    return JSON.parse(localStorage.getItem("user") || "null");
  }catch{
    return null;
  }
}

function setMessage(text="",type=""){
  message.className = `message ${type}`.trim();
  message.textContent = text;
}

function setLoading(isLoading){
  sendOtpButton.disabled = isLoading;

  const title = sendOtpButton.querySelector(".button-copy strong");
  const subtitle = sendOtpButton.querySelector(".button-copy small");

  if(title){
    title.textContent = isLoading ? "Mengirim kode..." : "Kirim Kode OTP";
  }

  if(subtitle){
    subtitle.textContent = isLoading ? "Mohon tunggu sebentar" : "Verifikasi melalui email";
  }
}

function isValidEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendOTP(){
  const email = emailInput.value.trim().toLowerCase();

  if(!email){
    setMessage("Masukkan email terlebih dahulu.","error");
    emailInput.focus();
    return;
  }

  if(!isValidEmail(email)){
    setMessage("Masukkan alamat email yang valid.","error");
    emailInput.focus();
    return;
  }

  setLoading(true);
  setMessage("Mengirim kode OTP ke email Anda...");

  try{
    const response = await fetch(API_URL,{
      method:"POST",
      redirect:"follow",
      headers:{
        "Content-Type":"text/plain;charset=utf-8"
      },
      body:JSON.stringify({
        action:"sendOTP",
        email
      })
    });

    if(!response.ok){
      throw new Error(`Server merespons dengan status ${response.status}.`);
    }

    const result = await response.json();

    if(result.status !== "success"){
      throw new Error(result.message || "Kode OTP gagal dikirim.");
    }

    localStorage.setItem("login_email",email);
    setMessage("Kode OTP berhasil dikirim.","success");

    setTimeout(()=>{
      location.href="otp-login.html";
    },900);

  }catch(error){
    console.error("Login OTP error:",error);
    setMessage(error.message || "Gagal terhubung ke server.","error");
    setLoading(false);
  }
}

sendOtpButton.addEventListener("click",sendOTP);

emailInput.addEventListener("keydown",(event)=>{
  if(event.key === "Enter"){
    event.preventDefault();
    sendOTP();
  }
});

document.querySelectorAll("[data-auth-required='true']").forEach((link)=>{
  link.addEventListener("click",(event)=>{
    if(getUser()) return;

    event.preventDefault();
    localStorage.setItem("redirectAfterLogin",link.getAttribute("href"));
    location.href="login.html";
  });
});

const existingUser = getUser();

if(existingUser){
  document.querySelector(".welcome-card h1").textContent = "Akun Anda sudah aktif";
  document.querySelector(".welcome-card > p").textContent =
    "Anda sudah masuk ke AdaAja. Gunakan navigasi di bawah untuk melanjutkan.";
}
