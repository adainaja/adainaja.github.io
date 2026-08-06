const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const message = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

function setMessage(text = "", type = "") {
  message.className = `message ${type}`.trim();
  message.textContent = text;
}

function setLoading(isLoading) {
  loginButton.disabled = isLoading;

  const title = loginButton.querySelector(".button-copy strong");
  const subtitle = loginButton.querySelector(".button-copy small");

  if (title) {
    title.textContent = isLoading
      ? "Memverifikasi akun..."
      : "Masuk ke AdaAja";
  }

  if (subtitle) {
    subtitle.textContent = isLoading
      ? "Mohon tunggu sebentar"
      : "Gunakan email dan password";
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function loginWithSupabase() {
  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    setMessage("Masukkan email dan password.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    setMessage("Masukkan alamat email yang valid.", "error");
    return;
  }

  setLoading(true);
  setMessage("Memverifikasi akun Anda...");

  try {
    const { data, error } =
      await window.adaajaSupabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    if (!data.user || !data.session) {
      throw new Error("Sesi login tidak berhasil dibuat.");
    }

    await window.AdaAjaAuth.syncLegacyUser(data.user);

    const redirectPage =
      localStorage.getItem("redirectAfterLogin") ||
      "home.html";

    localStorage.removeItem("redirectAfterLogin");
    localStorage.removeItem("login_email");

    setMessage("Login berhasil. Mengalihkan...", "success");

    window.setTimeout(() => {
      location.href = redirectPage;
    }, 600);
  } catch (error) {
    console.error("Supabase login error:", error);

    const rawMessage = String(error?.message || "");
    const normalized = rawMessage.toLowerCase();

    if (
      normalized.includes("invalid login credentials") ||
      normalized.includes("invalid credentials")
    ) {
      setMessage("Email atau password tidak sesuai.", "error");
    } else if (
      normalized.includes("email not confirmed")
    ) {
      setMessage(
        "Email belum dikonfirmasi. Buka email Anda dan klik tautan konfirmasi.",
        "error"
      );
    } else {
      setMessage(
        rawMessage || "Login belum berhasil. Silakan coba kembali.",
        "error"
      );
    }
  } finally {
    setLoading(false);
  }
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginWithSupabase();
});

document.querySelectorAll("[data-auth-required='true']").forEach((link) => {
  link.addEventListener("click", async (event) => {
    const session = await window.AdaAjaAuth.getSession();

    if (session?.user) return;

    event.preventDefault();
    localStorage.setItem(
      "redirectAfterLogin",
      link.getAttribute("href")
    );
  });
});

window.addEventListener("load", async () => {
  try {
    const session = await window.AdaAjaAuth.getSession();

    if (!session?.user) return;

    await window.AdaAjaAuth.syncLegacyUser(session.user);

    const redirectPage =
      localStorage.getItem("redirectAfterLogin") ||
      "home.html";

    localStorage.removeItem("redirectAfterLogin");
    location.replace(redirectPage);
  } catch (error) {
    console.warn("Pemeriksaan sesi gagal:", error.message);
  }
});
