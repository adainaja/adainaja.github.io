const API_URL = "https://script.google.com/macros/s/AKfycbx0VQGRZ9bXUSp8nTdgttqyD5VNOtTavrB0iqpS91gWjqTstIZzd189uIxtTQHD6FI/exec";

const api = 'https://www.emsifa.com/api-wilayah-indonesia/api/';
const selected = {};

const email = localStorage.getItem("register_email");


function formatLocation(name){

    let value = name
    .toLowerCase()
    .replace(/\b\w/g,c=>c.toUpperCase());

    if(value === "Dki Jakarta") value="DKI Jakarta";
    if(value === "Di Yogyakarta") value="DI Yogyakarta";

    return value;

}



async function openLocation(type){


    if(type==='city' && !selected.province) return;
    if(type==='district' && !selected.city) return;
    if(type==='village' && !selected.district) return;



    let url="";


    if(type==="province")
        url = api+"provinces.json";


    if(type==="city")
        url = api+"regencies/"+selected.province.id+".json";


    if(type==="district")
        url = api+"districts/"+selected.city.id+".json";


    if(type==="village")
        url = api+"villages/"+selected.district.id+".json";



    sheet.classList.add("show");

    title.innerText="Pilih "+type;

    list.innerHTML="";


    const data = await fetch(url)
    .then(r=>r.json());



    data.forEach(item=>{


        let button=document.createElement("button");

        button.className="option";

        button.innerText=formatLocation(item.name);


        button.onclick=()=>selectLocation(type,item);


        list.appendChild(button);


    });


}




function selectLocation(type,item){


    selected[type]=item;


    document.getElementById(type).innerText=
    formatLocation(item.name);



    if(type==="province"){

        city.innerText="Pilih kota";
        district.innerText="Pilih kecamatan";
        village.innerText="Pilih kelurahan";

    }


    if(type==="city"){

        district.innerText="Pilih kecamatan";
        village.innerText="Pilih kelurahan";

    }


    sheet.classList.remove("show");


}





let fotoProfile="";


photo.onchange=e=>{


    const reader=new FileReader();


    reader.onload=x=>{

        fotoProfile=x.target.result;

        avatar.innerHTML=
        '<img src="'+fotoProfile+'">';

    };


    reader.readAsDataURL(
        e.target.files[0]
    );


};







document.querySelector(".save").onclick = async function(){



    const username =
    document.querySelector(".username-box input")
    .value
    .trim();



    const alamat =
    document.querySelector("textarea")
    .value
    .trim();



    const kodePos =
    document.querySelectorAll("input")
    [
        document.querySelectorAll("input").length-1
    ]
    .value
    .trim();





    if(!username){

        alert("Username belum diisi");

        return;

    }



    if(
        !selected.province ||
        !selected.city ||
        !selected.district ||
        !selected.village
    ){

        alert("Alamat belum lengkap");

        return;

    }





    const data = {


        action:"completeProfile",


        email:email,


        username:username,


        foto_profile:fotoProfile,


        provinsi:
        formatLocation(selected.province.name),


        kota:
        formatLocation(selected.city.name),


        kecamatan:
        formatLocation(selected.district.name),


        kelurahan:
        formatLocation(selected.village.name),


        alamat:alamat,


        kode_pos:kodePos


    };





    try{


        const response =
        await fetch(API_URL,{

            method:"POST",

            body:JSON.stringify(data)

        });



        const result =
        await response.json();




        if(result.status==="success"){


            alert("Profil berhasil disimpan");


            location.href="home.html";


        }else{


            alert(result.message);


        }




    }catch(error){


        console.log(error);


        alert("Gagal terhubung server");


    }



};
