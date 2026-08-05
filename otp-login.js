const API_URL =
  "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const otpHidden =
  document.getElementById("otp");

const otpDigits =
  Array.from(
    document.querySelectorAll(".otp-digit")
  );

const message =
  document.getElementById("message");

const verifyButton =
  document.getElementById("verifyButton");

const resendButton =
  document.getElementById("resendButton");

const resendTimer =
  document.getElementById("resendTimer");

const loginEmail =
  (localStorage.getItem("login_email") || "")
    .trim()
    .toLowerCase();

let resendSeconds = 30;
let resendInterval = null;

function getUser() {
  try {
    return JSON.parse(
      localStorage.getItem("user") || "null"
    );
  } catch {
    return null;
  }
}

function maskEmail(email) {
  if (!email || !email.includes("@")) {
    return "email Anda";
  }

  const [name, domain] =
    email.split("@");

  const visible =
    name.slice(0, Math.min(2, name.length));

  const masked =
    `${visible}${"*".repeat(Math.max(3, name.length - visible.length))}`;

  return `${masked}@${domain}`;
}

function setMessage(text = "", type = "") {
  message.className =
    `message ${type}`.trim();

  message.textContent = text;
}

function setLoading(isLoading) {
  verifyButton.disabled = isLoading;

  const title =
    verifyButton.querySelector(
      ".button-copy strong"
    );

  const subtitle =
    verifyButton.querySelector(
      ".button-copy small"
    );

  if (title) {
    title.textContent = isLoading
      ? "Memverifikasi..."
      : "Verifikasi & Masuk";
  }

  if (subtitle) {
    subtitle.textContent = isLoading
      ? "Mohon tunggu sebentar"
      : "Lanjutkan ke akun AdaAja";
  }
}

function syncOtpValue() {
  const code =
    otpDigits
      .map((input) => input.value)
      .join("");

  otpHidden.value = code;

  otpDigits.forEach((input) => {
    input.classList.toggle(
      "filled",
      Boolean(input.value)
    );
  });
}

otpDigits.forEach((input, index) => {
  input.addEventListener("input", () => {
    input.value =
      input.value.replace(/\D/g, "").slice(0, 1);

    syncOtpValue();

    if (
      input.value &&
      index < otpDigits.length - 1
    ) {
      otpDigits[index + 1].focus();
    }

    if (otpHidden.value.length === 6) {
      verifyButton.focus();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (
      event.key === "Backspace" &&
      !input.value &&
      index > 0
    ) {
      otpDigits[index - 1].focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      otpDigits[index - 1].focus();
    }

    if (
      event.key === "ArrowRight" &&
      index < otpDigits.length - 1
    ) {
      otpDigits[index + 1].focus();
    }

    if (event.key === "Enter") {
      event.preventDefault();
      verifyLogin();
    }
  });

  input.addEventListener("paste", (event) => {
    event.preventDefault();

    const pasted =
      event.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 6);

    pasted.split("").forEach((digit, position) => {
      if (otpDigits[position]) {
        otpDigits[position].value = digit;
      }
    });

    syncOtpValue();

    const nextIndex =
      Math.min(pasted.length, 5);

    otpDigits[nextIndex].focus();
  });
});

async function verifyLogin() {
  const kode =
    otpHidden.value;

  if (!loginEmail) {
    setMessage(
      "Email login tidak ditemukan. Silakan kembali ke halaman masuk.",
      "error"
    );
    return;
  }

  if (!kode || kode.length !== 6) {
    setMessage(
      "Masukkan kode OTP 6 digit.",
      "error"
    );

    otpDigits.find((input) => !input.value)?.focus();
    return;
  }

  setLoading(true);
  setMessage("Memverifikasi kode OTP...");

  try {
    const response =
      await fetch(API_URL, {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "verifyOTP",
          email: loginEmail,
          kode
        })
      });

    const result =
      await response.json();

    if (result.status !== "success") {
      throw new Error(
        result.message ||
        "Kode OTP tidak valid."
      );
    }

    const loginResponse =
      await fetch(API_URL, {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "loginUser",
          email: loginEmail
        })
      });

    const userData =
      await loginResponse.json();

    if (
      userData.status !== "success" ||
      !userData.user
    ) {
      throw new Error(
        userData.message ||
        "Akun tidak ditemukan."
      );
    }

    localStorage.setItem(
      "user",
      JSON.stringify(userData.user)
    );

    localStorage.removeItem("login_email");

    setMessage(
      "Login berhasil. Mengarahkan ke AdaAja...",
      "success"
    );

    const redirect =
      localStorage.getItem(
        "redirectAfterLogin"
      ) || "home.html";

    localStorage.removeItem(
      "redirectAfterLogin"
    );

    setTimeout(() => {
      location.href = redirect;
    }, 800);
  } catch (error) {
    console.error(
      "OTP login error:",
      error
    );

    setMessage(
      error.message ||
      "Server tidak terhubung.",
      "error"
    );

    setLoading(false);
  }
}

async function resendOTP() {
  if (!loginEmail) {
    setMessage(
      "Email login tidak ditemukan.",
      "error"
    );
    return;
  }

  resendButton.disabled = true;
  setMessage("Mengirim ulang kode OTP...");

  try {
    const response =
      await fetch(API_URL, {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "sendOTP",
          email: loginEmail
        })
      });

    const result =
      await response.json();

    if (result.status !== "success") {
      throw new Error(
        result.message ||
        "Kode OTP gagal dikirim ulang."
      );
    }

    setMessage(
      "Kode OTP baru berhasil dikirim.",
      "success"
    );

    resendSeconds = 30;
    startResendTimer();
  } catch (error) {
    setMessage(
      error.message ||
      "Gagal mengirim ulang kode OTP.",
      "error"
    );

    resendButton.disabled = false;
  }
}

function startResendTimer() {
  clearInterval(resendInterval);

  resendButton.disabled = true;

  const updateTimer = () => {
    resendTimer.textContent =
      resendSeconds > 0
        ? `Kirim ulang tersedia dalam ${resendSeconds} detik`
        : "";

    if (resendSeconds <= 0) {
      clearInterval(resendInterval);
      resendButton.disabled = false;
      return;
    }

    resendSeconds -= 1;
  };

  updateTimer();

  resendInterval =
    setInterval(updateTimer, 1000);
}

verifyButton.addEventListener(
  "click",
  verifyLogin
);

resendButton.addEventListener(
  "click",
  resendOTP
);

document
  .querySelectorAll("[data-auth-required='true']")
  .forEach((link) => {
    link.addEventListener("click", (event) => {
      if (getUser()) return;

      event.preventDefault();

      localStorage.setItem(
        "redirectAfterLogin",
        link.getAttribute("href")
      );

      location.href = "login.html";
    });
  });

document.getElementById("maskedEmail").textContent =
  maskEmail(loginEmail);

otpDigits[0].focus();
startResendTimer();
