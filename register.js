const API_URL = "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

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

document.getElementById("googleButton").addEventListener("click", () => {
  setMessage("Login Google belum diaktifkan.");
});
