const api='https://www.emsifa.com/api-wilayah-indonesia/api/';
const selected={};

function formatLocation(name){
let value=name.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
if(value==="Dki Jakarta") value="DKI Jakarta";
if(value==="Di Yogyakarta") value="DI Yogyakarta";
return value;
}

async function openLocation(type){
if(type==='city'&&!selected.province)return;
if(type==='district'&&!selected.city)return;
if(type==='village'&&!selected.district)return;

let url='';
if(type==='province')url=api+'provinces.json';
if(type==='city')url=api+'regencies/'+selected.province.id+'.json';
if(type==='district')url=api+'districts/'+selected.city.id+'.json';
if(type==='village')url=api+'villages/'+selected.district.id+'.json';

sheet.classList.add('show');
title.innerText='Pilih '+type;
list.innerHTML='';

let data=await fetch(url).then(r=>r.json());

data.forEach(item=>{
let b=document.createElement('button');
b.className='option';
b.innerText=formatLocation(item.name);
b.onclick=()=>selectLocation(type,item);
list.appendChild(b);
});
}

function selectLocation(type,item){
selected[type]=item;
document.getElementById(type).innerText=formatLocation(item.name);

if(type==='province'){
city.innerText='Pilih kota';
district.innerText='Pilih kecamatan';
village.innerText='Pilih kelurahan';
}

if(type==='city'){
district.innerText='Pilih kecamatan';
village.innerText='Pilih kelurahan';
}

sheet.classList.remove('show');
}

photo.onchange=e=>{
let r=new FileReader();
r.onload=x=>avatar.innerHTML='<img src="'+x.target.result+'">';
r.readAsDataURL(e.target.files[0]);
}
