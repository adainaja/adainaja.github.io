const callbackCard = document.getElementById("callbackCard");
const callbackTitle = document.getElementById("callbackTitle");
const callbackMessage = document.getElementById("callbackMessage");

function showError(message) {
  callbackCard.classList.add("error");
  callbackTitle.textContent = "Verifikasi belum berhasil";
  callbackMessage.textContent = message;
}

async function waitForSession(maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const session = await window.AdaAjaAuth.getSession();

    if (session?.user) {
      return session;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 250);
    });
  }

  return null;
}

async function completeCallback() {
  try {
    const url = new URL(location.href);
    const errorDescription =
      url.searchParams.get("error_description") ||
      url.searchParams.get("error");

    if (errorDescription) {
      throw new Error(errorDescription);
    }

    const session = await waitForSession();

    if (!session?.user) {
      throw new Error(
        "Sesi tidak ditemukan. Tautan konfirmasi mungkin sudah digunakan atau kedaluwarsa."
      );
    }

    await window.AdaAjaAuth.syncLegacyUser(session.user);

    const redirectPage =
      localStorage.getItem("redirectAfterLogin") ||
      "home.html";

    localStorage.removeItem("redirectAfterLogin");
    sessionStorage.removeItem("pending_registration_email");
    sessionStorage.removeItem("pending_registration_name");

    callbackTitle.textContent = "Akun berhasil diverifikasi";
    callbackMessage.textContent =
      "Anda akan segera diarahkan ke AdaAja.";

    window.setTimeout(() => {
      location.replace(redirectPage);
    }, 900);
  } catch (error) {
    console.error("Supabase callback error:", error);
    showError(
      error.message ||
      "Verifikasi akun belum berhasil. Silakan masuk kembali."
    );
  }
}

completeCallback();
