// Tambahkan di doPost(e):
// else if(data.action === "getSellerOffers"){ response = getSellerOffers(data.seller_id); }
// else if(data.action === "updateOfferStatus"){ response = updateOfferStatus(data); }

function getSellerOffers(sellerId){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const os=ss.getSheetByName("Offers"), ps=ss.getSheetByName("Products"), is=ss.getSheetByName("Product_Images"), us=ss.getSheetByName("Users");
  if(!os||!ps||!is||!us)return{status:"failed",message:"Sheet database tidak lengkap"};
  if(!sellerId)return{status:"failed",message:"Seller ID tidak tersedia"};

  const od=os.getDataRange().getValues(), pd=ps.getDataRange().getValues(), id=is.getDataRange().getValues(), ud=us.getDataRange().getValues();
  const products={}, images={}, users={};

  for(let i=1;i<pd.length;i++)products[String(pd[i][0])]={nama_produk:pd[i][4]};
  for(let i=1;i<id.length;i++){const p=String(id[i][1]),s=Number(id[i][3])||0;if(!images[p]||s===1)images[p]=id[i][2]||""}
  for(let i=1;i<ud.length;i++)users[String(ud[i][0])]={username:ud[i][3],nama_lengkap:ud[i][4]};

  const offers=[];
  for(let i=1;i<od.length;i++){
    const r=od[i];
    if(String(r[3])!==String(sellerId))continue;
    const p=String(r[1]),b=String(r[2]),buyer=users[b]||{};
    offers.push({
      offer_id:r[0],product_id:r[1],buyer_id:r[2],seller_id:r[3],
      harga_asli:Number(r[4])||0,harga_penawaran:Number(r[5])||0,
      catatan:r[6]||"",status:r[7]||"pending",created_at:r[8],
      nama_produk:(products[p]||{}).nama_produk||"Produk",
      image_url:images[p]||"",
      buyer_name:buyer.username||buyer.nama_lengkap||b
    });
  }
  offers.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  return{status:"success",offers};
}

function updateOfferStatus(data){
  const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Offers");
  if(!sheet)return{status:"failed",message:"Sheet Offers tidak ditemukan"};
  if(!data.offer_id||!data.seller_id||!data.status)return{status:"failed",message:"Data belum lengkap"};
  if(!["accepted","rejected"].includes(data.status))return{status:"failed",message:"Status tidak valid"};

  const rows=sheet.getDataRange().getValues();
  let row=-1,productId="";
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][0])===String(data.offer_id)){
      if(String(rows[i][3])!==String(data.seller_id))return{status:"failed",message:"Tidak berhak mengubah penawaran"};
      if(String(rows[i][7])!=="pending")return{status:"failed",message:"Penawaran sudah diproses"};
      row=i+1;productId=String(rows[i][1]);break;
    }
  }
  if(row===-1)return{status:"failed",message:"Penawaran tidak ditemukan"};
  sheet.getRange(row,8).setValue(data.status);

  if(data.status==="accepted"){
    for(let i=1;i<rows.length;i++){
      if(String(rows[i][1])===productId&&String(rows[i][0])!==String(data.offer_id)&&String(rows[i][7])==="pending"){
        sheet.getRange(i+1,8).setValue("rejected");
      }
    }
  }
  return{status:"success",message:data.status==="accepted"?"Penawaran diterima":"Penawaran ditolak"};
}
