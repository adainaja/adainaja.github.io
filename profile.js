function convertDriveImage(url){
if(!url)return "";
if(url.includes("drive.google.com")){
const id=url.match(/[-\w]{25,}/);
if(id)return "https://drive.google.com/thumbnail?id="+id[0]+"&sz=w200";
}
return url;
}

const data=localStorage.getItem("user");

if(data){
const user=JSON.parse(data);
username.innerHTML=user.username||user.nama_lengkap||"User";
email.innerHTML=user.email||"";
if(user.foto_profile) photo.src=convertDriveImage(user.foto_profile);
}

function logout(){
localStorage.removeItem("user");
localStorage.removeItem("login_email");
location.href="login.html";
}
