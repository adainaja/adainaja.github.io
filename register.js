const form = document.getElementById("registerForm");
const registerButton = document.getElementById("registerButton");
const message = document.getElementById("message");

function setMessage(text = "", type = "") {
  message.className = type;
  message.textContent = text;
}

function setLoading(isLoading) {
  registerButton.disabled = isLoading;
  registerButton.classList.toggle("loading", isLoading);

  const text = registerButton.querySelector("span");

  if (text) {
    text.textContent = isLoading
      ? "Membuat akun..."
      : "Buat Akun AdaAja";
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasLetterAndNumber(password) {
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);

    if (!input) return;

    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.classList.toggle("visible", show);

    button.setAttribute(
      "aria-label",
      show ? "Sembunyikan password" : "Tampilkan password"
    );
  });
});

async function registerWithSupabase() {
  const fullName = document.getElementById("name").value.trim();
  const email = document.getElementById("contact").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm").value;
  const agree = document.getElementById("agree").checked;

  if (!fullName || !email || !password || !confirmPassword) {
    setMessage("Lengkapi semua data terlebih dahulu.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    setMessage("Masukkan alamat email yang valid.", "error");
    return;
  }

  if (password.length < 8) {
    setMessage("Password minimal 8 karakter.", "error");
    return;
  }

  if (!hasLetterAndNumber(password)) {
    setMessage("Password harus memiliki kombinasi huruf dan angka.", "error");
    return;
  }

  if (password !== confirmPassword) {
    setMessage("Konfirmasi password belum sama.", "error");
    return;
  }

  if (!agree) {
    setMessage(
      "Setujui Syarat & Ketentuan dan Kebijakan Privasi terlebih dahulu.",
      "error"
    );
    return;
  }

  setLoading(true);
  setMessage("Membuat akun Supabase Anda...");

  try {
    const { data, error } =
      await window.adaajaSupabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            name: fullName
          }
        }
      });

    if (error) {
      throw error;
    }

    sessionStorage.setItem("pending_registration_email", email);
    sessionStorage.setItem("pending_registration_name", fullName);

    localStorage.removeItem("register_password");
    localStorage.removeItem("register_email");
    localStorage.removeItem("register_username");

    if (data.session?.user) {
      await window.AdaAjaAuth.syncLegacyUser(data.session.user);

      sessionStorage.setItem("new_user", "1");
      setMessage("Akun berhasil dibuat. Lengkapi profil Anda...", "success");

      window.setTimeout(() => {
        location.replace("complete-account.html");
      }, 650);

      return;
    }

    throw new Error(
      "Akun dibuat tetapi sesi belum tersedia. Pastikan Confirm email di Supabase sudah dinonaktifkan."
    );
  } catch (error) {
    console.error("Supabase registration error:", error);

    const errorMessage = String(error?.message || "");

    if (errorMessage.toLowerCase().includes("already registered")) {
      setMessage(
        "Email sudah terdaftar. Silakan masuk menggunakan akun tersebut.",
        "error"
      );
    } else {
      setMessage(
        errorMessage || "Pendaftaran belum berhasil. Silakan coba kembali.",
        "error"
      );
    }
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  registerWithSupabase();
});

window.addEventListener("load", async () => {
  try {
    const session = await window.AdaAjaAuth.getSession();

    if (!session?.user) return;

    await window.AdaAjaAuth.syncLegacyUser(session.user);

    const userId = session.user.id;

    const [profileResult, addressResult] = await Promise.all([
      window.adaajaSupabase
        .from("profiles")
        .select("username")
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

    if (profileResult.error) throw profileResult.error;
    if (addressResult.error) throw addressResult.error;

    const profileComplete = Boolean(
      profileResult.data?.username && addressResult.data?.id
    );

    location.replace(
      profileComplete ? "home.html" : "complete-account.html"
    );
  } catch (error) {
    console.warn("Pemeriksaan sesi gagal:", error.message);
  }
});
