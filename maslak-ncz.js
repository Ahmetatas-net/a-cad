'use strict';
// Native Netcad pen indices (not DXF ACI). Used by indexed readers and for plotting.
const maslakPens = [[0,255,255,255],[1,0,0,255],[2,0,255,0],[3,0,255,255],[4,255,0,0],[5,255,128,0],[6,138,117,0],[10,255,0,255],[13,255,127,127],[16,0,0,0],[17,0,0,205],[19,0,219,219],[20,230,0,0],[25,0,92,230],[28,65,105,225],[35,0,198,178],[41,0,77,168],[48,156,156,156],[51,0,147,147],[59,60,190,60],[66,0,128,0],[74,109,6,136],[84,64,0,0],[96,52,52,52],[101,226,30,0],[107,85,129,27],[121,38,83,122],[134,190,217,95],[172,191,209,229],[176,225,225,225],[178,155,219,193],[191,229,198,170],[201,190,118,150],[214,255,180,0],[220,217,204,60],[237,128,128,128],[248,78,78,78]];
function maslakNczPen([r,g,b]){
  let best=0,cost=Infinity;
  for(const [id,x,y,z] of maslakPens){
    const dr=r-x,dg=g-y,db=b-z;
    const d=dr*dr+dg*dg+db*db+2*((dr-dg)**2+(dg-db)**2+(db-dr)**2);
    if(d<cost){best=id;cost=d;}
  }
  return best;
}
function maslakNczColors(bytes,colors,widths={}){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder('windows-1254');
  const records=[];let table;
  for(let at=120;at<bytes.length;){
    if(at+5>bytes.length)throw Error('NCZ bölüm başlığı eksik.');
    const size=view.getUint32(at+1,true),type=bytes[at],end=at+size+5;
    if(end>bytes.length)throw Error('NCZ bölüm uzunluğu geçersiz.');
    let data=bytes.subarray(at+5,end);
    const name=type===28?decoder.decode(data.subarray(1,8)):'';
    if(type===6){data=data.slice();table=data;}
    // NCZW copies its reference template. Its encrypted legacy styles belong
    // to other layers. Keep only the native, unencrypted per-layer style block.
    if(name!=='LEX.STE'&&name!=='LEX.ST2')records.push({type,data});
    at=end;
  }
  if(!table||table.length<13)throw Error('NCZ tabaka tablosu eksik.');
  const count=new DataView(table.buffer,table.byteOffset,table.byteLength).getUint16(11,true);
  if(table.length!==13+count*29)throw Error('NCZ tabaka tablosu uyumsuz.');
  const rgb=new Uint8Array(19+count*256),v=new DataView(rgb.buffer);
  rgb[0]=7;rgb.set(new TextEncoder().encode('LEX.ST2'),1);v.setUint32(11,100,true);v.setUint32(15,count,true);
  for(let i=0;i<count;i++){
    const p=13+29*i, start=19+256*i, name=decoder.decode(table.subarray(p+5,p+5+table[p+4]));
    const color=colors[name]||maslakPens.find(a=>a[0]===table[p+25])?.slice(1)||[0,0,0];
    if(color.length!==3||!color.every(c=>Number.isInteger(c)&&c>=0&&c<=255))throw Error('NCZ tabaka rengi geçersiz: '+name);
    table[p+25]=maslakNczPen(color);
    // Neutral visible pen settings used in native section files, without a
    // custom line pattern. Dashed profiles are already authored as segments.
    v.setUint32(start+5,100000000,true);
    rgb.set([1,1],start+48);v.setFloat32(start+50,5,true);
    rgb.set([1,...color,0],start+54);rgb[start+59]=1;rgb[start+70]=1;
    if(widths[name]>0){v.setFloat64(start+62,widths[name],true);rgb[start+70]|=16;}
    v.setFloat32(start+75,1,true);v.setFloat64(start+107,1,true);
    rgb.set([128,128,128,0,128],start+116);rgb[start+127]=1;rgb[start+181]=1;
  }
  const posStyles=records.findIndex(r=>r.type===13||r.type===23);
  if(posStyles<0)throw Error('NCZ çizim bölümü eksik.');
  records.splice(posStyles,0,{type:28,data:rgb});
  const out=new Uint8Array(records.reduce((n,r)=>n+r.data.length+5,120)),header=new DataView(out.buffer),offsets={};
  out.set(bytes.subarray(0,120));let pos=120;
  for(const {type,data} of records){offsets[type]??=pos;out[pos]=type;header.setUint32(pos+1,data.length,true);out.set(data,pos+5);pos+=data.length+5;}
  [120,pos,offsets[2],offsets[6],offsets[8],0,0,offsets[11],offsets[12],offsets[14],offsets[13],offsets[23]].forEach((v,i)=>header.setUint32(1+i*4,v||0,true));
  return out;
}
if(typeof module!=='undefined')module.exports=maslakNczColors;
