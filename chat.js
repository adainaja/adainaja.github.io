const conversationId=new URLSearchParams(location.search).get("conversation_id"),messagesArea=document.getElementById("messagesArea"),messageInput=document.getElementById("messageInput"),composer=document.getElementById("composer"),sendButton=document.getElementById("sendButton"),toast=document.getElementById("toast");
let currentUser=null,conversation=null,realtimeChannel=null,toastTimer=null;
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
function time(v){return new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"}).format(new Date(v))}
function showToast(m){toast.textContent=m;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2200)}
async function requireUser(){const u=await window.AdaAjaAuth.getCurrentUser();if(!u){localStorage.setItem("redirectAfterLogin",location.pathname.split("/").pop()+location.search);location.replace("login.html");return null}currentUser=u;return u}
async function loadConversation(){
 const u=await requireUser();if(!u)return;if(!conversationId){showToast("Percakapan tidak ditemukan.");return}
 try{
  const {data:member,error:me}=await window.adaajaSupabase.from("conversation_members").select("conversation_id,user_id,last_read_at").eq("conversation_id",conversationId).eq("user_id",u.id).maybeSingle();if(me)throw me;if(!member)throw new Error("Anda tidak memiliki akses ke percakapan ini.");
  const {data:c,error:ce}=await window.adaajaSupabase.from("conversations").select("*").eq("id",conversationId).maybeSingle();if(ce)throw ce;conversation=c;
  const {data:members}=await window.adaajaSupabase.from("conversation_members").select("user_id,role").eq("conversation_id",conversationId);const other=(members||[]).find(m=>m.user_id!==u.id);
  if(other){const {data:p}=await window.adaajaSupabase.from("profiles").select("id,username,full_name,avatar_url").eq("id",other.user_id).maybeSingle();const name=p?.username||p?.full_name||"Pengguna AdaAja";document.getElementById("chatName").textContent=name;document.getElementById("chatAvatar").innerHTML=p?.avatar_url?`<img src="${esc(p.avatar_url)}" alt="${esc(name)}">`:esc(name.charAt(0).toUpperCase())}
  let context="Percakapan AdaAja";if(c?.product_id){const {data:p}=await window.adaajaSupabase.from("products").select("name").eq("id",c.product_id).maybeSingle();if(p?.name){context=p.name;document.getElementById("contextButton").href=`product-detail.html?id=${encodeURIComponent(c.product_id)}`}}else if(c?.order_id){context="Percakapan pesanan";document.getElementById("contextButton").href=`my-orders.html?order_id=${encodeURIComponent(c.order_id)}`}
  document.getElementById("chatContext").textContent=context;document.getElementById("contextTitle").textContent=context;
  await loadMessages();subscribe();await markRead();
 }catch(e){console.error(e);messagesArea.innerHTML=`<div class="chat-empty"><strong>Chat belum dapat dimuat</strong><p>${esc(e.message||"Silakan coba kembali.")}</p></div>`}
}
async function loadMessages(){
 const {data,error}=await window.adaajaSupabase.from("messages").select("id,conversation_id,sender_id,message_type,message_text,attachment_url,is_deleted,created_at").eq("conversation_id",conversationId).order("created_at",{ascending:true});if(error)throw error;
 const rows=data||[];if(!rows.length){messagesArea.innerHTML='<div class="chat-empty"><strong>Mulai percakapan</strong><p>Kirim pesan pertama untuk memulai percakapan ini.</p></div>';return}
 messagesArea.innerHTML=rows.map(m=>`<div class="message-row ${m.sender_id===currentUser.id?"mine":""}"><div class="message-bubble">${esc(m.is_deleted?"Pesan dihapus":m.message_text||"")}<div class="message-meta"><span>${esc(time(m.created_at))}</span></div></div></div>`).join("");messagesArea.scrollTop=messagesArea.scrollHeight
}
async function markRead(){await window.adaajaSupabase.from("conversation_members").update({last_read_at:new Date().toISOString()}).eq("conversation_id",conversationId).eq("user_id",currentUser.id)}
function subscribe(){if(realtimeChannel)window.adaajaSupabase.removeChannel(realtimeChannel);realtimeChannel=window.adaajaSupabase.channel(`chat-${conversationId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},async()=>{await loadMessages();await markRead()}).subscribe()}
async function sendMessage() {
  const text = messageInput.value.trim();

  if (!text || !currentUser || !conversationId) {
    return;
  }

  sendButton.disabled = true;

  const originalValue = messageInput.value;

  try {
    const { error } = await window.adaajaSupabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        message_type: "text",
        message_text: text
      });

    if (error) throw error;

    messageInput.value = "";
    messageInput.style.height = "auto";

    await window.adaajaSupabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString()
      })
      .eq("id", conversationId);

    // Jangan hanya mengandalkan Realtime.
    // Muat ulang langsung supaya pesan pasti terlihat.
    await loadMessages();
    await markRead();

    requestAnimationFrame(() => {
      messagesArea.scrollTop = messagesArea.scrollHeight;
      messageInput.focus();
    });
  } catch (err) {
    console.error("Pesan gagal dikirim:", err);

    // Pertahankan teks jika insert gagal.
    messageInput.value = originalValue;

    showToast(
      err.message ||
      "Pesan gagal dikirim."
    );
  } finally {
    sendButton.disabled = false;
  }
}

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendMessage();
});if(error)throw error;messageInput.value="";messageInput.style.height="auto";await window.adaajaSupabase.from("conversations").update({last_message_at:new Date().toISOString()}).eq("id",conversationId)}catch(err){console.error(err);showToast(err.message||"Pesan gagal dikirim.")}finally{sendButton.disabled=false}});
messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height =
    Math.min(messageInput.scrollHeight, 88) + "px";
});

messageInput.addEventListener("keydown", async (event) => {
  // Enter = kirim
  // Shift + Enter = baris baru
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing
  ) {
    event.preventDefault();
    await sendMessage();
  }
});document.getElementById("attachmentButton").onclick=()=>showToast("Lampiran akan diaktifkan pada tahap berikutnya.");window.adaajaSupabase.auth.onAuthStateChange((e,s)=>{if(e==="SIGNED_OUT"||!s?.user)location.replace("login.html")});loadConversation();
