const API_URL =
  "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const GOOGLE_CLIENT_ID =
  "670578392878-jarugitvplh7mep4qamh2o7qrn6jmldf.apps.googleusercontent.com";

const form = document.getElementById("registerForm");
const registerButton = document.getElementById("registerButton");
const message = document.getElementById("message");
const googleStatus = document.getElementById("googleStatus");
const googleButtonContainer = document.getElementById(
  "googleButtonContainer"
);

let googleLoginInitialized = false;
let googleLoginProcessing = false;

/**
 * ======================================
 * UTILITAS PESAN
 * ======================================
 */

function setMessage(text = "", type = "") {
  if (!message) return;

  message.className = type;
  message.textContent = text;
}

function setGoogleStatus(text = "", type = "") {
  if (!googleStatus) return;

  googleStatus.className = `google-status ${type}`.trim();
  googleStatus.textContent = text;
}

function setLoading(isLoading) {
  if (!registerButton) return;

  registerButton.disabled = isLoading;

  const buttonText = registerButton.querySelector("span");

  if (buttonText) {
    buttonText.textContent = isLoading
      ? "Mengirim kode OTP..."
      : "Buat Akun AdaAja";
  }

  registerButton.classList.toggle("loading", isLoading);
}

/**
 * ======================================
 * VALIDASI EMAIL
 * ======================================
 */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * ======================================
 * TOGGLE PASSWORD
 * ======================================
 */

document
  .querySelectorAll(".toggle-password")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      const input = document.getElementById(targetId);

      if (!input) return;

      const shouldShow = input.type === "password";

      input.type = shouldShow ? "text" : "password";

      button.classList.toggle(
        "visible",
        shouldShow
      );

      button.setAttribute(
        "aria-label",
        shouldShow
          ? "Sembunyikan password"
          : "Tampilkan password"
      );
    });
  });

/**
 * ======================================
 * REGISTER DENGAN EMAIL + OTP
 * ======================================
 */

async function register() {
  const nameInput =
    document.getElementById("name");

  const contactInput =
    document.getElementById("contact");

  const passwordInput =
    document.getElementById("password");

  const confirmInput =
    document.getElementById("confirm");

  const agreeInput =
    document.getElementById("agree");

  const username =
    nameInput?.value.trim() || "";

  const email =
    contactInput?.value.trim().toLowerCase() || "";

  const passwordValue =
    passwordInput?.value || "";

  const confirmValue =
    confirmInput?.value || "";

  if (
    !username ||
    !email ||
    !passwordValue ||
    !confirmValue
  ) {
    setMessage(
      "Lengkapi semua data terlebih dahulu.",
      "error"
    );
    return;
  }

  if (!isValidEmail(email)) {
    setMessage(
      "Masukkan alamat email yang valid.",
      "error"
    );
    contactInput?.focus();
    return;
  }

  if (passwordValue.length < 8) {
    setMessage(
      "Password minimal 8 karakter.",
      "error"
    );
    passwordInput?.focus();
    return;
  }

  if (passwordValue !== confirmValue) {
    setMessage(
      "Konfirmasi password belum sama.",
      "error"
    );
    confirmInput?.focus();
    return;
  }

  if (!agreeInput?.checked) {
    setMessage(
      "Setujui Syarat & Ketentuan dan Kebijakan Privasi terlebih dahulu.",
      "error"
    );
    return;
  }

  setLoading(true);
  setMessage(
    "Mengirim kode OTP ke email Anda..."
  );

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type":
          "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "sendOTP",
        email
      })
    });

    if (!response.ok) {
      throw new Error(
        `Server merespons dengan status ${response.status}.`
      );
    }

    const result = await response.json();

    if (result.status !== "success") {
      throw new Error(
        result.message ||
          "Kode OTP gagal dikirim."
      );
    }

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

    setMessage(
      "Kode OTP berhasil dikirim.",
      "success"
    );

    window.setTimeout(() => {
      window.location.href = "otp.html";
    }, 1000);
  } catch (error) {
    console.error(
      "Register error:",
      error
    );

    setMessage(
      error.message ||
        "Gagal terhubung ke server.",
      "error"
    );

    setLoading(false);
  }
}

