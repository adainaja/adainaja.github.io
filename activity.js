const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const recentActivity = $('#recentActivity');
const priorityContent = $('#priorityContent');
const refreshButton = $('#refreshButton');
const buyerPanel = $('#buyerPanel');
const sellerPanel = $('#sellerPanel');
const toast = $('#toast');

let currentUser = null;
let realtimeChannels = [];
let realtimeReady = false;
let toastTimer = null;
let loading = false;
let dataFailsafeTimer = null;
const isFileMode = location.protocol === 'file:';
const hasDataDeps = () => Boolean(window.adaajaSupabase && window.AdaAjaAuth && typeof window.AdaAjaAuth.getCurrentUser === 'function');

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function relativeDate(value) {
  if (!value) return '-';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '-';
  const diff = Date.now() - time;
  if (diff < 60000) return 'Baru saja';
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))} mnt`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} jam`;
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(value));
}

async function requireUser() {
  if (!hasDataDeps()) {
    if (isFileMode) return null;
    throw new Error('Dependency Supabase atau auth belum tersedia.');
  }
  const user = await window.AdaAjaAuth.getCurrentUser();
  if (!user) {
    localStorage.setItem('redirectAfterLogin', 'activity.html');
    if (!isFileMode) location.replace('login.html');
    return null;
  }
  currentUser = user;
  return user;
}

function normalizeStatus(value) {
  return String(value || '').trim().replaceAll('_', ' ').replace(/\s+/g, ' ').toLowerCase();
}

function iconForType(type) {
  const key = String(type || '').toLowerCase();
  if (key.includes('offer')) return '<svg viewBox="0 0 24 24"><path d="M4 7h16v10H4z"/><path d="M8 11h8M8 14h5"/></svg>';
  if (key.includes('order')) return '<svg viewBox="0 0 24 24"><path d="M6 3h12l2 5-8 4-8-4 2-5Z"/><path d="M4 8v10l8 3 8-3V8"/></svg>';
  if (key.includes('message') || key.includes('chat')) return '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5Z"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
}

function statusSvg(key) {
  if (key === 'truck') return '<svg viewBox="0 0 24 24"><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>';
  if (key === 'check') return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>';
  if (key === 'wallet') return '<svg viewBox="0 0 24 24"><path d="M4 6h16v13H4zM16 10h4v5h-4"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4-8 4-8-4ZM4 8v9l8 3 8-3V8"/></svg>';
}

const statusDefs = {
  buyer: [
    { label: 'Belum Bayar', tone: 'amber', icon: 'wallet', group: 'unpaid' },
    { label: 'Diproses', tone: 'blue', icon: 'box', group: 'processing' },
    { label: 'Dikirim', tone: 'cyan', icon: 'truck', group: 'shipping' },
    { label: 'Selesai', tone: 'mint', icon: 'check', group: 'completed' }
  ],
  seller: [
    { label: 'Pesanan Baru', tone: 'amber', icon: 'box', group: 'new' },
    { label: 'Perlu Diproses', tone: 'blue', icon: 'box', group: 'processing' },
    { label: 'Dikirim', tone: 'cyan', icon: 'truck', group: 'shipping' },
    { label: 'Selesai', tone: 'mint', icon: 'check', group: 'completed' }
  ]
};

function classifyStatus(status, role) {
  const value = normalizeStatus(status);
  if (/complete|completed|done|finish|finished|selesai|received/.test(value)) return 'completed';
  if (/ship|shipped|shipping|delivery|dikirim|in transit/.test(value)) return 'shipping';
  if (role === 'buyer' && /unpaid|payment pending|pending payment|awaiting payment|belum bayar|menunggu pembayaran/.test(value)) return 'unpaid';
  if (role === 'seller' && /new|paid|confirmed|pesanan baru|payment success|payment paid/.test(value)) return 'new';
  if (/process|processing|processed|packing|packed|diproses|perlu diproses|ready to ship/.test(value)) return 'processing';
  if (role === 'seller' && /pending/.test(value)) return 'new';
  if (role === 'buyer' && /pending/.test(value)) return 'unpaid';
  return '';
}

