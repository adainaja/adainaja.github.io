const API_URL = "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

// Ganti dengan OAuth 2.0 Client ID jenis Web Application dari Google Cloud Console.
const GOOGLE_CLIENT_ID = "670578392878-jarugitvplh7mep4qamh2o7qrn6jmldf.apps.googleusercontent.com";

const form = document.getElementById("registerForm");
const registerButton = document.getElementById("registerButton");
const message = document.getElementById("message");

function setMessage(text, type = "") {
  message.className = type;
  message.textContent = text;
}

function setLoading(isLoading) {
  registerButton.disabled = isLoading;
  registerButton.querySelector("span").textContent = isLoading
    ? "Mengirim kode OTP..."
    : "Buat Akun AdaAja";
}

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.classList.toggle("visible", show);
    button.setAttribute("aria-label", show ? "Sembunyikan password" : "Tampilkan password");
  });
});

async function register() {
  const username = document.getElementById("name").value.trim();
  const email = document.getElementById("contact").value.trim();
  const passwordValue = document.getElementById("password").value;
  const confirmValue = document.getElementById("confirm").value;
  const agree = document.getElementById("agree");

  if (!username || !email || !passwordValue || !confirmValue) {
    setMessage("Lengkapi semua data terlebih dahulu.", "error");
    return;
  }

  if (passwordValue.length < 8) {
    setMessage("Password minimal 8 karakter.", "error");
    return;
  }

  if (passwordValue !== confirmValue) {
    setMessage("Konfirmasi password belum sama.", "error");
    return;
  }

  if (!agree.checked) {
    setMessage("Setujui syarat dan ketentuan terlebih dahulu.", "error");
    return;
  }

  setLoading(true);
  setMessage("Mengirim kode OTP ke email Anda...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "sendOTP", email })
    });

    const result = await response.json();

    if (result.status === "success") {
      localStorage.setItem("register_email", email);
      localStorage.setItem("register_username", username);
      localStorage.setItem("register_password", passwordValue);

      setMessage("Kode OTP berhasil dikirim.", "success");
      setTimeout(() => {
        location.href = "otp.html";
      }, 1100);
      return;
    }

    throw new Error(result.message || "Kode OTP gagal dikirim.");
  } catch (error) {
    setMessage(error.message || "Gagal terhubung ke server.", "error");
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  register();
});

const googleStatus = document.getElementById("googleStatus");

function setGoogleStatus(text, type = "") {
  googleStatus.className = `google-status ${type}`.trim();
  googleStatus.textContent = text;
}

async function handleGoogleCredential(response) {
  if (!response?.credential) {
    setGoogleStatus("Autentikasi Google dibatalkan atau gagal.", "error");
    return;
  }

  setGoogleStatus("Memverifikasi akun Google...");

  try {
    const apiResponse = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "googleLogin",
        credential: response.credential
      })
    });

    const result = await apiResponse.json();

    if (result.status !== "success" || !result.user) {
      throw new Error(result.message || "Akun Google belum dapat digunakan.");
    }

    localStorage.setItem("user", JSON.stringify(result.user));
    setGoogleStatus("Berhasil masuk dengan Google.", "success");

    const redirect = localStorage.getItem("redirectAfterLogin") || "home.html";
    localStorage.removeItem("redirectAfterLogin");

    setTimeout(() => {
      location.href = redirect;
    }, 700);
  } catch (error) {
    setGoogleStatus(error.message || "Gagal terhubung ke layanan login.", "error");
  }
}

function initializeGoogleLogin() {
  const container = document.getElementById("googleButtonContainer");

  if (!window.google?.accounts?.id) {
    setGoogleStatus("Layanan Google belum berhasil dimuat.", "error");
    return;
  }

  if (GOOGLE_CLIENT_ID.startsWith("GANTI_DENGAN_")) {
    container.innerHTML = `<button class="google-setup-button" type="button">Lanjutkan dengan Google</button>`;
    container.querySelector("button").addEventListener("click", () => {
      setGoogleStatus("Masukkan Google Client ID terlebih dahulu di register.js.", "error");
    });
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true
  });

  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: Math.min(380, container.clientWidth || 340)
  });
}

window.addEventListener("load", initializeGoogleLogin);