if (form) {
  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      register();
    }
  );
}

/**
 * ======================================
 * GOOGLE LOGIN
 * ======================================
 */

function setGoogleProcessing(
  isProcessing
) {
  googleLoginProcessing =
    isProcessing;

  if (!googleButtonContainer) {
    return;
  }

  googleButtonContainer.classList.toggle(
    "processing",
    isProcessing
  );

  googleButtonContainer.style.pointerEvents =
    isProcessing ? "none" : "";

  googleButtonContainer.style.opacity =
    isProcessing ? "0.65" : "";
}

async function handleGoogleCredential(
  response
) {
  if (googleLoginProcessing) {
    return;
  }

  if (!response?.credential) {
    setGoogleStatus(
      "Autentikasi Google dibatalkan atau gagal.",
      "error"
    );
    return;
  }

  setGoogleProcessing(true);

  setGoogleStatus(
    "Memverifikasi akun Google..."
  );

  try {
    const apiResponse = await fetch(
      API_URL,
      {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "googleLogin",
          credential:
            response.credential
        })
      }
    );

    if (!apiResponse.ok) {
      throw new Error(
        `Server merespons dengan status ${apiResponse.status}.`
      );
    }

    const result =
      await apiResponse.json();

    if (
      result.status !== "success" ||
      !result.user
    ) {
      throw new Error(
        result.message ||
          "Akun Google belum dapat digunakan."
      );
    }

    localStorage.setItem(
      "user",
      JSON.stringify(result.user)
    );

    localStorage.removeItem(
      "register_email"
    );

    localStorage.removeItem(
      "register_username"
    );

    localStorage.removeItem(
      "register_password"
    );

    setGoogleStatus(
      result.is_new_user
        ? "Akun Google berhasil dibuat."
        : "Berhasil masuk dengan Google.",
      "success"
    );

    let redirectPage;

    if (
      result.is_new_user ||
      result.profile_complete === false
    ) {
      redirectPage =
        "complete-account.html";
    } else {
      redirectPage =
        localStorage.getItem(
          "redirectAfterLogin"
        ) || "home.html";
    }

    localStorage.removeItem(
      "redirectAfterLogin"
    );

    window.setTimeout(() => {
      window.location.href =
        redirectPage;
    }, 700);
  } catch (error) {
    console.error(
      "Google login error:",
      error
    );

    setGoogleStatus(
      error.message ||
        "Gagal terhubung ke layanan login Google.",
      "error"
    );

    setGoogleProcessing(false);
  }
}

/**
 * ======================================
 * RENDER TOMBOL GOOGLE RESMI
 * ======================================
 */

function renderGoogleButton() {
  if (
    googleLoginInitialized ||
    !googleButtonContainer
  ) {
    return;
  }

  if (
    !window.google?.accounts?.id
  ) {
    return;
  }

  googleLoginInitialized = true;

  googleButtonContainer.innerHTML = "";

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback:
      handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: true,
    context: "signup",
    ux_mode: "popup"
  });

  const containerWidth =
    googleButtonContainer
      .getBoundingClientRect()
      .width;

  google.accounts.id.renderButton(
    googleButtonContainer,
    {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: Math.floor(
        Math.min(
          380,
          Math.max(
            240,
            containerWidth || 340
          )
        )
      )
    }
  );

  setGoogleStatus("");
}

/**
 * Library Google dimuat secara async.
 * Fungsi ini mencoba beberapa kali sampai
 * Google Identity Services tersedia.
 */

function initializeGoogleLogin(
  attempt = 0
) {
  if (
    window.google?.accounts?.id
  ) {
    renderGoogleButton();
    return;
  }

  if (attempt >= 20) {
    setGoogleStatus(
      "Layanan Google belum berhasil dimuat. Muat ulang halaman dan coba kembali.",
      "error"
    );
    return;
  }

  window.setTimeout(() => {
    initializeGoogleLogin(
      attempt + 1
    );
  }, 250);
}

window.addEventListener(
  "load",
  () => {
    initializeGoogleLogin();
  }
);
