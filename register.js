function toggle(id){
let x=document.getElementById(id);
x.type=x.type==='password'?'text':'password';
}
function register(){
let p=password.value,c=confirm.value;
let m=document.getElementById('message');
if(!name.value||!contact.value||!p||!c){m.className='error';m.innerHTML='Lengkapi semua data';return;}
if(p.length<8){m.className='error';m.innerHTML='Password minimal 8 karakter';return;}
if(p!==c){m.className='error';m.innerHTML='Password tidak sama';return;}
if(!agree.checked){m.className='error';m.innerHTML='Setujui syarat terlebih dahulu';return;}
m.className='success';m.innerHTML='Akun berhasil dibuat';
setTimeout(()=>location.href='profile.html',1000);
}