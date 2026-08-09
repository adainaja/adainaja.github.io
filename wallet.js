const availableBalanceElement = document.getElementById("availableBalance");
const pendingBalanceElement = document.getElementById("pendingBalance");
const lifetimeIncomeElement = document.getElementById("lifetimeIncome");
const withdrawnBalanceElement = document.getElementById("withdrawnBalance");
const currencyLabel = document.getElementById("currencyLabel");

const walletState = document.getElementById("walletState");
const walletStateText = document.getElementById("walletStateText");
const withdrawButton = document.getElementById("withdrawButton");
const withdrawHint = document.getElementById("withdrawHint");

const bankStatusLabel = document.getElementById("bankStatusLabel");
const bankTitle = document.getElementById("bankTitle");
const bankSubtitle = document.getElementById("bankSubtitle");
const bankVerified = document.getElementById("bankVerified");

const withdrawalCard = document.getElementById("withdrawalCard");
const transactionList = document.getElementById("transactionList");
const pageMessage = document.getElementById("pageMessage");
const refreshButton = document.getElementById("refreshButton");

let currentSession = null;
let walletData = null;
let defaultBankAccount = null;

function formatCurrency(value, currency = "IDR") {
  if (value === null || value === undefined || value === "") return "—";

  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(number);
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function maskAccountNumber(value) {
  const digits = String(value || "").replace(/\s+/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}

function showMessage(text, type = "error") {
  pageMessage.textContent = text;
  pageMessage.className = `page-message ${type}`;
}

function clearMessage() {
  pageMessage.textContent = "";
  pageMessage.className = "page-message";
}

async function getSession() {
  const { data, error } = await window.adaajaSupabase.auth.getSession();
  if (error) throw error;

  currentSession = data.session || null;
  return currentSession;
}

async function requireLogin() {
  try {
    const session = await getSession();
    if (session?.user) return session;
  } catch (error) {
    console.warn("Wallet session check failed:", error);
  }

  localStorage.setItem("redirectAfterLogin", "wallet.html");
  location.replace("login.html");
  return null;
}

function renderWallet(wallet) {
  walletData = wallet || null;

  if (!wallet) {
    availableBalanceElement.textContent = "—";
    pendingBalanceElement.textContent = "—";
    lifetimeIncomeElement.textContent = "—";
    withdrawnBalanceElement.textContent = "—";
    currencyLabel.textContent = "Wallet belum tersedia untuk akun ini";

    walletState.className = "wallet-state";
    walletStateText.textContent = "Belum aktif";

    withdrawButton.disabled = true;
    withdrawHint.textContent = "Saldo belum tersedia";
    return;
  }

  const currency = wallet.currency || "IDR";
  const available = Number(wallet.available_balance || 0);
  const pending = Number(wallet.pending_balance || 0);
  const withdrawn = Number(wallet.withdrawn_balance || 0);
  const lifetime = Number(wallet.lifetime_income || 0);

  availableBalanceElement.textContent = formatCurrency(available, currency);
  pendingBalanceElement.textContent = formatCurrency(pending, currency);
  lifetimeIncomeElement.textContent = formatCurrency(lifetime, currency);
  withdrawnBalanceElement.textContent = formatCurrency(withdrawn, currency);

  currencyLabel.textContent = `${currency} · Saldo hasil transaksi Anda`;

  if (wallet.is_active === false || wallet.locked_at) {
    walletState.className = "wallet-state locked";
    walletStateText.textContent = "Dibatasi";
    withdrawButton.disabled = true;
    withdrawHint.textContent = wallet.lock_reason || "Wallet sedang dibatasi";
    return;
  }

  walletState.className = "wallet-state active";
  walletStateText.textContent = "Aktif";

  const canWithdraw = available > 0 && Boolean(defaultBankAccount);
  withdrawButton.disabled = !canWithdraw;

  if (available <= 0) {
    withdrawHint.textContent = "Saldo tersedia belum cukup";
  } else if (!defaultBankAccount) {
    withdrawHint.textContent = "Tambahkan rekening dahulu";
  } else {
    withdrawHint.textContent = "Cairkan ke rekening utama";
  }
}

function renderBankAccount(account) {
  defaultBankAccount = account || null;

  if (!account) {
    bankStatusLabel.textContent = "REKENING BELUM ADA";
    bankTitle.textContent = "Tambahkan rekening pencairan";
    bankSubtitle.textContent = "Diperlukan untuk menarik saldo AdaPay.";
    bankVerified.hidden = true;

    if (walletData) renderWallet(walletData);
    return;
  }

  bankStatusLabel.textContent = account.is_default ? "REKENING UTAMA" : "REKENING PENCAIRAN";
  bankTitle.textContent = account.bank_name || account.bank_code || "Rekening bank";

  const accountName = account.account_holder_name || "";
  const masked = maskAccountNumber(account.account_number);
  bankSubtitle.textContent = [accountName, masked].filter(Boolean).join(" · ") || "Rekening tersimpan";

  bankVerified.hidden = !account.is_verified;

  if (walletData) renderWallet(walletData);
}

function withdrawalStatusInfo(status) {
  const normalized = String(status || "").toLowerCase();

  const map = {
    requested: { label: "Diajukan", className: "warning" },
    pending: { label: "Menunggu", className: "warning" },
    approved: { label: "Disetujui", className: "warning" },
    processing: { label: "Diproses", className: "warning" },
    transferred: { label: "Ditransfer", className: "success" },
    completed: { label: "Selesai", className: "success" },
    rejected: { label: "Ditolak", className: "danger" },
    cancelled: { label: "Dibatalkan", className: "danger" }
  };

  return map[normalized] || { label: status || "Tidak diketahui", className: "" };
}

function renderWithdrawal(withdrawal) {
  if (!withdrawal) {
    withdrawalCard.innerHTML = `
      <div class="withdrawal-empty">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16v10H4z"></path>
            <path d="M8 12h8"></path>
          </svg>
        </span>
        <strong>Belum ada pencairan</strong>
        <p>Permintaan pencairan terbaru akan tampil di sini.</p>
      </div>
    `;
    return;
  }

  const status = withdrawalStatusInfo(withdrawal.status);
  const currency = walletData?.currency || "IDR";

  withdrawalCard.innerHTML = `
    <div class="withdrawal-item">
      <div class="withdrawal-top">
        <div>
          <small>Nominal pencairan</small>
          <strong>${formatCurrency(withdrawal.amount, currency)}</strong>
        </div>
        <span class="status-badge ${status.className}">${status.label}</span>
      </div>

      <div class="withdrawal-meta">
        <span>
          <small>Rekening tujuan</small>
          <strong>${escapeHtml(withdrawal.bank_name || "Bank")} ${escapeHtml(maskAccountNumber(withdrawal.account_number))}</strong>
        </span>
        <span>
          <small>Diajukan</small>
          <strong>${escapeHtml(formatDateTime(withdrawal.requested_at || withdrawal.created_at))}</strong>
        </span>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function transactionPresentation(transaction) {
  const type = String(transaction.transaction_type || "").toLowerCase();
  const amount = Number(transaction.amount || 0);

  const positiveWords = ["credit", "income", "release", "sale", "earning", "refund_credit"];
  const negativeWords = ["withdraw", "debit", "fee", "refund_debit", "adjustment_debit"];

  let direction = "neutral";

  if (positiveWords.some((word) => type.includes(word))) direction = "credit";
  if (negativeWords.some((word) => type.includes(word))) direction = "debit";

  if (direction === "neutral") {
    const availableBefore = Number(transaction.available_before || 0);
    const availableAfter = Number(transaction.available_after || 0);
    const pendingBefore = Number(transaction.pending_before || 0);
    const pendingAfter = Number(transaction.pending_after || 0);

    if (availableAfter > availableBefore || pendingAfter > pendingBefore) direction = "credit";
    if (availableAfter < availableBefore || pendingAfter < pendingBefore) direction = "debit";
  }

  const labels = {
    sale_pending: "Dana penjualan tertahan",
    sale_release: "Dana penjualan tersedia",
    withdrawal: "Penarikan saldo",
    withdrawal_request: "Permintaan pencairan",
    withdrawal_completed: "Pencairan berhasil",
    refund: "Penyesuaian refund",
    fee: "Biaya layanan",
    adjustment: "Penyesuaian saldo"
  };

  return {
    direction,
    label: labels[type] || transaction.description || "Aktivitas saldo",
    amount: Math.abs(amount)
  };
}

function renderTransactions(transactions) {
  if (!transactions?.length) {
    transactionList.innerHTML = `
      <div class="transaction-empty">
        <span class="empty-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9"></circle>
            <path d="M12 7v5l3 2"></path>
          </svg>
        </span>
        <strong>Belum ada transaksi AdaPay</strong>
        <p>Mutasi saldo dari penjualan dan pencairan akan tampil di sini.</p>
      </div>
    `;
    return;
  }

  const currency = walletData?.currency || "IDR";

  transactionList.innerHTML = transactions.map((transaction) => {
    const presentation = transactionPresentation(transaction);

    const amountPrefix =
      presentation.direction === "credit" ? "+" :
      presentation.direction === "debit" ? "−" :
      "";

    const icon =
      presentation.direction === "credit"
        ? '<path d="M12 19V7"></path><path d="m7 12 5-5 5 5"></path>'
        : presentation.direction === "debit"
          ? '<path d="M12 5v12"></path><path d="m7 12 5 5 5-5"></path>'
          : '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>';

    return `
      <div class="transaction-row">
        <span class="transaction-icon ${presentation.direction}">
          <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>
        </span>

        <span class="transaction-copy">
          <strong>${escapeHtml(presentation.label)}</strong>
          <span>${escapeHtml(transaction.transaction_number || transaction.reference_type || "AdaPay")}</span>
        </span>

        <span class="transaction-amount">
          <strong class="${presentation.direction}">
            ${amountPrefix}${formatCurrency(presentation.amount, currency)}
          </strong>
          <small>${escapeHtml(formatDateTime(transaction.created_at))}</small>
        </span>
      </div>
    `;
  }).join("");
}

async function loadWallet(userId) {
  const { data, error } = await window.adaajaSupabase
    .from("seller_wallets")
    .select(`
      id,
      seller_id,
      currency,
      pending_balance,
      available_balance,
      withdrawn_balance,
      lifetime_income,
      is_active,
      locked_at,
      lock_reason,
      last_transaction_at,
      last_withdrawal_at,
      created_at,
      updated_at
    `)
    .eq("seller_id", userId)
    .maybeSingle();

  if (error) throw error;
  renderWallet(data || null);
  return data || null;
}

async function loadBankAccount(userId) {
  const { data, error } = await window.adaajaSupabase
    .from("seller_bank_accounts")
    .select(`
      id,
      seller_id,
      bank_code,
      bank_name,
      account_number,
      account_holder_name,
      is_default,
      is_verified,
      created_at,
      updated_at
    `)
    .eq("seller_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  renderBankAccount(data || null);
  return data || null;
}

async function loadLatestWithdrawal(userId) {
  const { data, error } = await window.adaajaSupabase
    .from("withdrawals")
    .select(`
      id,
      withdrawal_number,
      seller_id,
      amount,
      fee_amount,
      net_amount,
      status,
      bank_code,
      bank_name,
      account_number,
      account_holder_name,
      requested_at,
      created_at
    `)
    .eq("seller_id", userId)
    .order("requested_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  renderWithdrawal(data || null);
  return data || null;
}

async function loadTransactions(userId, limit = 6) {
  const { data, error } = await window.adaajaSupabase
    .from("wallet_transactions")
    .select(`
      id,
      wallet_id,
      seller_id,
      order_id,
      transaction_number,
      transaction_type,
      reference_type,
      reference_id,
      amount,
      pending_before,
      pending_after,
      available_before,
      available_after,
      withdrawn_before,
      withdrawn_after,
      status,
      description,
      created_at
    `)
    .eq("seller_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  renderTransactions(data || []);
  return data || [];
}

async function loadPage() {
  clearMessage();

  const session = await requireLogin();
  if (!session?.user) return;

  refreshButton.disabled = true;

  try {
    const userId = session.user.id;

    await Promise.all([
      loadBankAccount(userId),
      loadWallet(userId),
      loadLatestWithdrawal(userId),
      loadTransactions(userId)
    ]);
  } catch (error) {
    console.error("AdaPay load failed:", error);
    showMessage(
      error?.message ||
      "Data AdaPay belum dapat dimuat. Silakan coba kembali."
    );
  } finally {
    refreshButton.disabled = false;
  }
}

withdrawButton.addEventListener("click", () => {
  if (withdrawButton.disabled) return;
  location.href = "withdraw.html";
});

document.getElementById("historyButton").addEventListener("click", () => {
  document.getElementById("transactionSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

document.getElementById("seeAllTransactions").addEventListener("click", async () => {
  const session = currentSession || await getSession();
  if (!session?.user) return;

  try {
    await loadTransactions(session.user.id, 50);
    document.getElementById("transactionSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) {
    showMessage(error?.message || "Riwayat transaksi belum dapat dimuat.");
  }
});

refreshButton.addEventListener("click", loadPage);

window.adaajaSupabase.auth.onAuthStateChange((event, session) => {
  currentSession = session || null;

  if (event === "SIGNED_OUT") {
    location.replace("login.html");
  }
});

window.addEventListener("pageshow", () => {
  currentSession = null;
  loadPage();
});

loadPage();
