const recentActivity = document.getElementById("recentActivity");
const refreshButton = document.getElementById("refreshButton");
const toast = document.getElementById("toast");

let currentUser = null;
let notifications = [];
let realtimeChannels = [];
let toastTimer = null;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function date(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function relativeDate(value) {
  if (!value) return "-";

  const time = new Date(value).getTime();
  const diff = Date.now() - time;

  if (!Number.isFinite(time)) return "-";
  if (diff < 60_000) return "Baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mnt`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam`;

  return date(value);
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
    localStorage.setItem("redirectAfterLogin", "activity.html");
    location.replace("login.html");
    return null;
  }

  currentUser = user;
  return user;
}

function iconForType(type) {
  const t = String(type || "").toLowerCase();

  if (t === "order") {
    return '<svg viewBox="0 0 24 24"><path d="M6 3h12l2 5-8 4-8-4 2-5Z"></path><path d="M4 8v10l8 3 8-3V8"></path></svg>';
  }

  if (t === "offer") {
    return '<svg viewBox="0 0 24 24"><path d="M4 7h16v10H4z"></path><path d="M8 11h8"></path></svg>';
  }

  if (t === "shipping") {
    return '<svg viewBox="0 0 24 24"><path d="M3 7h11v10H3z"></path><path d="M14 10h4l3 3v4h-7V10Z"></path></svg>';
  }

  if (t === "payment") {
    return '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 10h18"></path></svg>';
  }

  return '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>';
}

async function loadActivity() {
  const user = await requireUser();
  if (!user) return;

  try {
    const [
      buyerOrdersRes,
      sellerOrdersRes,
      offersRes,
      notificationsRes
    ] = await Promise.all([
      window.adaajaSupabase
        .from("orders")
        .select("id,status,created_at,total", { count: "exact" })
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),

      window.adaajaSupabase
        .from("orders")
        .select("id,status,created_at,total", { count: "exact" })
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),

      window.adaajaSupabase
        .from("offers")
        .select("id,status,created_at,updated_at", { count: "exact" })
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),

      window.adaajaSupabase
        .from("notifications")
        .select("id,type,title,message,is_read,reference_id,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    [buyerOrdersRes, sellerOrdersRes, offersRes, notificationsRes].forEach((result) => {
      if (result.error) {
        console.warn(result.error);
      }
    });

    const buyerOrders = buyerOrdersRes.data || [];
    const sellerOrders = sellerOrdersRes.data || [];
    const offers = offersRes.data || [];
    notifications = notificationsRes.data || [];

    const activePurchases = buyerOrders.filter((order) =>
      ["pending_payment", "paid", "processing", "shipped", "delivered"].includes(
        String(order.status || "").toLowerCase()
      )
    ).length;

    const activeOffers = offers.filter((offer) =>
      ["pending", "countered", "accepted"].includes(
        String(offer.status || "").toLowerCase()
      )
    ).length;

    const needProcess = sellerOrders.filter((order) =>
      ["paid", "processing"].includes(
        String(order.status || "").toLowerCase()
      )
    ).length;

    const unreadNotifications = notifications.filter(
      (item) => !item.is_read
    ).length;

    document.getElementById("purchaseCount").textContent =
      `${activePurchases} aktif`;

    document.getElementById("offerCount").textContent =
      `${activeOffers} aktif`;

    document.getElementById("sellerOrderCount").textContent =
      `${needProcess} perlu diproses`;

    document.getElementById("notificationCount").textContent =
      `${unreadNotifications} baru`;

    document.getElementById("notificationCountHero").textContent =
      unreadNotifications;

    document.getElementById("attentionCount").textContent =
      activeOffers + needProcess + unreadNotifications;

    document.getElementById("activeCount").textContent =
      activePurchases + activeOffers + needProcess;

    renderRecentActivity({
      buyerOrders,
      sellerOrders,
      offers,
      notifications
    });

    subscribeRealtime();
  } catch (error) {
    console.error("Gagal memuat aktivitas:", error);

    recentActivity.innerHTML = `
      <div class="empty-recent">
        Aktivitas belum dapat dimuat. ${esc(error.message || "")}
      </div>
    `;
  }
}

function renderRecentActivity(data) {
  const rows = [];

  data.notifications.slice(0, 4).forEach((item) => {
    rows.push({
      type: item.type || "system",
      title: item.title || "Notifikasi",
      subtitle: item.message || "",
      created_at: item.created_at
    });
  });

  data.buyerOrders.slice(0, 2).forEach((order) => {
    rows.push({
      type: "order",
      title: "Pembelian diperbarui",
      subtitle: `Status: ${String(order.status || "").replaceAll("_", " ")}`,
      created_at: order.created_at
    });
  });

  data.sellerOrders.slice(0, 2).forEach((order) => {
    rows.push({
      type: "order",
      title: "Pesanan masuk",
      subtitle: `Status: ${String(order.status || "").replaceAll("_", " ")}`,
      created_at: order.created_at
    });
  });

  data.offers.slice(0, 2).forEach((offer) => {
    rows.push({
      type: "offer",
      title: "Negosiasi harga",
      subtitle: `Status: ${String(offer.status || "").replaceAll("_", " ")}`,
      created_at: offer.updated_at || offer.created_at
    });
  });

  rows.sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime()
  );

  const latest = rows.slice(0, 6);

  if (!latest.length) {
    recentActivity.innerHTML = `
      <div class="empty-recent">
        Belum ada aktivitas terbaru. Mulai jelajahi produk atau jual barang pertama Anda.
      </div>
    `;
    return;
  }

  recentActivity.innerHTML = latest.map((row) => `
    <div class="recent-row">
      <span class="recent-icon">${iconForType(row.type)}</span>

      <div class="recent-copy">
        <strong>${esc(row.title)}</strong>
        <span>${esc(row.subtitle)}</span>
      </div>

      <span class="recent-time">${esc(relativeDate(row.created_at))}</span>
    </div>
  `).join("");
}

function subscribeRealtime() {
  if (!currentUser) return;

  realtimeChannels.forEach((channel) => {
    window.adaajaSupabase.removeChannel(channel);
  });

  realtimeChannels = [];

  const activityChannel = window.adaajaSupabase
    .channel(`activity-orders-${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `buyer_id=eq.${currentUser.id}`
      },
      loadActivity
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `seller_id=eq.${currentUser.id}`
      },
      loadActivity
    )
    .subscribe();

  const offerChannel = window.adaajaSupabase
    .channel(`activity-offers-${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "offers",
        filter: `buyer_id=eq.${currentUser.id}`
      },
      loadActivity
    )
    .subscribe();

  const notificationChannel = window.adaajaSupabase
    .channel(`activity-notifications-${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${currentUser.id}`
      },
      loadActivity
    )
    .subscribe();

  realtimeChannels.push(
    activityChannel,
    offerChannel,
    notificationChannel
  );
}


refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  await loadActivity();
  refreshButton.disabled = false;
  showToast("Aktivitas diperbarui.");
});

window.adaajaSupabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT" || !session?.user) {
    location.replace("login.html");
  }
});

window.addEventListener("beforeunload", () => {
  realtimeChannels.forEach((channel) => {
    window.adaajaSupabase.removeChannel(channel);
  });
});

loadActivity();
