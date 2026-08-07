const notificationList = document.getElementById("notificationList");
const searchInput = document.getElementById("searchInput");
const filterTabs = document.getElementById("filterTabs");
const resultCount = document.getElementById("resultCount");
const refreshButton = document.getElementById("refreshButton");
const markAllReadButton = document.getElementById("markAllReadButton");
const toast = document.getElementById("toast");

let currentUser = null;
let notifications = [];
let activeFilter = "all";
let realtimeChannel = null;
let toastTimer = null;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function relativeDate(value) {
  if (!value) return "-";

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "-";

  const diff = Date.now() - time;

  if (diff < 60_000) return "Baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} hari lalu`;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function typeLabel(type) {
  return {
    order: "Pesanan",
    offer: "Negosiasi",
    payment: "Pembayaran",
    shipping: "Pengiriman",
    chat: "Pesan",
    system: "Sistem"
  }[String(type || "").toLowerCase()] || "Notifikasi";
}

function typeIcon(type) {
  const t = String(type || "system").toLowerCase();

  if (t === "order") {
    return '<svg viewBox="0 0 24 24"><path d="M6 3h12l2 5-8 4-8-4 2-5Z"></path><path d="M4 8v10l8 3 8-3V8"></path></svg>';
  }

  if (t === "offer") {
    return '<svg viewBox="0 0 24 24"><path d="M4 7h16v10H4z"></path><path d="M8 11h8"></path><path d="M8 14h5"></path></svg>';
  }

  if (t === "payment") {
    return '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 10h18"></path></svg>';
  }

  if (t === "shipping") {
    return '<svg viewBox="0 0 24 24"><path d="M3 7h11v10H3z"></path><path d="M14 10h4l3 3v4h-7V10Z"></path></svg>';
  }

  if (t === "chat") {
    return '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5Z"></path></svg>';
  }

  return '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

async function requireUser() {
  const user = await window.AdaAjaAuth.getCurrentUser();

  if (!user) {
    localStorage.setItem("redirectAfterLogin", "notifications.html");
    location.replace("login.html");
    return null;
  }

  currentUser = user;
  return user;
}

function loading() {
  resultCount.textContent = "Memuat...";
  notificationList.innerHTML = `
    <article class="skeleton-card shimmer"></article>
    <article class="skeleton-card shimmer"></article>
    <article class="skeleton-card shimmer"></article>
  `;
}

function renderError(message) {
  notificationList.innerHTML = `
    <section class="empty-state">
      <span class="empty-icon">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 7v6M12 17h.01"></path>
        </svg>
      </span>

      <strong>Notifikasi belum dapat dimuat</strong>
      <p>${esc(message || "Silakan coba kembali.")}</p>
      <button class="retry-button" id="retryButton" type="button">Muat ulang</button>
    </section>
  `;

  document.getElementById("retryButton")?.addEventListener("click", loadNotifications);
}

async function loadNotifications() {
  const user = await requireUser();
  if (!user) return;

  loading();

  try {
    const { data, error } = await window.adaajaSupabase
      .from("notifications")
      .select(`
        id,
        user_id,
        type,
        title,
        message,
        reference_id,
        is_read,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) throw error;

    notifications = data || [];

    updateStats();
    renderNotifications();
    subscribeRealtime();
  } catch (error) {
    console.error("Gagal memuat notifikasi:", error);
    renderError(error.message || "Notifikasi gagal dimuat.");
  }
}

function updateStats() {
  const unread = notifications.filter((item) => !item.is_read).length;

  const today = notifications.filter((item) => {
    if (!item.created_at) return false;

    const created = new Date(item.created_at);
    const now = new Date();

    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate()
    );
  }).length;

  document.getElementById("unreadCount").textContent = unread;
  document.getElementById("todayCount").textContent = today;
  document.getElementById("totalCount").textContent = notifications.length;

  markAllReadButton.disabled = unread === 0;
}

function filteredNotifications() {
  const keyword = searchInput.value.trim().toLowerCase();

  return notifications.filter((item) => {
    const type = String(item.type || "system").toLowerCase();

    const filterMatch =
      activeFilter === "all" ||
      (activeFilter === "unread" && !item.is_read) ||
      type === activeFilter;

    const searchMatch =
      !keyword ||
      [item.title, item.message, typeLabel(item.type)]
        .some((value) =>
          String(value || "").toLowerCase().includes(keyword)
        );

    return filterMatch && searchMatch;
  });
}

function destinationFor(item) {
  const type = String(item.type || "").toLowerCase();
  const ref = item.reference_id
    ? encodeURIComponent(item.reference_id)
    : "";

  if (type === "offer") {
    return ref ? `my-offers.html?offer_id=${ref}` : "my-offers.html";
  }

  if (type === "order") {
    return ref ? `my-orders.html?order_id=${ref}` : "my-orders.html";
  }

  if (type === "shipping") {
    return ref ? `my-orders.html?order_id=${ref}` : "my-orders.html";
  }

  if (type === "payment") {
    return ref ? `my-orders.html?order_id=${ref}` : "my-orders.html";
  }

  if (type === "chat") {
    return ref ? `chat.html?conversation_id=${ref}` : "messages.html";
  }

  return "activity.html";
}

function renderNotifications() {
  const data = filteredNotifications();

  resultCount.textContent = `${data.length} notifikasi`;

  if (!data.length) {
    const hasFilter =
      activeFilter !== "all" ||
      searchInput.value.trim();

    notificationList.innerHTML = `
      <section class="empty-state">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
            <path d="M10 21h4"></path>
          </svg>
        </span>

        <strong>${hasFilter ? "Tidak ada notifikasi yang cocok" : "Belum ada notifikasi"}</strong>

        <p>
          ${
            hasFilter
              ? "Coba ubah pencarian atau pilih kategori notifikasi lain."
              : "Update transaksi dan aktivitas akun Anda akan muncul di halaman ini."
          }
        </p>

        ${
          hasFilter
            ? '<button class="retry-button" id="clearFilterButton" type="button">Hapus Filter</button>'
            : ""
        }
      </section>
    `;

    document.getElementById("clearFilterButton")?.addEventListener("click", () => {
      activeFilter = "all";
      searchInput.value = "";

      filterTabs.querySelectorAll("button").forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.filter === "all"
        );
      });

      renderNotifications();
    });

    return;
  }

  notificationList.innerHTML = data.map((item) => {
    const type = String(item.type || "system").toLowerCase();

    return `
      <article
        class="notification-card ${item.is_read ? "" : "unread"}"
        data-notification-id="${esc(item.id)}"
        data-destination="${esc(destinationFor(item))}"
      >
        <span class="notification-icon ${esc(type)}">
          ${typeIcon(type)}
        </span>

        <div class="notification-main">
          <div class="notification-topline">
            <strong>${esc(item.title || "Notifikasi")}</strong>
            ${item.is_read ? "" : '<i class="unread-dot"></i>'}
          </div>

          <p>${esc(item.message || "")}</p>

          <div class="notification-meta">
            <span class="type-pill">${esc(typeLabel(type))}</span>
            <span class="notification-time">${esc(relativeDate(item.created_at))}</span>
          </div>
        </div>

        <span class="notification-arrow">
          <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"></path></svg>
        </span>
      </article>
    `;
  }).join("");

  notificationList
    .querySelectorAll(".notification-card")
    .forEach((card) => {
      card.addEventListener("click", async () => {
        const id = card.dataset.notificationId;
        const destination = card.dataset.destination;

        await markOneRead(id);

        if (destination) {
          location.href = destination;
        }
      });
    });
}

async function markOneRead(id) {
  const item = notifications.find((row) => row.id === id);

  if (!item || item.is_read || !currentUser) {
    return;
  }

  const { error } = await window.adaajaSupabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    console.warn("Notifikasi gagal ditandai dibaca:", error);
    return;
  }

  item.is_read = true;

  updateStats();
  renderNotifications();
}

async function markAllRead() {
  if (!currentUser) return;

  const unreadIds = notifications
    .filter((item) => !item.is_read)
    .map((item) => item.id);

  if (!unreadIds.length) {
    showToast("Semua notifikasi sudah dibaca.");
    return;
  }

  markAllReadButton.disabled = true;

  try {
    const { error } = await window.adaajaSupabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", currentUser.id)
      .eq("is_read", false);

    if (error) throw error;

    notifications = notifications.map((item) => ({
      ...item,
      is_read: true
    }));

    updateStats();
    renderNotifications();
    showToast("Semua notifikasi ditandai dibaca.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Notifikasi gagal diperbarui.");
    updateStats();
  }
}

function subscribeRealtime() {
  if (!currentUser) return;

  if (realtimeChannel) {
    window.adaajaSupabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = window.adaajaSupabase
    .channel(`notifications-${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${currentUser.id}`
      },
      () => loadNotifications()
    )
    .subscribe();
}

searchInput.addEventListener("input", renderNotifications);

filterTabs.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;

    filterTabs.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderNotifications();
  });
});

markAllReadButton.addEventListener("click", markAllRead);

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  await loadNotifications();
  refreshButton.disabled = false;
  showToast("Notifikasi diperbarui.");
});

window.adaajaSupabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session?.user) {
    location.replace("login.html");
  }
});

window.addEventListener("beforeunload", () => {
  if (realtimeChannel) {
    window.adaajaSupabase.removeChannel(realtimeChannel);
  }
});

loadNotifications();
