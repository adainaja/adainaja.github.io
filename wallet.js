const $ = (id) => document.getElementById(id);
const els = {
  available: $("availableBalance"), userBalance: $("userBalance"), sellerAvailable: $("sellerAvailableBalance"),
  pending: $("pendingBalance"), income: $("lifetimeIncome"), withdrawn: $("withdrawnBalance"),
  currency: $("currencyLabel"), state: $("walletState"), stateText: $("walletStateText"),
  withdraw: $("withdrawButton"), withdrawHint: $("withdrawHint"), bankLabel: $("bankStatusLabel"),
  bankTitle: $("bankTitle"), bankSubtitle: $("bankSubtitle"), bankVerified: $("bankVerified"),
  withdrawal: $("withdrawalCard"), transactions: $("transactionList"), message: $("pageMessage"), refresh: $("refreshButton")
};
let currentSession=null,userWallet=null,sellerWallet=null,bank=null;

function money(v,c="IDR"){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("id-ID",{style:"currency",currency:c,maximumFractionDigits:0}).format(n):"—"}
function dateTime(v){const d=new Date(v);return v&&!Number.isNaN(d.getTime())?new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d):"—"}
function esc(v){return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function mask(v){const s=String(v||"").replace(/\s/g,"");return !s?"":s.length<=4?s:`•••• ${s.slice(-4)}`}
async function requireLogin(){const {data,error}=await window.adaajaSupabase.auth.getSession();if(error)throw error;currentSession=data.session||null;if(!currentSession?.user){localStorage.setItem("redirectAfterLogin","wallet.html");location.replace("login.html");return null}return currentSession}
function walletCurrency(){return sellerWallet?.currency||userWallet?.currency||"IDR"}

function renderCombinedWallet(){
  const c=walletCurrency();
  const userAvailable=Number(userWallet?.available_balance||0);
  const sellerAvailable=Number(sellerWallet?.available_balance||0);
  const totalAvailable=userAvailable+sellerAvailable;
  const sellerPending=Number(sellerWallet?.pending_balance||0);
  const sellerIncome=Number(sellerWallet?.lifetime_income||0);
  const sellerWithdrawn=Number(sellerWallet?.withdrawn_balance||0);
  els.available.textContent=money(totalAvailable,c);
  els.userBalance.textContent=money(userAvailable,c);
  els.sellerAvailable.textContent=money(sellerAvailable,c);
  els.pending.textContent=money(sellerPending,c);
  els.income.textContent=money(sellerIncome,c);
  els.withdrawn.textContent=money(sellerWithdrawn,c);
  els.currency.textContent=`${c} · Saldo pengguna + hasil penjualan`;
  const userLocked=userWallet?.is_active===false||userWallet?.locked_at;
  const sellerLocked=sellerWallet?.is_active===false||sellerWallet?.locked_at;
  if(!userWallet&&!sellerWallet){els.state.className="wallet-state";els.stateText.textContent="Belum aktif";els.withdraw.disabled=true;els.withdraw.classList.remove("is-ready");els.withdrawHint.textContent="Saldo belum tersedia";return}
  if(userLocked||sellerLocked){els.state.className="wallet-state locked";els.stateText.textContent="Dibatasi"}else{els.state.className="wallet-state active";els.stateText.textContent="Aktif"}
  const canWithdraw=sellerAvailable>0&&Boolean(bank)&&!sellerLocked;
  els.withdraw.disabled=!canWithdraw;els.withdraw.classList.toggle("is-ready",canWithdraw);
  if(sellerLocked)els.withdrawHint.textContent=sellerWallet?.lock_reason||"Saldo seller sedang dibatasi";
  else if(sellerAvailable<=0)els.withdrawHint.textContent="Belum ada hasil penjualan yang bisa dicairkan";
  else if(!bank)els.withdrawHint.textContent="Tambahkan rekening dahulu";
  else els.withdrawHint.textContent=`Cairkan ${money(sellerAvailable,c)} ke rekening utama`;
}

function renderBank(a){bank=a||null;if(!bank){els.bankLabel.textContent="REKENING BELUM ADA";els.bankTitle.textContent="Tambahkan rekening pencairan";els.bankSubtitle.textContent="Diperlukan untuk menarik saldo hasil penjualan.";els.bankVerified.hidden=true}else{els.bankLabel.textContent=bank.is_default?"REKENING UTAMA":"REKENING PENCAIRAN";els.bankTitle.textContent=bank.bank_name||bank.bank_code||"Rekening bank";els.bankSubtitle.textContent=[bank.account_holder_name,mask(bank.account_number)].filter(Boolean).join(" · ")||"Rekening tersimpan";els.bankVerified.hidden=!bank.is_verified}renderCombinedWallet()}
function statusInfo(s){return({requested:["Diajukan","warning"],pending:["Menunggu","warning"],approved:["Disetujui","warning"],processing:["Diproses","warning"],transferred:["Ditransfer","success"],completed:["Selesai","success"],rejected:["Ditolak","danger"],cancelled:["Dibatalkan","danger"]})[String(s||"").toLowerCase()]||[s||"Tidak diketahui",""]}
function renderWithdrawal(w){if(!w){els.withdrawal.innerHTML=`<div class="withdrawal-empty"><span class="empty-icon"><svg viewBox="0 0 24 24"><path d="M4 7h16v10H4z"></path><path d="M8 12h8"></path></svg></span><strong>Belum ada pencairan</strong><p>Permintaan pencairan terbaru akan tampil di sini.</p></div>`;return}const [label,cls]=statusInfo(w.status);els.withdrawal.innerHTML=`<div class="withdrawal-item"><div class="withdrawal-top"><div><small>Nominal pencairan</small><strong>${money(w.amount,walletCurrency())}</strong></div><span class="status-badge ${cls}">${esc(label)}</span></div><div class="withdrawal-meta"><span><small>Rekening tujuan</small><strong>${esc(w.bank_name||"Bank")} ${esc(mask(w.account_number))}</strong></span><span><small>Diajukan</small><strong>${esc(dateTime(w.requested_at||w.created_at))}</strong></span></div></div>`}
function txDirection(t){const type=String(t.transaction_type||t.activity_type||t.type||"").toLowerCase();if(["topup","credit","income","release","sale","refund_credit"].some(x=>type.includes(x)))return"credit";if(["withdraw","debit","fee","purchase","refund_debit"].some(x=>type.includes(x)))return"debit";return Number(t.available_after||0)>Number(t.available_before||0)||Number(t.pending_after||0)>Number(t.pending_before||0)?"credit":Number(t.available_after||0)<Number(t.available_before||0)||Number(t.pending_after||0)<Number(t.pending_before||0)?"debit":"neutral"}
function txLabel(t){const type=String(t.transaction_type||t.activity_type||t.type||"").toLowerCase();return({topup:"Top Up AdaPay",sale_pending:"Dana penjualan tertahan",sale_release:"Dana penjualan tersedia",purchase:"Pembayaran AdaPay",withdrawal:"Penarikan saldo",refund:"Refund",fee:"Biaya layanan",adjustment:"Penyesuaian saldo"})[type]||t.description||t.note||"Aktivitas AdaPay"}
function normalizeSellerActivity(r){return {...r,transaction_type:r.transaction_type||r.activity_type||r.type||"sale_release",description:r.description||r.note||"Aktivitas saldo penjualan",amount:r.amount??r.net_amount??r.credit_amount??r.debit_amount??0,created_at:r.created_at||r.updated_at}}
function renderTransactions(rows){if(!rows?.length){els.transactions.innerHTML=`<div class="transaction-empty"><span class="empty-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg></span><strong>Belum ada transaksi AdaPay</strong><p>Top Up, pembayaran, refund, hasil penjualan, dan pencairan akan tampil di sini.</p></div>`;return}els.transactions.innerHTML=rows.map(t=>{const dir=txDirection(t),prefix=dir==="credit"?"+":dir==="debit"?"−":"",icon=dir==="credit"?'<path d="M12 19V7"></path><path d="m7 12 5-5 5 5"></path>':dir==="debit"?'<path d="M12 5v12"></path><path d="m7 12 5 5 5-5"></path>':'<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>';return`<div class="transaction-row"><span class="transaction-icon ${dir}"><svg viewBox="0 0 24 24">${icon}</svg></span><span class="transaction-copy"><strong>${esc(txLabel(t))}</strong><span>${esc(t.transaction_number||t.reference_type||"AdaPay")}</span></span><span class="transaction-amount"><strong class="${dir}">${prefix}${money(Math.abs(Number(t.amount||0)),walletCurrency())}</strong><small>${esc(dateTime(t.created_at))}</small></span></div>`}).join("")}

async function loadUserWallet(uid){await window.adaajaSupabase.rpc("ensure_my_wallet");const {data,error}=await window.adaajaSupabase.from("user_wallets").select("*").eq("user_id",uid).maybeSingle();if(error)throw error;userWallet=data||null;renderCombinedWallet()}
async function loadSellerWallet(uid){const {data,error}=await window.adaajaSupabase.from("seller_wallets").select("*").eq("seller_id",uid).maybeSingle();if(error)throw error;sellerWallet=data||null;renderCombinedWallet()}
async function loadBank(uid){const {data,error}=await window.adaajaSupabase.from("seller_bank_accounts").select("*").eq("seller_id",uid).order("is_default",{ascending:false}).order("created_at",{ascending:true}).limit(1).maybeSingle();if(error)throw error;renderBank(data)}
async function loadWithdrawal(uid){const {data,error}=await window.adaajaSupabase.from("withdrawals").select("id,amount,status,bank_name,account_number,requested_at,created_at").eq("seller_id",uid).order("requested_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(1).maybeSingle();if(error)throw error;renderWithdrawal(data)}
async function loadUserTransactions(uid,limit=6){const {data,error}=await window.adaajaSupabase.from("user_wallet_transactions").select("*").eq("user_id",uid).order("created_at",{ascending:false}).limit(limit);if(error)throw error;return data||[]}
async function loadSellerTransactions(uid,limit=6){try{const {data,error}=await window.adaajaSupabase.from("seller_wallet_activity").select("*").eq("seller_id",uid).order("created_at",{ascending:false}).limit(limit);if(error)throw error;return (data||[]).map(normalizeSellerActivity)}catch(e){console.warn("seller_wallet_activity tidak dapat dibaca:",e);return[]}}
async function loadTransactions(uid,limit=6){const [u,s]=await Promise.all([loadUserTransactions(uid,limit),loadSellerTransactions(uid,limit)]);const merged=[...u,...s].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,limit);renderTransactions(merged)}
async function loadPage(){els.message.className="page-message";els.message.textContent="";els.refresh.disabled=true;try{const s=await requireLogin();if(!s)return;const uid=s.user.id;await Promise.all([loadUserWallet(uid),loadSellerWallet(uid)]);await loadBank(uid);await Promise.all([loadWithdrawal(uid),loadTransactions(uid)])}catch(e){console.error(e);els.message.textContent=e?.message||"Data AdaPay belum dapat dimuat.";els.message.className="page-message error"}finally{els.refresh.disabled=false}}

els.withdraw.onclick=()=>{if(!els.withdraw.disabled)location.href="withdraw.html"};
$("historyButton").onclick=()=>$("transactionSection").scrollIntoView({behavior:"smooth"});
$("seeAllTransactions").onclick=async()=>{if(currentSession?.user)await loadTransactions(currentSession.user.id,50)};
els.refresh.onclick=loadPage;
window.adaajaSupabase.auth.onAuthStateChange((e,s)=>{currentSession=s||null;if(e==="SIGNED_OUT")location.replace("login.html")});
loadPage();
