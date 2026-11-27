'use strict';
// Preserve the source records and update Netcad's per-layer RGB extension and header offsets.
function maslakNczColors(bytes, colors) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), decoder=new TextDecoder('windows-1254');
  const records=[];let table;
  for(let at=120;at+5<=bytes.length;){
    const size=view.getUint32(at+1,true), type=bytes[at],end=at+size+5;
    if(end>bytes.length)throw Error('NCZ bölüm uzunluğu geçersiz.');
    const data=bytes.subarray(at+5,end);
    if(type===6)table=data;
    if(type!==28||decoder.decode(data.subarray(1,8))!=='LEX.ST2')records.push({type,data});
    at=end;
  }
  if(!table)throw Error('NCZ tabaka tablosu eksik.');
  const count=new DataView(table.buffer,table.byteOffset,table.byteLength).getUint16(11,true);
  const rgb=new Uint8Array(19+count*256),meta=new DataView(rgb.buffer);
  rgb[0]=7;rgb.set(new TextEncoder().encode('LEX.ST2'),1);meta.setUint32(11,100,true);meta.setUint32(15,count,true);
  for(let i=0;i<count;i++){
    const p=13+29*i,name=decoder.decode(table.subarray(p+5,p+5+table[p+4])),color=colors[name];
    if(color)rgb.set([1,...color,0],19+256*i+54);
  }
  const at=records.findIndex(r=>r.type===23);if(at<0)throw Error('NCZ başvuru bölümü eksik.');
  records.splice(at,0,{type:28,data:rgb});
  const out=new Uint8Array(records.reduce((n,r)=>n+r.data.length+5,120)),header=new DataView(out.buffer),offsets={};
  out.set(bytes.subarray(0,120));let pos=120;
  for(const {type,data} of records){offsets[type]??=pos;out[pos]=type;header.setUint32(pos+1,data.length,true);out.set(data,pos+5);pos+=data.length+5;}
  [120,pos,offsets[2],offsets[6],offsets[8],0,0,offsets[11],offsets[12],offsets[14],offsets[13],offsets[23]].forEach((v,i)=>header.setUint32(1+i*4,v||0,true));
  return out;
}
if(typeof module!=='undefined')module.exports=maslakNczColors;
