const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const togglePassword = document.getElementById("togglePassword");
const message = document.getElementById("message");

let currentSession = null;

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
      ? "Memeriksa akun..."
      : "Masuk ke AdaAja";
  }

  if (subtitle) {
    subtitle.textContent = isLoading
      ? "Mohon tunggu sebentar"
      : "Email & password";
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getSession() {
  if (currentSession?.user) return currentSession;

  const { data, error } =
    await window.adaajaSupabase.auth.getSession();

  if (error) throw error;

  currentSession = data.session || null;
  return currentSession;
}

async function isProfileComplete(userId) {
  const [
    { data: profile, error: profileError },
    { data: address, error: addressError }
  ] = await Promise.all([
    window.adaajaSupabase
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle(),

    window.adaajaSupabase
      .from("addresses")
      .select("id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle()
  ]);

  if (profileError) {
    console.warn("Profile check failed:", profileError);
  }

  if (addressError) {
    console.warn("Address check failed:", addressError);
  }

  return Boolean(profile?.username && address?.id);
}

function consumeRedirectAfterLogin() {
  const redirect =
    localStorage.getItem("redirectAfterLogin") || "";

  localStorage.removeItem("redirectAfterLogin");

  if (!redirect) return "home.html";

  try {
    const destination = new URL(
      redirect,
      window.location.href
    );

    if (destination.origin !== window.location.origin) {
      return "home.html";
    }

    return (
      destination.pathname.split("/").pop() +
      destination.search +
      destination.hash
    ) || "home.html";
  } catch {
    return "home.html";
  }
}

async function routeLoggedInUser(user) {
  const complete = await isProfileComplete(user.id);

  if (!complete) {
    location.replace("complete-account.html");
    return;
  }

  location.replace(consumeRedirectAfterLogin());
}

async function loginWithPassword() {
  const email =
    emailInput.value.trim().toLowerCase();

  const password =
    passwordInput.value;

  if (!email) {
    setMessage(
      "Masukkan email terlebih dahulu.",
      "error"
    );
    emailInput.focus();
    return;
  }

  if (!isValidEmail(email)) {
    setMessage(
      "Masukkan alamat email yang valid.",
      "error"
    );
    emailInput.focus();
    return;
  }

  if (!password) {
    setMessage(
      "Masukkan password terlebih dahulu.",
      "error"
    );
    passwordInput.focus();
    return;
  }

  if (password.length < 8) {
    setMessage(
      "Password minimal 8 karakter.",
      "error"
    );
    passwordInput.focus();
    return;
  }

  setLoading(true);
  setMessage("Memeriksa email dan password Anda...");

  try {
    const { data, error } =
      await window.adaajaSupabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    if (!data?.user || !data?.session) {
      throw new Error(
        "Sesi login tidak terbentuk. Silakan coba kembali."
      );
    }

    currentSession = data.session;

    if (window.AdaAjaAuth?.syncLegacyUser) {
      try {
        await window.AdaAjaAuth.syncLegacyUser(data.user);
      } catch (syncError) {
        console.warn(
          "Sinkronisasi kompatibilitas user gagal:",
          syncError
        );
      }
    }

    localStorage.removeItem("login_email");
    localStorage.removeItem("register_password");
    localStorage.removeItem("register_email");
    localStorage.removeItem("register_username");

    setMessage(
      "Login berhasil. Mengalihkan...",
      "success"
    );

    await routeLoggedInUser(data.user);
  } catch (error) {
    console.error("Supabase login error:", error);

    const raw =
      String(error?.message || "").toLowerCase();

    if (
      raw.includes("invalid login credentials") ||
      raw.includes("invalid credentials")
    ) {
      setMessage(
        "Email atau password salah. Silakan periksa kembali.",
        "error"
      );
    } else if (raw.includes("email not confirmed")) {
      setMessage(
        "Akun belum aktif. Periksa konfigurasi akun Supabase Anda.",
        "error"
      );
    } else {
      setMessage(
        error?.message ||
          "Login belum berhasil. Silakan coba kembali.",
        "error"
      );
    }

    setLoading(false);
  }
}

togglePassword.addEventListener("click", () => {
  const show =
    passwordInput.type === "password";

  passwordInput.type =
    show ? "text" : "password";

  togglePassword.classList.toggle(
    "visible",
    show
  );

  togglePassword.setAttribute(
    "aria-label",
    show
      ? "Sembunyikan password"
      : "Tampilkan password"
  );
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loginWithPassword();
});

document
  .querySelectorAll("[data-auth-required='true']")
  .forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();

      try {
        const session = await getSession();

        if (session?.user) {
          location.href =
            link.getAttribute("href");
          return;
        }
      } catch (error) {
        console.warn(
          "Pemeriksaan sesi gagal:",
          error
        );
      }

      localStorage.setItem(
        "redirectAfterLogin",
        link.getAttribute("href")
      );

      location.href = "login.html";
    });
  });

(async function initLoginPage() {
  try {
    const session = await getSession();

    if (!session?.user) return;

    setMessage(
      "Anda sudah login. Mengalihkan...",
      "success"
    );

    await routeLoggedInUser(
      session.user
    );
  } catch (error) {
    console.warn(
      "Pemeriksaan sesi awal gagal:",
      error
    );
  }
})();