function getStatusCounts(orders, role) {
  const counts = {};
  orders.forEach((order) => {
    const group = classifyStatus(order.status, role);
    if (group) counts[group] = (counts[group] || 0) + 1;
  });
  return counts;
}

function renderStatuses(role, counts = {}) {
  const items = $$(`[data-status-role="${role}"]`);
  items.forEach((item) => {
    const group = item.dataset.statusGroup;
    const count = Number(counts[group] || 0);
    const badge = item.querySelector('[data-count]');
    const label = item.querySelector('.status-label')?.textContent?.trim() || '';
    if (badge) {
      badge.textContent = count > 0 ? String(count) : '';
      badge.hidden = count <= 0;
    }
    item.setAttribute('aria-label', count > 0 ? `${label}, ${count}` : label);
  });
}

function currentRole() {
  return sessionStorage.getItem('adaajaActivityRole') === 'seller' ? 'seller' : 'buyer';
}

function setRole(role) {
  const seller = role === 'seller';
  buyerPanel.hidden = seller;
  sellerPanel.hidden = !seller;
  $$('.role-tab').forEach((button) => {
    const active = button.dataset.role === role;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  sessionStorage.setItem('adaajaActivityRole', role);
  renderPriority(window.__activityData || { loaded: false }, role);
}

$$('.role-tab').forEach((button) => button.addEventListener('click', () => setRole(button.dataset.role)));
$('#cartButton').addEventListener('click', () => showToast('Keranjang segera hadir di AdaAja.'));

function priorityIcon(type) {
  if (type === 'order') return '<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4-8 4-8-4ZM4 8v9l8 3 8-3V8"/></svg>';
  if (type === 'offer') return '<svg viewBox="0 0 24 24"><path d="M4 7h16v10H4z"/><path d="M8 11h8M8 14h5"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5Z"/></svg>';
}

function renderPriorityLoadingMarkup() {
  return `<div class="priority-loading"><span class="loading-dot shimmer" aria-hidden="true"></span><span><strong>Memuat aktivitas</strong><small>Kami sedang memeriksa aktivitas terbaru kamu.</small></span></div>`;
}

function renderDataUnavailableState() {
  renderStatuses('buyer');
  renderStatuses('seller');
  priorityContent.innerHTML = `
    <div class="priority-empty">
      <span class="state-icon error"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/></svg></span>
      <span><strong>Data aktivitas belum tersedia</strong><small>Mode tampilan tetap bisa digunakan. Buka melalui situs AdaAja untuk memuat data akun.</small></span>
    </div>`;
  recentActivity.innerHTML = `
    <div class="empty-recent">
      <span class="state-icon error"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/></svg></span>
      <span><strong>Aktivitas belum dapat dimuat</strong><span>Data akun akan muncul saat halaman terhubung ke Supabase.</span></span>
    </div>`;
}

function armFailsafe() {
  clearTimeout(dataFailsafeTimer);
  dataFailsafeTimer = setTimeout(() => {
    if (loading) {
      renderPriorityError();
      renderRecentError();
    }
  }, 7000);
}

function clearFailsafe() {
  clearTimeout(dataFailsafeTimer);
  dataFailsafeTimer = null;
}

function renderPriority(data, role) {
  if (!data.loaded) {
    priorityContent.innerHTML = renderPriorityLoadingMarkup();
    return;
  }

  const items = [];
  if (role === 'buyer') {
    const buyerCounts = getStatusCounts(data.buyerOrders, 'buyer');
    if (buyerCounts.unpaid) items.push({ type: 'order', title: 'Pembayaran', subtitle: 'Menunggu pembayaran', count: buyerCounts.unpaid });

    const repliedOffers = data.buyerOffers.filter((offer) => /counter|accepted|replied|response|approved/.test(normalizeStatus(offer.status))).length;
    if (repliedOffers) items.push({ type: 'offer', title: 'Negosiasi', subtitle: 'Penawaran dibalas', count: repliedOffers });
  } else {
    const sellerCounts = getStatusCounts(data.sellerOrders, 'seller');
    const needsAction = (sellerCounts.new || 0) + (sellerCounts.processing || 0);
    if (needsAction) items.push({ type: 'order', title: 'Pesanan', subtitle: 'Perlu ditindak', count: needsAction });

    const incomingOffers = data.sellerOffers.filter((offer) => /pending|new|sent|submitted|open/.test(normalizeStatus(offer.status))).length;
    if (incomingOffers) items.push({ type: 'offer', title: 'Penawaran', subtitle: 'Penawaran masuk', count: incomingOffers });
  }

  if (!items.length) {
    priorityContent.innerHTML = `
      <div class="priority-empty">
        <span class="state-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg></span>
        <span><strong>Semua beres</strong><small>Belum ada aktivitas yang perlu kamu tindak.</small></span>
      </div>`;
    return;
  }

  priorityContent.innerHTML = `<div class="priority-rail">${items.map((item) => `
    <div class="priority-card">
      <span class="priority-icon">${priorityIcon(item.type)}</span>
      <span><strong>${esc(item.title)}</strong><small>${esc(item.subtitle)}</small></span>
      <span class="priority-count">${item.count}</span>
    </div>`).join('')}</div>`;
}

function renderPriorityError() {
  priorityContent.innerHTML = `
    <div class="priority-empty">
      <span class="state-icon error"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/></svg></span>
      <span><strong>Aktivitas belum dapat dimuat</strong><small>Periksa koneksi lalu coba lagi.</small><button class="state-retry" type="button" id="priorityRetry">Coba lagi</button></span>
    </div>`;
  $('#priorityRetry')?.addEventListener('click', () => loadActivity());
}

function renderRecent(rows) {
  if (!rows.length) {
    recentActivity.innerHTML = `
      <div class="empty-recent">
        <span class="state-icon"><svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4-8 4-8-4ZM4 8v9l8 3 8-3V8"/></svg></span>
        <span><strong>Belum ada aktivitas terbaru</strong><span>Update transaksi dan akunmu akan muncul di sini.</span></span>
      </div>`;
    return;
  }

  recentActivity.innerHTML = rows.map((row) => `
    <div class="recent-row">
      <span class="recent-icon">${iconForType(row.type)}</span>
      <div class="recent-copy"><strong>${esc(row.title)}</strong><span>${esc(row.subtitle)}</span></div>
      <span class="recent-time">${esc(relativeDate(row.created_at))}</span>
    </div>`).join('');
}

function renderRecentError() {
  recentActivity.innerHTML = `
    <div class="empty-recent">
      <span class="state-icon error"><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/></svg></span>
      <span><strong>Aktivitas belum dapat dimuat</strong><span>Periksa koneksi lalu coba lagi.</span></span>
    </div>`;
}

function buildRecentRows(notifications, data) {
  const rows = [];
  notifications.slice(0, 5).forEach((item) => rows.push({
    type: item.type || 'system',
    title: item.title || 'Notifikasi',
    subtitle: item.message || '',
    created_at: item.created_at
  }));
  data.buyerOrders.slice(0, 2).forEach((item) => rows.push({
    type: 'order', title: 'Aktivitas pembelian', subtitle: `Status: ${normalizeStatus(item.status)}`, created_at: item.created_at
  }));
  data.sellerOrders.slice(0, 2).forEach((item) => rows.push({
    type: 'order', title: 'Aktivitas penjualan', subtitle: `Status: ${normalizeStatus(item.status)}`, created_at: item.created_at
  }));
  data.buyerOffers.slice(0, 1).forEach((item) => rows.push({
    type: 'offer', title: 'Negosiasi Saya', subtitle: `Status: ${normalizeStatus(item.status)}`, created_at: item.updated_at || item.created_at
  }));
  data.sellerOffers.slice(0, 1).forEach((item) => rows.push({
    type: 'offer', title: 'Penawaran masuk', subtitle: `Status: ${normalizeStatus(item.status)}`, created_at: item.updated_at || item.created_at
  }));
  return rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 7);
}

async function loadActivity() {
  if (loading) return;
  if (!hasDataDeps()) {
    console.warn('AdaAja Activity: dependency Supabase/auth tidak tersedia.', { protocol: location.protocol });
    renderDataUnavailableState();
    return;
  }
  const user = currentUser || await requireUser();
  if (!user) {
    if (isFileMode) renderDataUnavailableState();
    return;
  }

  loading = true;
  armFailsafe();
  priorityContent.innerHTML = renderPriorityLoadingMarkup();
  refreshButton.disabled = true;
  refreshButton.classList.add('loading');

  try {
    const [notificationsRes, buyerOrdersRes, sellerOrdersRes, buyerOffersRes, sellerOffersRes] = await Promise.all([
      window.adaajaSupabase.from('notifications').select('id,type,title,message,is_read,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
      window.adaajaSupabase.from('orders').select('id,status,created_at').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(40),
      window.adaajaSupabase.from('orders').select('id,status,created_at').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(40),
      window.adaajaSupabase.from('offers').select('id,status,created_at,updated_at').eq('buyer_id', user.id).order('created_at', { ascending: false }).limit(30),
      window.adaajaSupabase.from('offers').select('id,status,created_at,updated_at').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(30)
    ]);

    [notificationsRes, buyerOrdersRes, sellerOrdersRes, buyerOffersRes, sellerOffersRes].forEach((result) => {
      if (result.error) throw result.error;
    });

    const data = {
      loaded: true,
      buyerOrders: buyerOrdersRes.data || [],
      sellerOrders: sellerOrdersRes.data || [],
      buyerOffers: buyerOffersRes.data || [],
      sellerOffers: sellerOffersRes.data || []
    };

    window.__activityData = data;
    renderStatuses('buyer', getStatusCounts(data.buyerOrders, 'buyer'));
    renderStatuses('seller', getStatusCounts(data.sellerOrders, 'seller'));
    renderPriority(data, currentRole());
    renderRecent(buildRecentRows(notificationsRes.data || [], data));

    if (!realtimeReady) setupRealtime();
  } catch (error) {
    console.error('Gagal memuat aktivitas:', error);
    renderPriorityError();
    renderRecentError();
    renderStatuses('buyer');
    renderStatuses('seller');
  } finally {
    clearFailsafe();
    loading = false;
    refreshButton.disabled = false;
    refreshButton.classList.remove('loading');
  }
}

function setupRealtime() {
  if (!currentUser || realtimeReady) return;
  cleanupRealtime();

  const scopedConfigs = [
    { table: 'orders', filter: `buyer_id=eq.${currentUser.id}` },
    { table: 'orders', filter: `seller_id=eq.${currentUser.id}` },
    { table: 'offers', filter: `buyer_id=eq.${currentUser.id}` },
    { table: 'offers', filter: `seller_id=eq.${currentUser.id}` },
    { table: 'notifications', filter: `user_id=eq.${currentUser.id}` }
  ];

  scopedConfigs.forEach((config, index) => {
    const channel = window.adaajaSupabase
      .channel(`activity-${config.table}-${index}-${currentUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: config.table, filter: config.filter }, () => loadActivity())
      .subscribe();
    realtimeChannels.push(channel);
  });
  realtimeReady = true;
}

function cleanupRealtime() {
  if (window.adaajaSupabase) realtimeChannels.forEach((channel) => window.adaajaSupabase.removeChannel(channel));
  realtimeChannels = [];
  realtimeReady = false;
}

refreshButton.addEventListener('click', async () => {
  await loadActivity();
  if (!loading) showToast('Aktivitas diperbarui.');
});

if (window.adaajaSupabase?.auth?.onAuthStateChange) {
  window.adaajaSupabase.auth.onAuthStateChange((event, session) => {
    if (!isFileMode && (event === 'SIGNED_OUT' || !session?.user)) location.replace('login.html');
  });
}

window.addEventListener('beforeunload', cleanupRealtime);
window.addEventListener('pageshow', (event) => {
  if (event.persisted && hasDataDeps()) loadActivity();
});

renderStatuses('buyer');
renderStatuses('seller');
setRole(currentRole());
if (hasDataDeps()) loadActivity();
else renderDataUnavailableState();
