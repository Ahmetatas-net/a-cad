/* KGM NCZ pafta kalemleri, koordinat tabloları ve yerleşim. */
window.KgmPafta=(()=>{
 "use strict";
 const num=(v,n=2)=>Number(v).toFixed(n), coord=p=>p.slice(0,2).map(v=>num(v,5)).join(','), town=s=>s.replace(/\s+(?:M|MAH\.?|MAHALLESİ|KÖYÜ)$/iu,'').trim();
 const b64=s=>Uint8Array.from(atob(s),v=>v.charCodeAt(0));
 const cp=new Map(Array.from(new TextDecoder('windows-1254').decode(Uint8Array.from({length:256},(_,i)=>i)),(s,i)=>[s,i]));
 const enc=s=>Uint8Array.from(String(s),c=>cp.get(c)??63);
 const cell=s=>'"'+String(s??'').replaceAll('"','""')+'"', csv=rows=>'\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
 const line=(s,k,p,q)=>s.push(['l',k,[p,q],false,'']);
 const path=(s,k,p,closed=true,name='')=>{if(p.length>1)s.push(['p',k,p,closed,name]);};
 const txt=(s,k,x,y,val,h=1.5,rot=0,limit=Infinity)=>{
  if(val==null||String(val).trim()==='')return;
  const v=String(val),size=Math.min(h,limit/Math.max(1,v.length*.66));
  s.push(['t',k,[x,y],v,size,rot,-1,size*v.length*.66]);
 };
 const near=(p,q,e=.00001)=>Math.abs(p[0]-q[0])<e&&Math.abs(p[1]-q[1])<e;
 const open=r=>r.filter((p,i)=>!(i&&near(p,r[i-1]))&&!(i===r.length-1&&near(p,r[0])));
 function bounds(P){let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
  for(const [x,y] of P){a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);}return[a,b,c,d];}
 function fit(P,box){const [a,b,c,d]=bounds(P),scale=Math.min((box[2]-box[0])/(c-a||1),(box[3]-box[1])/(d-b||1));
  return p=>[(box[0]+box[2])/2+(p[0]-(a+c)/2)*scale,(box[1]+box[3])/2+(p[1]-(b+d)/2)*scale];}
 function ncz(f,pages){
  const blocks=[b64(f.header)],idx=new Map(f.layers.map((n,i)=>[n,i])),cache=new Map(),alts=f.alt.map(b64);
  const proto=(t,k)=>{const key=t+':'+k;if(!cache.has(key)){const first=f.proto[key]||Object.entries(f.proto).find(([a])=>a.startsWith(t+':'))?.[1];if(!first)throw Error('NCZ nesne stili eksik: '+k);cache.set(key,b64(first));}return cache.get(key);};
  let count=0,extent=[Infinity,Infinity,-Infinity,-Infinity];
  const put=(t,b)=>{const h=new Uint8Array(5);h[0]=t;new DataView(h.buffer).setUint32(1,b.length,true);blocks.push(h,b);};
  if(f.back){const b=b64(f.back);blocks.push(b);const view=new DataView(b.buffer);for(let i=0;i<b.length;i+=5+view.getUint32(i+1,true))if([21,22].includes(b[i])&&b[i+6]!==14)count++;}
  for(const page of pages){
   const [ex,ny]=page.origin,abs=p=>[ex+p[0],ny+p[1]],box=f.box;
   extent=[Math.min(extent[0],ny+box[1]),Math.min(extent[1],ex+box[0]),Math.max(extent[2],ny+box[3]),Math.max(extent[3],ex+box[2])];
   for(const e of page.items){
    const [tag,k,p]=e;const li=idx.get(k);if(li===undefined)throw Error('NCZ tabakası bulunamadı: '+k);
    let data,bb,first;const t={l:2,p:7,t:5,s:6,n:1}[tag];
    if(tag==='s'){data=b64(e[3]);first=abs(p);bb=e[4].map((v,j)=>v+(j%2?ex:ny));}
    else if(tag==='n'){first=abs(p);data=proto(1,k).slice();const nm=enc(e[3]).slice(0,17);data[81]=nm.length;data.set(nm,82);bb=[first[1]-.001,first[0]-.001,first[1]+.001,first[0]+.001];}
    else if(tag==='t'){
     const [h,ang,style,w]=e.slice(4);let chars=enc(e[3]);
     if(chars.length>50){const suffix=chars.slice(50);if(suffix.length>255)throw Error('NCZ yazısı çok uzun.');const meta=new Uint8Array(7+suffix.length);new DataView(meta.buffer).setUint32(0,meta.length,true);meta[4]=5;meta[6]=suffix.length;meta.set(suffix,7);put(33,meta);chars=chars.slice(0,50);}
     data=new Uint8Array(93+chars.length);data.set((e[8]?b64(e[8]):alts[style]||proto(5,k)).subarray(0,93));const d=new DataView(data.buffer);d.setFloat32(81,h,true);d.setFloat32(85,ang,true);data[92]=chars.length;data.set(chars,93);first=abs(p);
     const co=Math.cos(ang),si=Math.sin(ang),[u,v]=first;
     const B=bounds([[u,v],[u+w*co,v+w*si],[u-h*si,v+h*co],[u+w*co-h*si,v+w*si+h*co]]);
     bb=[B[1],B[0],B[3],B[2]];
    }else{
     let pts=p.map(abs);if(tag==='p'&&e[3]&&!near(pts[0],pts.at(-1)))pts.push(pts[0]);
     const B=bounds(pts);bb=[B[1],B[0],B[3],B[2]];first=tag==='l'?pts[0]:[0,0];
     data=new Uint8Array(tag==='l'?101:108+24*pts.length);data.set((e[5]?b64(e[5]):proto(t,k)).subarray(0,tag==='l'?101:108));const d=new DataView(data.buffer);
     if(tag==='l'){d.setFloat64(81,pts[1][1],true);d.setFloat64(89,pts[1][0],true);d.setFloat32(97,0,true);}
     else{const nm=enc(e[4]||'').slice(0,14);data[81]=nm.length;data.set(nm,82);data[96]=(data[96]&254)|(e[3]?1:0);
      pts.forEach(([x,y],i)=>{d.setFloat64(108+i*24,y,true);d.setFloat64(116+i*24,x,true);});}
    }
    const d=new DataView(data.buffer);data[0]=data[1]=t;data[2]=data[30]=li;d.setFloat64(3,first[1],true);d.setFloat64(11,first[0],true);bb.forEach((v,i)=>d.setFloat64(45+i*8,v,true));put(21,data);count++;
   }
  }
  const end=new Uint8Array(81);end[0]=end[1]=14;put(21,end);
  const size=blocks.reduce((a,b)=>a+b.length,0),out=new Uint8Array(size);let at=0;for(const b of blocks){out.set(b,at);at+=b.length;}
  const v=new DataView(out.buffer);v.setUint32(5,size,true);v.setUint32(81,count,true);extent.forEach((x,i)=>v.setFloat64(49+8*i,x,true));return out;
 }
 function coordTable(scene,x,y,pts,span=2.5){
  const cols=[0,14,27,41,49.875],width=99.75,rows=Math.ceil(pts.length/2),end=y-6.25-rows*span;
  for(const [i,off] of [[0,0],[1,49.875]])for(let j=0;j<4;j++){
   line(scene,'DE_C',[x+off+cols[j],y],[x+off+cols[j],end]);
   txt(scene,'DE_M',x+off+[3,20.8,35,44.5][j],y-3.75,['NoktaNo','Y','X','MK'][j]);
  }
  line(scene,'DE_C',[x+width,y],[x+width,end]);
  for(const yy of [y,y-5,...Array.from({length:rows},(_,i)=>y-6.25-(i+1)*span)])line(scene,'DE_C',[x,yy],[x+width,yy]);
  pts.forEach((p,i)=>{const xx=x+(i%2)*49.875,yy=y-6.25-span*.94-Math.floor(i/2)*span;
   [p.n,num(p.xy[0]),num(p.xy[1]),p.mk].forEach((v,j)=>txt(scene,'DE_R',xx+[.6,17.22,30.28,43.3][j],yy,v,Math.min(1.5,span*.62),0,[13,10,12,5.7][j]));});
  return end;
 }
 function groupNames(parts,max=23){const lines=[];let cur='';
  for(const n of parts){if(cur&&cur.length+1+n.length>max){lines.push(cur+',');cur=n;}else cur+=(cur?',':'')+n;}
  if(cur)lines.push(cur);return lines;
 }
 function areaTable(s,x,y,r,keys,low,tolerance){
  const rows=[{name:r.id.replace('/','_'),rings:r.geometry.parents||[r.geometry.parent],area:r.geometry.parentArea,bal:r.main.balanced},...r.pieces.map(p=>({name:r.id.replace('/','_')+'/'+p.name,rings:p.poly,area:p.area,bal:p.ref?.balanced}))];
  const data=rows.map(a=>({...a,lines:a.rings.flatMap(ring=>groupNames(open(ring).map(p=>keys.get(coord(p)).n)))}));
  const units=4+data.reduce((n,a)=>n+a.lines.length,0)+7,step=Math.min(2.5,(y-low)/units),h=Math.min(1.5,step*.62);
  const xc=[0,15.44,44.3,59.5,71.3,84.32],pen='DE_C',str=(a,b,v,w,lay='DE_R')=>txt(s,lay,x+a,b,v,h,0,w);
  let yy=y; const horizontal=()=>line(s,pen,[x,yy],[x+84.32,yy]);
  horizontal();yy-=step*1.5;
  ['Ada/Parsel','Noktalar','HesapAlan','Düzeltme','Deng.Alan'].forEach((v,i)=>str(xc[i]+.6,yy,v,xc[i+1]-xc[i]-1,'DE_M'));
  yy-=step;horizontal();const start=yy;let sum=0,balanced=0;
  for(const a of data){yy-=step;str(.6,yy,a.name,14.3);a.lines.forEach((v,i)=>str(16,yy-i*step,v,27));
   str(44.9,yy,num(a.area),13.7);if(a.bal!=null){const corr=Math.round(a.bal*100)-Math.round(a.area*100);str(60.1,yy,(corr>=0?'+':'')+num(corr/100),10.4);str(71.9,yy,num(a.bal),11.5);}
   if(a!==data[0]){sum+=a.area;balanced+=a.bal??0;}yy-=step*(a.lines.length-1);yy-=step*.38;horizontal();}
  yy-=step;str(29,yy,'TOPLAM',14,'DE_M');str(44.9,yy,num(sum),13.8);if(data.slice(1).every(a=>a.bal!=null)){str(60.1,yy,(balanced>=sum?'+':'')+num(balanced-sum),10.4);str(71.9,yy,num(balanced),11.4);}yy-=step*.5;horizontal();
  for(const c of xc)line(s,pen,[x+c,y],[x+c,yy]);
  for(const [label,val] of [['TAPU ALANI',r.main.balanced==null?'':num(r.main.balanced)],['HESAPLANAN',num(r.geometry.parentArea)],['FARK',r.main.balanced==null?'':num(r.main.balanced-r.geometry.parentArea)],['Yanılma',tolerance??'']]){yy-=step;str(.6,yy,label,23,'DE_M');str(34.5,yy,val,10);}
 }
 function inside(p,r){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
 function centre(rings,seed){const r=open(rings[0]),valid=p=>inside(p,r)&&!rings.slice(1).some(h=>inside(p,h));if(seed&&valid(seed))return seed;
  const B=bounds(r);let best=r[0],bestD=-1;
  for(let i=0;i<17;i++)for(let j=0;j<17;j++){const p=[B[0]+(i+.5)/17*(B[2]-B[0]),B[1]+(j+.5)/17*(B[3]-B[1])];if(!valid(p))continue;
   let score=Infinity;for(let k=0;k<r.length;k++){const a=r[k],b=r[(k+1)%r.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.min(1,Math.max(0,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));score=Math.min(score,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}if(score>bestD){bestD=score;best=p;}
  }return best;
 }
 function sketch(s,r,keys,box,neighbours,frame,omissions=null){
  const project=frame?p=>[(p[0]-frame[0])*frame[2]-(p[1]-frame[1])*frame[3]+frame[4],(p[0]-frame[0])*frame[3]+(p[1]-frame[1])*frame[2]+frame[5]]:fit((r.geometry.parents||[r.geometry.parent]).flat(),[box[0]+7,box[1]+5,box[2]-9,box[3]-5]),seen=new Set(),labels=[];
  const overlap=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
  // Reserve the original template's symbol footprints and printed text, in its own axes.
  for(const item of s){
   const [tag,,p,value,h,angle]=item;
   if(tag==='s'&&Array.isArray(h)&&h.every(Number.isFinite)){
    const [south,west,north,east]=h;labels.push([west-1,south-1,east+1,north+1]);
   }else if(tag==='t'){
    const co=Math.cos(angle||0),si=Math.sin(angle||0),w=item[7]||String(value).length*h*.66;
    const b=bounds([[0,0],[w*co,w*si],[-h*si,h*co],[w*co-h*si,w*si+h*co]].map(([x,y])=>[p[0]+x,p[1]+y]));
    labels.push([b[0]-.6,b[1]-.6,b[2]+.6,b[3]+.6]);
   }
  }
  const label=(lay,px,py,v,h,ang=0)=>{
   const w=Math.max(1.5,v.length*h*.64),co=Math.cos(ang),si=Math.sin(ang);
   for(const [dx,dy] of [[1,1],[1,-h-1],[-w-1,1],[-w-1,-h-1],[1,3*h],[-w-1,3*h],[1,-3*h],[-w-1,-3*h]]){
    const x=px+dx,y=py+dy,b=bounds([[x,y],[x+w*co,y+w*si],[x-h*si,y+h*co],[x+w*co-h*si,y+w*si+h*co]]);
    if(b[0]<box[0]||b[1]<box[1]||b[2]>box[2]||b[3]>box[3]||labels.some(a=>overlap(a,b)))continue;
    txt(s,lay,x,y,v,h,ang);labels.push([b[0]-.2,b[1]-.2,b[2]+.2,b[3]+.2]);return true;
   }if(omissions)omissions.push(v);return false;
  };
  const clipbox=[[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]];
  for(const other of neighbours){if(!other.nativeName||other.nativeName.replace('_','/')===r.id)continue;const pp=open(other.pts).map(project),B=bounds(pp);if(!overlap(B,box))continue;
   let count=0;for(let j=0;j<pp.length;j++){const seg=cutSeg(pp[j],pp[(j+1)%pp.length],clipbox);if(seg){line(s,'KAD_HAT',...seg);count++;}}
   if(count){const c=project(centre([other.pts]));if(c[0]>box[0]+4&&c[0]<box[2]-4&&c[1]>box[1]+3&&c[1]<box[3]-3)label('PAD',...c,other.nativeName.split('_').at(-1),1.55);}
  }
  for(const ring of r.geometry.parents||[r.geometry.parent])path(s,'KAD_ALN',open(ring).map(project),true,r.id.replace('/','_'));
  for(const p of r.pieces){for(const ring of p.poly)path(s,'KAD_'+p.name.charAt(0),open(ring).map(project),true,r.id.replace('/','_')+'/'+p.name);}
  const cn=project(centre([r.geometry.parent],r.main.point));label('AD',...cn,r.id,2.25);
  for(const p of r.pieces){const q=project(centre(p.poly,p.ref?.point));label('AD',...q,p.name,2.35);}
  const unique=new Map();for(const p of r.pieces)for(const ring of p.poly)for(const q of open(ring))unique.set(coord(q),q);
  for(const [key,pt] of unique){const q=project(pt),n=keys.get(key);s.push(['n',n.n.startsWith('ST')?'KAD_ST':'KAD_NOKTA',q,n.n]);const circle=Array.from({length:9},(_,i)=>[q[0]+.24*Math.cos(i*Math.PI/4),q[1]+.24*Math.sin(i*Math.PI/4)]);path(s,'KAD_NOKTA',circle);label('NOKTANO',...q,n.n,1.4);}
  for(const p of r.pieces)for(const ring of p.poly){const q=open(ring);for(let i=0;i<q.length;i++){
   const a=q[i],b=q[(i+1)%q.length],id=[coord(a),coord(b)].sort().join(';');if(seen.has(id))continue;seen.add(id);
   const m=project(a),n=project(b);if(Math.hypot(n[0]-m[0],n[1]-m[1])<4)continue;
   let rot=Math.atan2(n[1]-m[1],n[0]-m[0]);if(rot>Math.PI/2)rot-=Math.PI;if(rot< -Math.PI/2)rot+=Math.PI;
   label('ROL_CEPHE',(m[0]+n[0])/2,(m[1]+n[1])/2,num(Math.hypot(b[0]-a[0],b[1]-a[1])),1.28,rot);
  }}
 }
 function page(kind,f,r,keys,rows,base,tol,options={}){
  const s=f.static.slice(),id=r.id.split('/'),rr=rows.get(r.id),city=rr[45],county=rr[44],mah=rr[43];
  const omissions=[];
  if(options.project){
   for(let i=0;i<s.length;i++){
    const item=s[i];if(item[0]!=='t')continue;
    if(kind==='kroki'&&item[3]==='ÖLÇÜ KROKİSİ'){
     const title=id[0]+' ADA ÖLÇÜ KROKİSİ',w=title.length*item[4]*.48;
     s[i]=[...item.slice(0,2),[item[2][0]+(item[7]-w)/2,item[2][1]],title,...item.slice(4,7),w,...item.slice(8)];
    }
    if(/ITRF|Projeksiyon/.test(item[3])&&/^(Datum|Projeksiyon|KOORDİNATLAR)/.test(item[3])){
     s[i]=[...item.slice(0,3),item[3].startsWith('Projeksiyon')?options.crs:'',...item.slice(4)];
     if(options.crs&&item[3].startsWith('Projeksiyon'))s[i][7]=Math.max(s[i][7],38);
    }
   }
  }
  const layout=f.layout?.[r.id]||{};const local=new Map();for(const ring of [...(r.geometry.parents||[r.geometry.parent]),...r.pieces.flatMap(p=>p.poly)])for(const q of open(ring)){const k=coord(q);local.set(k,keys.get(k));}
  const pts=[...local.values()].sort((a,b)=>a.n.localeCompare(b.n,'tr',{numeric:true}));
  if(kind==='kroki'){
   for(const [x,y,z] of [[-80.14,-155.14,city],[-80.44,-161.12,county],[-80.22,-169.7,mah],[-81.39,-183.78,r.id]])txt(s,'KROKI_CEVAP',x,y,z,2.2,0,24);
   txt(s,'BEYAN_ROL_CEVAP',-79.27,-177.98,r.sheet,2.5,0,26);
   if(!options.project||options.crs)txt(s,'BEYAN_YAZI',50,-59,options.project?options.crs:'KOORDİNATLAR ITRF 33-3 KOORDİNAT SİSTEMİNDEDİR.',1.5);
   coordTable(s,...(layout.coords||[46.09,-62.65]),pts,options.project?Math.min(2.5,110/Math.ceil(pts.length/2)):2.5);sketch(s,r,keys,[-101,-142,Math.max(42,(layout.coords?.[0]||46)-2),-8],base,layout.map,options.project?omissions:null);
  }else if(kind==='alan'){
   [[-54.89,city],[3.85,county],[83.65,mah]].forEach(([x,z])=>txt(s,'ALAN_CEVAP',x,12.07,z,2.6));
   const bottom=coordTable(s,...(layout.coords||[-18.63,-75.94]),pts,options.project?Math.min(2.5,105/Math.ceil(pts.length/2)):2.5);const az=layout.areas||[-6.36,bottom-5.91];areaTable(s,az[0],Math.min(az[1],bottom-2.5),r,keys,-230,tol);
  }else{
   [[-270.29,city],[-231.99,county],[-180.64,mah],[-127.46,rr[5]]].forEach(([x,v])=>txt(s,'BEYAN_CEVAP',x,-36.02,v,2.6,0,32));
   txt(s,'KURUM_NO',-107.12,-14.1,rr[0],2.6);
   const name=r.owners.length?r.owners[0].name+(r.owners.length>1?' ve Müşt.':''):'';
   const items=[['',r.main.balanced,rr],...r.pieces.map(p=>[p.name,p.ref?.balanced??p.area,rows.get(r.id+'/'+p.name)])];
   items.forEach(([part,a,k],i)=>{const y=-68.41-i*(options.project?Math.min(8.18,29/Math.max(1,items.length-1)):8.18),cents=Math.round(a*100),m=Math.floor(cents/100);
    const values=[i?'':rr[15],r.sheet,id[0],part||id[1],a==null?'':(Math.floor(m/10000)||' - '),a==null?'':m%10000,a==null?'':String(cents%100).padStart(2,'0'),k?.[4]||rr[4],name,k?.[27]||''];
    const xs=[-282.73,-270.97,-255.2,-242.65,-226.85,-218.51,-207.23,-201.11,-179.25,-137.6],limits=[10,15.1,12,12,7,10.4,5.5,20,40,48];
    values.forEach((v,j)=>txt(s,'BEYAN_CEVAP',xs[j],y,v,2.5,0,limits[j]));});
   sketch(s,r,keys,[-77,-165,104,-11],base,layout.map,options.project?omissions:null);
   coordTable(s,...(layout.coords||[-80.1,-182.35]),pts,Math.min(2.5,38/Math.ceil(pts.length/2)));areaTable(s,...(layout.areas||[21.74,-181.98]),r,keys,-228,tol);
  }return {id:r.id,town:mah,items:s,omissions};
 }
 function cutSeg(p,q,poly){let lo=0,hi=1;const dx=q[0]-p[0],dy=q[1]-p[1];for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],ex=b[0]-a[0],ey=b[1]-a[1],v=ex*(p[1]-a[1])-ey*(p[0]-a[0]),d=ex*dy-ey*dx;
  if(Math.abs(d)<1e-10){if(v< -1e-7)return null;continue;}
  const t=-v/d;if(d>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>=hi-1e-10)return null;
 }return [[p[0]+lo*dx,p[1]+lo*dy],[p[0]+hi*dx,p[1]+hi*dy]];}
 return {num,coord,town,b64,csv,line,path,txt,near,open,bounds,ncz,centre,page,cutSeg};
})();
