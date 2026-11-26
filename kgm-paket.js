/* Current project data is rendered into the built-in, blank KGM forms. */
window.KgmPaket = (() => {
 "use strict";
 const {num,coord,line,path,txt,open,bounds,ncz,centre,page,cutSeg} = window.KgmPafta;
 const forms = window.KgmBosFormlar;
 const nextPaint = () => new Promise(resolve => setTimeout(resolve, 0));
 const km = value => {
   if(!Number.isFinite(value)) return '';
   const cents = Math.round(value * 100);
   return Math.floor(cents / 100000) + '+' + num((cents % 100000) / 100).padStart(6, '0');
 };
 function nearestStation(pt, axes) {
   let best = Infinity, result = null;
   for(const axis of axes){
     if(!Number.isFinite(axis.start))continue;
     let distance = axis.start;
     for(let i=1; i<axis.points.length; i++){
       const a=axis.points[i-1], b=axis.points[i], dx=b[0]-a[0], dy=b[1]-a[1];
       const length=Math.hypot(dx,dy);
       if(!length) continue;
       const u=Math.max(0,Math.min(1,((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/(length*length)));
       const off=Math.hypot(pt[0]-a[0]-u*dx,pt[1]-a[1]-u*dy);
       if(off<best){best=off;result=distance+u*length;}
       distance+=length;
     }
   }
   return result;
 }
 function surveyKeys(model,rows,notes){
   const keys=new Map(), names=new Set(model.points.map(p=>p.name)), buckets=new Map();
   const cell=([x,y])=>[Math.floor(x*100),Math.floor(y*100)];
   for(const p of model.points){
     const key=cell([p.e,p.n]).join(',');
     if(!buckets.has(key))buckets.set(key,[]);
     buckets.get(key).push(p);
   }
   let index=1;
   for(const row of rows)for(const ring of [...row.geometry.parents,...row.pieces.flatMap(p=>p.poly)])for(const xy of open(ring)){
     const key=coord(xy);
     if(keys.has(key))continue;
     const [x,y]=cell(xy);
     let match, best=.002;
     for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const p of buckets.get((x+i)+','+(y+j))||[]){
       const dist=Math.hypot(xy[0]-p.e,xy[1]-p.n);
       if(p.name&&dist<best){match=p;best=dist;}
     }
     let n=match?.name;
     if(!n){do{n='K'+String(index++).padStart(3,'0');}while(names.has(n));names.add(n);}
     keys.set(key,{xy,n,mk:'',source:match?'Kaynak çizim':'Hesaplanan köşe'});
   }
   if(index>1)notes.push(['','Yeni köşe numaraları hesapta üretildi. MK değerlerini ölçü dayanağından tamamlayın.']);
   return keys;
 }
 function modelRows(model,refs,options,notes){
   const source=new Map();
   for(const data of refs?.kaps||[])for(const record of data.split(/\r?\n/)){
     const fields=record.split(',').map(x=>x.trim().replaceAll('&#44',','));
     if(fields.length===52)source.set(fields[1].replace('_','/'),fields);
   }
   const books=new Map((refs?.books||[]).map(v=>[v.id,v]));
   const rows=[];
   let index=0;
   for(const row of model.rows){
     if(row.enter<0.00001)continue;
     const primary=source.get(row.id), book=books.get(row.id), place=(row.registerPlace||book?.place||'').split('|');
     const tapu=row.main?.balanced??row.tapuKaydi??null;
     const r={...row,geometry:{parent:row.shape[0][0],parents:row.shape.flat(),parentArea:row.full,enter:row.enter,remain:row.remain},
       order:Number(primary?.[0])||++index, sheet:row.main?.sheet||'', main:{...row.main,balanced:tapu},
       owners:(row.owners||[]).map(o=>({...o,n:o.num,d:o.den})), pieces:[],
       town:row.town||place.at(-1)||'', county:primary?.[44]||(place.length===3?place[1]:''),city:primary?.[45]||(place.length===3?place[0]:'')};
     r.station=(primary?.[47]&&Number.isFinite(+primary[47]))?+primary[47]:nearestStation(r.main.point||centre(row.shape[0]),options.axes);
     r.kind=primary?.[4]||row.main?.kind||'';
     const flags=new Set(row.issues||[]);
     if(!r.owners.length)flags.add('Malik ve hisse kaydı eksik.');
     if(tapu===null)flags.add('Tapu alanı eksik.');
     if(!r.city||!r.county||!r.town)flags.add('İl, ilçe ve mahalle bilgisi eksik.');
     if(!r.sheet)flags.add('Pafta numarası eksik.');
     if(r.station===null)flags.add('Kilometre için eksen ve başlangıç KM veya KAP kilometresi gerekli.');
     const matchedNames=new Set((row.pieces||[]).map(p=>p.name).filter(Boolean));
     const counters={A:0,B:0};
     for(const [inside,polys] of [[true,row.inside],[false,row.outside]])for(const poly of polys){
       const area=options.area([poly]);
       if(area<.00001)continue;
       const saved=(row.pieces||[]).find(x=>x.isIn===inside&&x.shape===poly);
       const suffix=inside?'B':'A';
       let name=saved?.name;
       if(!name){
         do{name=suffix+(++counters[suffix]===1?'':counters[suffix]);}while(matchedNames.has(name));
         matchedNames.add(name);
       }
       const balanced=saved?.paper?.[2]??saved?.ref?.balanced??null;
       r.pieces.push({name,inside,poly,area,ref:{point:saved?.ref?.point,raw:saved?.ref?.raw,balanced}});
     }
     const verified=r.pieces.every(p=>p.ref.balanced!=null) && ![...flags].some(s=>/alan|parça|KAP/i.test(s)) &&
       r.pieces.reduce((n,p)=>n+Math.round(p.ref.balanced*100),0)===Math.round(tapu*100);
     for(const p of r.pieces)p.verified=verified;
     if(tapu!==null&&!verified){
       // Only round a geometric closure to cents. No inferred registry corrections or left/right totals.
       const target=Math.round(tapu*100), matches=Math.round(row.full*100)===target;
       for(const p of r.pieces)p.ref.balanced=null;
       if(matches){
         const fractions=r.pieces.map(p=>({p,floor:Math.floor(p.area*100),fraction:p.area*100%1}));
         const remainder=target-fractions.reduce((n,a)=>n+a.floor,0);
         if(remainder>=0&&remainder<=fractions.length){
           fractions.sort((a,b)=>b.fraction-a.fraction).forEach((a,i)=>{a.p.ref.balanced=(a.floor+(i<remainder?1:0))/100;});
         }
       }
       if(r.pieces.some(p=>p.ref.balanced==null))flags.add('Dengeli parça alanları tapuya kapanmadı. Ölçülen alanlar yazıldı.');
     }
     r.issues=[...flags];
     for(const flag of flags)notes.push([row.id,flag]);
     rows.push(r);
     if(!primary){const cells=Array(52).fill('');Object.assign(cells,{0:r.order,4:r.kind,6:r.sheet,43:r.town,44:r.county,45:r.city});source.set(row.id,cells);}
   }
   if(!rows.length)throw Error('Kamulaştırma sınırına giren parsel bulunamadı.');
   return {rows,source};
 }
 // Row cell edges follow the original KGM register master.
 const registerEdges=[2.4,10.9,18.8,27.8,47.1,68,81.9,95.7,117.1,138.2,161.5,182,201.3,222.7,241.9,261.2,286.4,328.1,354.6,372.4,418.5];
 function rollScenes(model,rows,options,notes){
   const frame='RULO', table='TABLO_CETVEL', ink='TABLO_YAZI_BLACK';
   const tag=(s,x,y,v,h=2.4,w=300)=>txt(s,ink,x,y,v,h,0,w);
   const box=(s,k,x,y,w,h)=>path(s,k,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],true);
   const heading=(name,s)=>{
     const pp=[...new Set(rows.map(r=>[r.city,r.county,r.town].filter(Boolean).join(' / ')).filter(Boolean))];
     tag(s,9,269,'KARAYOLLARI GENEL MÜDÜRLÜĞÜ',3.4);
     tag(s,9,261,name,3.1);
     tag(s,9,254,options.title,2.6);
     tag(s,9,248,pp.join(' · '),2.2,390);
   };
   const scenes=[];
   const boundary=model.border.shape, vertices=boundary.flat(2), origin=vertices[0], extent=bounds(vertices);
   const axis=options.axes[0]?.points, first=axis?.[0], last=axis?.at(-1);
   const a=first&&last&&Math.hypot(last[0]-first[0],last[1]-first[1])>1
     ? Math.atan2(last[1]-first[1],last[0]-first[0])
     : extent[2]-extent[0]>=extent[3]-extent[1]?0:Math.PI/2;
   const co=Math.cos(a),si=Math.sin(a),project=([x,y])=>[(x-origin[0])*co+(y-origin[1])*si,-(x-origin[0])*si+(y-origin[1])*co];
   const [x0,y0,x1,y1]=bounds(vertices.map(project));
   const columns=Math.max(1,Math.ceil((x1-x0)/400)), lines=Math.max(1,Math.ceil((y1-y0)/218));
   if(columns*lines>500)throw Error('Rulo için 1/1000 pafta sayısı 500’ü aşıyor. Koordinat birimini ve sınırın konumunu denetleyin.');
   const projected=m=>m.map(p=>p.map(r=>r.map(project)));
   const clip=window.polygonClipping;
   const projectRows=rows.map(r=>({row:r,shape:projected(r.shape),entered:projected(r.inside)}));
   const publicShapes=model.publics.filter(p=>p.enter>0.00001).map(p=>({...p,entered:projected(p.inside)}));
   const boundaries=projected(boundary), axes=options.axes.map(x=>x.points.map(project));
   for(let j=0;j<lines;j++)for(let i=0;i<columns;i++){
     const xmin=x0-((columns*400)-(x1-x0))/2+i*400, ymin=y0-((lines*218)-(y1-y0))/2+j*218;
     const panel=[[xmin,ymin],[xmin+400,ymin],[xmin+400,ymin+218],[xmin,ymin+218]], local=p=>[p[0]-xmin+10,p[1]-ymin+22];
     if(!clip.intersection(boundaries,[[panel]]).length)continue;
     const s=[],fills=[];
     const stroke=(geom,key,closed=true)=>{
       for(const ring of geom){
         const points=closed?open(ring):ring;
         for(let k=0;k<points.length-(closed?0:1);k++){
           const edge=cutSeg(points[k],points[(k+1)%points.length],panel);
           if(edge)line(s,key,...edge.map(local));
         }
       }
     };
     const fill=(geom,key,name)=>{
       for(const poly of clip.intersection(geom,[[panel]])){
         const rings=poly.map(r=>r.map(local));
         fills.push({key,rings});
         for(const ring of rings)path(s,key,ring,true,name);
       }
     };
     for(const p of publicShapes)fill(p.entered,p.layer,p.name);
     for(const {row,shape,entered} of projectRows){
       fill(entered,'ALN_KAMULAŞTIRMA',row.id.replace('/','_'));
       stroke(shape.flat(),'KAD_HAT');
       const p=project(row.main.point||centre(row.shape[0])), off=model.layout?.labels?.[row.id]||[0,0];
       const xy=local([p[0]+off[0],p[1]-off[1]]);
       if(xy[0]>11&&xy[0]<401&&xy[1]>24&&xy[1]<235)tag(s,xy[0],xy[1],row.id,2.1,11);
     }
     stroke(boundaries.flat(),'KAM_SINIR');
     stroke(axes,'PL_EKSEN',false);
     box(s,frame,5,5,410,272);box(s,frame,10,22,400,218);
     heading('KAMULAŞTIRMA PLANI',s);
     const p=[402,261], q=[p[0]+7*si,p[1]+7*co];
     line(s,'KAD_KUZEY',p,q);tag(s,q[0]+1,q[1]+.8,'K',2.2,4);
     tag(s,10,11,'1/1000 · Plan paftası '+(scenes.length+1),2.2);
     tag(s,123,11,'Kırmızı · Kamulaştırma sınırı',2.2);
     tag(s,224,11,'Turuncu · Kamulaştırılan taşınmaz',2.2);
     tag(s,345,11,'Mavi · Dere',2.2);
     scenes.push({items:s,fills,box:forms.rulo.box});
   }
   if(!scenes.length)throw Error('Kamulaştırma sınırı rulo paftasına yerleşmedi.');
   const records=[];
   const ordered=rows.slice().sort((a,b)=>(a.station??Infinity)-(b.station??Infinity)||a.order-b.order);
   const count=ordered.length+publicShapes.length;
   ordered.forEach((r,i)=>{
     const [ada,parsel]=r.id.split('/');
     const area=x=>x==null?'':num(x);
     const side=letter=>{
       const pieces=r.pieces.filter(p=>!p.inside&&p.verified&&p.name.startsWith(letter));
       return pieces.length?area(pieces.reduce((n,p)=>n+p.ref.balanced,0)):'';
     };
     const values=[r.city,r.town,i+1,km(r.station),r.sheet,ada,parsel,r.kind,'','',
       area(r.main.balanced),area(r.geometry.parentArea),area(r.geometry.enter),side('C'),side('A'),'','','','',''];
     const owners=r.owners.length?r.owners:[{}];
     owners.forEach((o,j)=>{
       const cells=j?Array(registerEdges.length-1).fill(''):values.slice();
       cells[15]=o.father;cells[16]=o.name;cells[17]=o.n?o.n+'/'+o.d:'';
       records.push(cells);
     });
   });
   publicShapes.forEach((p,i)=>{
     const cells=Array(registerEdges.length-1).fill('');cells[2]=ordered.length+i+1;cells[6]=p.name||p.layer;cells[12]=num(p.enter);records.push(cells);
   });
   for(let offset=0;offset<records.length;offset+=42){
     const s=forms.rulo.registerMaster.slice(), chunk=records.slice(offset,offset+42);
     chunk.forEach((row,j)=>{
       const y=236.1-(j+1)*5.2;
       line(s,table,[2.4,y],[418.5,y]);
       row.forEach((v,i)=>tag(s,registerEdges[i]+.7,y+1.35,v,1.9,registerEdges[i+1]-registerEdges[i]-1.5));
     });
     tag(s,4,9,'TOPLAM · '+count+' kayıt · '+num(rows.reduce((n,r)=>n+r.geometry.enter,0))+' m² parselden giren alan',2.3);
     scenes.push({items:s,box:forms.rulo.box});
   }
   if(rows.some(r=>r.pieces.some(p=>!p.inside&&!p.verified)))notes.push(['','KAP’ta doğrulanamayan sağ/sol alanı boş bırakıldı. Toplam kalan alan Excel’de yer alır.']);
   return scenes;
 }
 const paperSize={kroki:[297,210],beyan:[420,297],alan:[210,297],rulo:[420,282]};
 function marker(item){
   const [y,x,Y,X]=item[4],mid=(x+X)/2,dy=Y-y;
   return [[[mid,y],[mid,Y]],[[x,Y-dy*.22],[mid,Y],[X,Y-dy*.22],[mid,Y-dy*.15]]];
 }
 function joinedRoll(pages){
   const strips=[];
   for(let start=0;start<pages.length;start+=10){
     const group=pages.slice(start,start+10), items=[],fills=[];
     group.forEach((page,i)=>{
       const shift=p=>[p[0]+420*i,p[1]];
       for(const shape of page.fills||[])fills.push({...shape,rings:shape.rings.map(r=>r.map(shift))});
       for(const item of page.items){
         const [type,key,pts,...rest]=item;
         items.push([type,key,type==='t'?shift(pts):pts.map(shift),...rest]);
       }
     });
     strips.push({items,fills,box:[0,0,group.length*420,282],size:[group.length*420,282]});
   }
   return strips;
 }
 function printPdf(kind,pages,font){
   const size=pages[0].size||paperSize[kind], orientation=size[0]>size[1]?'landscape':'portrait';
   const doc=new jspdf.jsPDF({orientation,format:size,unit:'mm',compress:true,putOnlyUsedFonts:true});
   doc.addFileToVFS('Kgm.ttf',font);doc.addFont('Kgm.ttf','Kgm','normal');doc.setFont('Kgm');
   pages.forEach((pg,i)=>{
     const size=pg.size||paperSize[kind];
     if(i)doc.addPage(size,orientation);
     const f=forms[kind],b=pg.box||f.box,sc=kind==='rulo'?1:Math.min(1,(size[0]-4)/(b[2]-b[0]),(size[1]-4)/(b[3]-b[1]));
     const x=(size[0]-(b[2]-b[0])*sc)/2-b[0]*sc, y=(size[1]+(b[3]-b[1])*sc)/2+b[1]*sc;
     const to=p=>[x+p[0]*sc,y-p[1]*sc], color=key=>f.rgb[key]||'#171717';
     const draw=(points,closed)=>{doc.moveTo(...to(points[0]));for(const p of points.slice(1))doc.lineTo(...to(p));if(closed)doc.close();};
     for(const {key,rings} of pg.fills||[]){
       doc.setFillColor(color(key));
       for(const ring of rings)draw(ring,true);
       doc.fillEvenOdd();
     }
     for(const item of pg.items){
       const [type,key,p,v,h,angle,,width]=item;
       if(color(key).toLowerCase()==='#ffffff')continue;
       doc.setDrawColor(color(key));doc.setLineWidth(f.plotWidth[key]||.13);
       if(type==='l'||type==='p'){
         if(pg.fills?.length&&type==='p'&&(key.startsWith('ALN_')||key==='KAD_YOL'||key==='KAD_DERE'))continue;
         draw(p,type==='p'&&v);doc.stroke();
       }else if(type==='t'){
         if(!v?.trim())continue;
         doc.setTextColor(color(key));doc.setFontSize(h*sc*72/(25.4*.72));
         const value=v.replace(/\t/g,' '),textWidth=doc.getTextWidth(value);
         doc.text(value,...to(p),{angle:(angle||0)*180/Math.PI,horizontalScale:width&&textWidth?Math.min(1,width*sc/textWidth):1});
       }else if(type==='s'){
         const [stem,tip]=marker(item);draw(stem,false);doc.stroke();draw(tip,true);doc.setFillColor(color(key));doc.fill();
       }
     }
   });
   return new Uint8Array(doc.output('arraybuffer'));
 }
 function dxfDrawing(kind,pages){
   const d=window.O.dxf(), f=forms[kind];
   const aci={'KAM_SINIR':1,'ALN_KAMULAŞTIRMA':30,'KAD_DERE':151,'KAD_YOL':8,'PL_EKSEN':4};
   f.layers.forEach(k=>d.lay(k,aci[k]||7));
   for(const pg of pages){
     const p2=p=>[p[0]+pg.origin[0],p[1]+pg.origin[1]];
     for(const item of pg.items){
       const [t,k,p,v,h,angle]=item;
       if(t==='l')d.line(k,...p.map(p2));
       else if(t==='p')d.poly(k,p.map(p2),v);
       else if(t==='t'&&v?.trim())d.text(k,...p2(p),h,v,(angle||0)*180/Math.PI);
       else if(t==='s'){const [stem,tip]=marker(item);d.line(k,...stem.map(p2));d.poly(k,tip.map(p2),true);}
     }
   }
   const styles=new Map(f.layers.map(k=>[d.lay(k),k]));
   return d.build().replace('AC1009','AC1018').replace(/0\r\nTABLE\r\n2\r\nLAYER[\s\S]+?0\r\nENDTAB/,table=>table.replace(/(0\r\nLAYER\r\n2\r\n)([^\r]+)(\r\n70\r\n0\r\n62\r\n\d+\r\n6\r\n[^\r]+)(\r\n)/g,(all,a,name,b,c)=>{
     const k=styles.get(name), color=f.rgb[k];
     return a+name+b+c+'370\r\n'+Math.round((f.plotWidth[k]||.13)*100)+'\r\n'+(/^#[0-9a-f]{6}$/i.test(color)?'420\r\n'+parseInt(color.slice(1),16)+'\r\n':'');
   }));
 }
 async function create(model,refs,options){
   const notes=[];
   if(model.gapArea>.01)notes.push(['','Sınır içinde parsel veya yol/dere olarak tanımlanmayan '+num(model.gapArea)+' m² alan var.']);
   if(model.overlap>.01)notes.push(['','Geometrilerde '+num(model.overlap)+' m² örtüşme var. Alanları tekrar toplamayın.']);
   if(!options.crs)notes.push(['','Koordinat sistemi girilmedi. Pafta başlığında projeksiyon belirtilmedi.']);
   const {rows,source}=modelRows(model,refs,options,notes), keys=surveyKeys(model,rows,notes);
   const neighbours=rows.map(r=>({nativeName:r.id.replace('/','_'),pts:r.geometry.parent}));
   const sections={beyan:['02_Beyanname','Beyanname'],kroki:['03_Olcu_Krokisi','Olcu_Krokisi'],alan:['04_Alan_Hesabi','Alan_Hesabi_ve_Koordine_Ozet'],rulo:['05_Rulo_Plan','Rulo_Plan']};
   const files=[];
   for(const [kind,[dir,name]] of Object.entries(sections)){
     const f=forms[kind];
     const pages=kind==='rulo'?rollScenes(model,rows,options,notes):rows.map(r=>page(kind,f,r,keys,source,neighbours,undefined,{...options,project:true}));
     const span=f.box[2]-f.box[0]+(kind==='rulo'?0:14);
     pages.forEach((p,i)=>{
       p.origin=[i*span-f.box[0],-f.box[1]];
       if(p.omissions?.length)notes.push([p.id,name+' · Paftada yer bulunmayan etiket: '+[...new Set(p.omissions)].join(', ')]);
     });
     const cad=ncz(f,pages);
     const expected=pages.reduce((n,p)=>n+p.items.filter(i=>i[0]==='t'&&i[3]?.trim()).length,0);
     const decoded=window.K.parseNCZ(cad);
     if(decoded.textList.filter(t=>t.s?.trim()).length!==expected||!(decoded.polys.length||decoded.lines.length))
       throw Error(name+' NCZ geri okuma kontrolünden geçmedi.');
     const stem=dir+'/'+name;
     files.push({name:stem+'.NCZ',data:cad},{name:stem+'.pdf',data:printPdf(kind,kind==='rulo'?joinedRoll(pages):pages,options.font)},{name:stem+'.dxf',data:dxfDrawing(kind,pages)});
     await nextPaint();
   }
   return {files,notes,rows};
 }
 return {create};
})();
