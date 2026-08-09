const $=id=>document.getElementById(id);
const BANKS=[{"code":"002","name":"Bank Rakyat Indonesia (BRI)","short":"BRI"},{"code":"008","name":"Bank Mandiri","short":"MDR"},{"code":"009","name":"Bank Negara Indonesia (BNI)","short":"BNI"},{"code":"014","name":"Bank Central Asia (BCA)","short":"BCA"},{"code":"022","name":"CIMB Niaga","short":"CIMB"},{"code":"023","name":"Bank UOB Indonesia","short":"UOB"},{"code":"028","name":"OCBC Indonesia","short":"OCBC"},{"code":"011","name":"Bank Danamon Indonesia","short":"DAN"},{"code":"016","name":"Maybank Indonesia","short":"MAY"},{"code":"013","name":"Bank Permata","short":"PER"},{"code":"426","name":"Bank Mega","short":"MEGA"},{"code":"441","name":"Bank KB Bukopin","short":"BKP"},{"code":"451","name":"Bank Syariah Indonesia (BSI)","short":"BSI"},{"code":"200","name":"Bank Tabungan Negara (BTN)","short":"BTN"},{"code":"147","name":"Bank Muamalat Indonesia","short":"BMI"},{"code":"153","name":"Bank Sinarmas","short":"SIN"},{"code":"213","name":"Bank BTPN","short":"BTPN"},{"code":"213","name":"Jenius / Bank BTPN","short":"JEN"},{"code":"490","name":"Bank Neo Commerce","short":"BNC"},{"code":"567","name":"Allo Bank Indonesia","short":"ALLO"},{"code":"535","name":"SeaBank Indonesia","short":"SEA"},{"code":"542","name":"Bank Jago","short":"JAGO"},{"code":"523","name":"Bank Sahabat Sampoerna","short":"BSS"},{"code":"950","name":"Bank Commonwealth","short":"COMM"},{"code":"116","name":"Bank Aceh Syariah","short":"ACEH"},{"code":"118","name":"Bank Nagari","short":"NGR"},{"code":"119","name":"Bank Riau Kepri Syariah","short":"BRKS"},{"code":"120","name":"Bank Sumsel Babel","short":"BSB"},{"code":"121","name":"Bank Lampung","short":"LPG"},{"code":"122","name":"Bank Kalsel","short":"KSL"},{"code":"123","name":"Bank Kalbar","short":"KBR"},{"code":"124","name":"Bank Kaltimtara","short":"KTM"},{"code":"125","name":"Bank Kalteng","short":"KTG"},{"code":"126","name":"Bank Sulselbar","short":"SSB"},{"code":"127","name":"Bank SulutGo","short":"SUL"},{"code":"128","name":"Bank NTB Syariah","short":"NTB"},{"code":"129","name":"Bank Bali","short":"BAL"},{"code":"130","name":"Bank NTT","short":"NTT"},{"code":"131","name":"Bank Maluku Malut","short":"MAL"},{"code":"132","name":"Bank Papua","short":"PAP"},{"code":"133","name":"Bank Bengkulu","short":"BKL"},{"code":"134","name":"Bank Sultra","short":"SLT"},{"code":"135","name":"Bank Banten","short":"BTN"}];
const accountList=$("accountList"),accountCount=$("accountCount"),primaryStatus=$("primaryStatus"),pageMessage=$("pageMessage"),sheet=$("accountSheet"),form=$("accountForm"),sheetTitle=$("sheetTitle"),saveButton=$("saveButton"),saveHint=$("saveHint"),accountId=$("accountId"),bankName=$("bankName"),bankCode=$("bankCode"),accountNumber=$("accountNumber"),accountHolderName=$("accountHolderName"),isDefault=$("isDefault"),deleteSheet=$("deleteSheet"),confirmDeleteButton=$("confirmDeleteButton"),bankPickerSheet=$("bankPickerSheet"),bankList=$("bankList"),bankSearchInput=$("bankSearchInput"),bankEmpty=$("bankEmpty"),selectedBankName=$("selectedBankName"),selectedBankCode=$("selectedBankCode"),selectedBankLabel=$("selectedBankLabel");
let currentSession=null,accounts=[],pendingDeleteId=null;
function esc(v){return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function mask(v){const s=String(v||"").replace(/\s+/g,"");return !s?"":s.length<=4?s:`•••• ${s.slice(-4)}`}
function norm(v){return String(v||"").replace(/[^\d]/g,"")}
function msg(t,type="error"){pageMessage.textContent=t;pageMessage.className=`page-message ${type}`}
function clearMsg(){pageMessage.textContent="";pageMessage.className="page-message"}
async function requireLogin(){const {data,error}=await window.adaajaSupabase.auth.getSession();if(error)throw error;currentSession=data.session||null;if(!currentSession?.user){localStorage.setItem("redirectAfterLogin","bank-account.html");location.replace("login.html");return null}return currentSession}
function render(){accountCount.textContent=String(accounts.length);primaryStatus.textContent=accounts.some(x=>x.is_default)?"Tersedia":"Belum ada";if(!accounts.length){accountList.innerHTML=`<div class="empty-state"><span class="empty-state-icon"><svg viewBox="0 0 24 24"><path d="M3 10h18"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8"/><path d="M4 18h16"/><path d="M12 3 3 7h18l-9-4Z"/></svg></span><strong>Belum ada rekening pencairan</strong><p>Tambahkan rekening bank agar saldo AdaPay dapat dicairkan.</p><button type="button" data-action="add">Tambah rekening</button></div>`;return}accountList.innerHTML=accounts.map(a=>`<article class="account-card ${a.is_default?"primary":""}"><div class="account-card-top"><span class="account-bank-icon"><svg viewBox="0 0 24 24"><path d="M3 10h18"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8"/><path d="M4 18h16"/><path d="M12 3 3 7h18l-9-4Z"/></svg></span><span class="account-copy"><small>${a.is_default?"REKENING UTAMA":"REKENING PENCAIRAN"}</small><strong>${esc(a.bank_name||a.bank_code)}</strong><span>${esc(a.account_holder_name)} · ${esc(mask(a.account_number))}</span></span>${a.is_verified?`<span class="verified-mark"><svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg></span>`:""}</div><div class="account-actions"><button class="default-button" type="button" data-action="default" data-id="${a.id}" ${a.is_default?"disabled":""}>${a.is_default?"Rekening utama":"Jadikan utama"}</button><button class="edit-button" type="button" data-action="edit" data-id="${a.id}">Edit rekening</button><button class="delete-button" type="button" data-action="delete" data-id="${a.id}"><svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 13h8l1-13"/></svg></button></div></article>`).join("")}

function renderBankOptions(query=""){
  const q=String(query||"").trim().toLowerCase();
  const filtered=BANKS.filter(b=>!q||b.name.toLowerCase().includes(q)||b.code.includes(q)||b.short.toLowerCase().includes(q));
  bankEmpty.hidden=filtered.length>0;
  bankList.innerHTML=filtered.map(b=>`<button class="bank-option ${bankCode.value===b.code?"selected":""}" type="button" data-bank-code="${b.code}"><span class="bank-option-logo">${esc(b.short)}</span><span class="bank-option-copy"><strong>${esc(b.name)}</strong><span>Kode bank ${esc(b.code)}</span></span><span class="bank-option-code">${esc(b.code)}</span></button>`).join("");
}
function openBankPicker(){
  renderBankOptions("");
  bankSearchInput.value="";
  bankPickerSheet.classList.add("active");
  bankPickerSheet.setAttribute("aria-hidden","false");
  document.body.classList.add("sheet-open");
  setTimeout(()=>bankSearchInput.focus(),120);
}
function closeBankPicker(){
  bankPickerSheet.classList.remove("active");
  bankPickerSheet.setAttribute("aria-hidden","true");
  if(!sheet.classList.contains("active")&&!deleteSheet.classList.contains("active"))document.body.classList.remove("sheet-open");
}
function selectBank(code){
  const bank=BANKS.find(b=>b.code===code);
  if(!bank)return;
  bankName.value=bank.name;
  bankCode.value=bank.code;
  selectedBankName.textContent=bank.name;
  selectedBankCode.textContent=bank.code;
  selectedBankLabel.textContent="Bank terpilih";
  closeBankPicker();
}
function syncSelectedBank(){
  const bank=BANKS.find(b=>b.code===bankCode.value)||BANKS.find(b=>b.name===bankName.value);
  if(bank){
    bankName.value=bank.name;bankCode.value=bank.code;
    selectedBankName.textContent=bank.name;selectedBankCode.textContent=bank.code;selectedBankLabel.textContent="Bank terpilih";
  }else{
    selectedBankName.textContent=bankName.value||"Pilih bank";
    selectedBankCode.textContent=bankCode.value||"—";
    selectedBankLabel.textContent=bankName.value?"Bank tersimpan":"Pilih bank tujuan";
  }
}

async function loadAccounts(){const s=currentSession||await requireLogin();if(!s?.user)return;const {data,error}=await window.adaajaSupabase.from("seller_bank_accounts").select("*").eq("seller_id",s.user.id).order("is_default",{ascending:false}).order("created_at",{ascending:true});if(error)throw error;accounts=data||[];render()}
function resetForm(){form.reset();accountId.value="";bankName.value="";bankCode.value="";sheetTitle.textContent="Tambah rekening";saveHint.textContent="Pastikan data sudah benar";syncSelectedBank()}
function openSheet(a=null){clearMsg();if(!a){resetForm();if(!accounts.length)isDefault.checked=true}else{accountId.value=a.id;bankName.value=a.bank_name||"";bankCode.value=a.bank_code||"";accountNumber.value=a.account_number||"";accountHolderName.value=a.account_holder_name||"";isDefault.checked=!!a.is_default;sheetTitle.textContent="Edit rekening";saveHint.textContent="Simpan perubahan rekening";syncSelectedBank()}sheet.classList.add("active");sheet.setAttribute("aria-hidden","false");document.body.classList.add("sheet-open")}
function closeSheet(){sheet.classList.remove("active");sheet.setAttribute("aria-hidden","true");document.body.classList.remove("sheet-open")}
function openDelete(id){pendingDeleteId=id;deleteSheet.classList.add("active");deleteSheet.setAttribute("aria-hidden","false");document.body.classList.add("sheet-open")}
function closeDelete(){pendingDeleteId=null;deleteSheet.classList.remove("active");deleteSheet.setAttribute("aria-hidden","true");document.body.classList.remove("sheet-open")}
async function unsetDefaults(exceptId=null){const s=currentSession||await requireLogin();let q=window.adaajaSupabase.from("seller_bank_accounts").update({is_default:false}).eq("seller_id",s.user.id).eq("is_default",true);if(exceptId)q=q.neq("id",exceptId);const {error}=await q;if(error)throw error}
async function saveAccount(e){e.preventDefault();clearMsg();const s=currentSession||await requireLogin();if(!s?.user)return;const num=norm(accountNumber.value);if(!bankName.value.trim()||!bankCode.value.trim()||!num||!accountHolderName.value.trim()){msg("Lengkapi seluruh data rekening.");return}if(num.length<5){msg("Nomor rekening belum valid.");return}saveButton.disabled=true;saveHint.textContent="Menyimpan rekening...";try{const editingId=accountId.value||null,makeDefault=!!isDefault.checked||accounts.length===0;if(makeDefault)await unsetDefaults(editingId);const payload={seller_id:s.user.id,bank_code:bankCode.value.trim().toUpperCase(),bank_name:bankName.value.trim(),account_number:num,account_holder_name:accountHolderName.value.trim(),is_default:makeDefault};let r=editingId?await window.adaajaSupabase.from("seller_bank_accounts").update(payload).eq("id",editingId).eq("seller_id",s.user.id).select().single():await window.adaajaSupabase.from("seller_bank_accounts").insert(payload).select().single();if(r.error)throw r.error;closeSheet();await loadAccounts();msg(editingId?"Rekening berhasil diperbarui.":"Rekening berhasil ditambahkan.","success")}catch(err){console.error(err);msg(err?.message||"Rekening belum dapat disimpan.")}finally{saveButton.disabled=false;saveHint.textContent="Pastikan data sudah benar"}}
async function setDefault(id){clearMsg();const s=currentSession||await requireLogin();try{await unsetDefaults(id);const {error}=await window.adaajaSupabase.from("seller_bank_accounts").update({is_default:true}).eq("id",id).eq("seller_id",s.user.id);if(error)throw error;await loadAccounts();msg("Rekening utama berhasil diperbarui.","success")}catch(err){msg(err?.message||"Rekening utama belum dapat diperbarui.")}}
async function deleteAccount(){if(!pendingDeleteId)return;const s=currentSession||await requireLogin();confirmDeleteButton.disabled=true;confirmDeleteButton.textContent="Menghapus...";try{const target=accounts.find(x=>x.id===pendingDeleteId);const {error}=await window.adaajaSupabase.from("seller_bank_accounts").delete().eq("id",pendingDeleteId).eq("seller_id",s.user.id);if(error)throw error;closeDelete();await loadAccounts();if(target?.is_default&&accounts.length)await setDefault(accounts[0].id);else msg("Rekening berhasil dihapus.","success")}catch(err){msg(err?.message||"Rekening belum dapat dihapus.")}finally{confirmDeleteButton.disabled=false;confirmDeleteButton.textContent="Hapus"}}
accountList.addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(!b)return;const action=b.dataset.action,id=b.dataset.id;if(action==="add")openSheet();if(action==="edit"){const a=accounts.find(x=>x.id===id);if(a)openSheet(a)}if(action==="default")setDefault(id);if(action==="delete")openDelete(id)});

$("bankPickerTrigger").onclick=openBankPicker;
$("bankPickerBackdrop").onclick=closeBankPicker;
$("closeBankPicker").onclick=closeBankPicker;
bankSearchInput.oninput=()=>renderBankOptions(bankSearchInput.value);
bankList.addEventListener("click",e=>{
  const button=e.target.closest("[data-bank-code]");
  if(button)selectBank(button.dataset.bankCode);
});

$("addTopButton").onclick=()=>openSheet();$("addInlineButton").onclick=()=>openSheet();$("sheetBackdrop").onclick=closeSheet;$("closeSheetButton").onclick=closeSheet;$("deleteBackdrop").onclick=closeDelete;$("cancelDeleteButton").onclick=closeDelete;confirmDeleteButton.onclick=deleteAccount;form.onsubmit=saveAccount;accountNumber.oninput=()=>accountNumber.value=norm(accountNumber.value);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeBankPicker()});
window.adaajaSupabase.auth.onAuthStateChange((event,session)=>{currentSession=session||null;if(event==="SIGNED_OUT")location.replace("login.html")});
(async()=>{try{await requireLogin();if(currentSession?.user)await loadAccounts()}catch(err){console.error(err);msg(err?.message||"Data rekening belum dapat dimuat.")}})();
