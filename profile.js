function convertDriveImage(url) {
  if (!url) return "";

  if (url.includes("drive.google.com")) {
    const id = url.match(/[-\w]{25,}/);

    if (id) {
      return `https://drive.google.com/thumbnail?id=${id[0]}&sz=w500`;
    }
  }

  return url;
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function formatJoinedDate(value) {
  if (!value) return "Member aktif";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Member aktif";
  }

  return `Bergabung ${new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric"
  }).format(date)}`;
}

function formatBalance(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function renderProfile() {
  const user = getUser();

  if (!user) {
    localStorage.setItem("redirectAfterLogin", "profile.html");
    location.href = "login.html";
    return;
  }

  const usernameElement = document.getElementById("username");
  const emailElement = document.getElementById("email");
  const photoElement = document.getElementById("photo");
  const avatarElement = document.getElementById("avatar");
  const avatarFallback = document.getElementById("avatarFallback");

  const displayName =
    user.username ||
    user.nama_lengkap ||
    "Pengguna AdaAja";

  usernameElement.textContent = displayName;
  emailElement.textContent = user.email || "Email belum tersedia";
  avatarFallback.textContent =
    String(displayName).charAt(0).toUpperCase();

  const photoUrl = convertDriveImage(user.foto_profile || "");

  if (photoUrl) {
    photoElement.src = photoUrl;
    photoElement.onload = () => {
      avatarElement.classList.add("has-image");
    };
    photoElement.onerror = () => {
      avatarElement.classList.remove("has-image");
    };
  }

  document.getElementById("joinedDate").textContent =
    formatJoinedDate(user.created_at);

  document.getElementById("balanceValue").textContent =
    formatBalance(user.saldo);

  document.getElementById("productCount").textContent =
    Number(user.product_count || 0);

  document.getElementById("orderCount").textContent =
    Number(user.order_count || 0);
}

function openLogoutPanel() {
  const panel = document.getElementById("logoutPanel");
  panel.classList.add("active");
  panel.setAttribute("aria-hidden", "false");
  document.body.classList.add("panel-open");
}

function closeLogoutPanel() {
  const panel = document.getElementById("logoutPanel");
  panel.classList.remove("active");
  panel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("panel-open");
}

function logout() {
  [
    "user",
    "login_email",
    "register_email",
    "register_username",
    "register_password",
    "redirectAfterLogin"
  ].forEach((key) => {
    localStorage.removeItem(key);
  });

  location.href = "login.html";
}

document
  .getElementById("editProfileButton")
  .addEventListener("click", () => {
    location.href = "edit-profile.html";
  });

document
  .getElementById("settingsButton")
  .addEventListener("click", () => {
    location.href = "settings.html";
  });

document
  .getElementById("logoutButton")
  .addEventListener("click", openLogoutPanel);

document
  .getElementById("logoutBackdrop")
  .addEventListener("click", closeLogoutPanel);

document
  .getElementById("cancelLogout")
  .addEventListener("click", closeLogoutPanel);

document
  .getElementById("confirmLogout")
  .addEventListener("click", logout);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLogoutPanel();
  }
});

renderProfile();
