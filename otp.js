const API_URL =
  "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const email =
  localStorage.getItem("register_email") || "";

const namaLengkap =
  localStorage.getItem("register_username") || "";

const emailText =
  document.getElementById("emailText");

const message =
  document.getElementById("message");

if (emailText) {
  emailText.textContent = email;
}

function getOTP() {
  return Array.from(
    document.querySelectorAll(".otp-input input")
  )
    .map((input) => input.value.trim())
    .join("");
}

function createTemporaryUsername(name, emailAddress) {
  const source =
    name ||
    emailAddress.split("@")[0] ||
    "pengguna";

  const cleanName =
    source
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 18);

  return (
    (cleanName || "pengguna") +
    String(Date.now()).slice(-5)
  );
}

function setMessage(text = "", type = "") {
  if (!message) return;

  message.className = type;
  message.textContent = text;
}

async function verify() {
  const kode = getOTP();

  if (!email) {
    setMessage(
      "Email pendaftaran tidak ditemukan. Silakan daftar kembali.",
      "error"
    );
    return;
  }

  if (!kode || kode.length !== 6) {
    setMessage(
      "Masukkan kode OTP 6 digit.",
      "error"
    );
    return;
  }

  setMessage(
    "Memverifikasi kode OTP..."
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
        action: "verifyOTP",
        email,
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

    setMessage(
      "OTP berhasil diverifikasi.",
      "success"
    );

    setTimeout(register, 700);
  } catch (error) {
    setMessage(
      error.message ||
      "Gagal terhubung ke server.",
      "error"
    );
  }
}

async function register() {
  const usernameSementara =
    createTemporaryUsername(
      namaLengkap,
      email
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
        action: "registerUser",
        email,
        username: usernameSementara,
        nama_lengkap: namaLengkap
      })
    });

    const result =
      await response.json();

    if (result.status !== "success") {
      throw new Error(
        result.message ||
        "Akun gagal dibuat."
      );
    }

    localStorage.setItem(
      "user",
      JSON.stringify({
        user_id: result.user_id,
        email,
        email_verified: true,
        username: usernameSementara,
        nama_lengkap: namaLengkap,
        foto_profile: "",
        phone: "",
        role: "buyer",
        status: "active"
      })
    );

    location.href =
      "complete-account.html";
  } catch (error) {
    setMessage(
      error.message ||
      "Akun gagal dibuat.",
      "error"
    );
  }
}

async function resend() {
  if (!email) {
    setMessage(
      "Email pendaftaran tidak ditemukan.",
      "error"
    );
    return;
  }

  setMessage(
    "Mengirim ulang kode OTP..."
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
  } catch (error) {
    setMessage(
      error.message ||
      "Gagal mengirim ulang kode OTP.",
      "error"
    );
  }
}
