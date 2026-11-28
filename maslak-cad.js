'use strict';
const maslakBolumBoyu=19;
function maslakImalatKesiti(row){return row.area.some(n=>n>=.005);}
function maslakPdfAdi(job,part=0){
  const clean=value=>String(value??'').replace(/[\x00-\x1f<>:"/\\|?*]/g,'-').trim();
  const road=clean(job.owners[0]||'Yol').toLocaleUpperCase('tr-TR');
  const parcel=clean(job.owners[1]||'Parsel');
  const period=clean(job.project.no).replace(/^0+(?=\d+$)/,'');
  return road+(period?'-HKDS-'+period:'')+' -'+parcel+' Enkesitleri'+(part?' - Bölüm '+part:'')+'.pdf';
}
// Very narrow, tall cut remnants can obscure the road boundary at print scale.
function maslakParselCizimAraliklari(parts){
  const hidden=new Set();
  let run=[];
  function close(){
    if(!run.length)return;
    const width=run.at(-1)[1]-run[0][0];
    const height=Math.max(...run.map(q=>Math.max(q[2]-q[4],q[3]-q[5])));
    if(width<=.15 && height>=2 && height/width>=12)run.forEach(q=>hidden.add(q));
    run=[];
  }
  for(const q of parts){
    const prev=run.at(-1);
    if(prev && (Math.abs(prev[1]-q[0])>1e-6 || Math.abs(prev[3]-q[2])>1e-5 || Math.abs(prev[5]-q[4])>1e-5))close();
    if(q[2]+q[3]>q[4]+q[5]+1e-8)run.push(q);
    else close();
  }
  close();
  return hidden;
}
function maslakPaftalar(job,calc,part=0,standard=false){
  const pages=[],km=n=>Math.floor(n/1000)+'+'+(n%1000).toFixed(2).padStart(6,'0').replace('.',','),f=(n,d=2)=>n.toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d});
  let pageNo=0;
  for(const [i,st] of job.stations.entries()){
    if(!job.terrain && !maslakImalatKesiti(calc.rows[i]))continue;
    pageNo++;
    if(part && Math.ceil(pageNo/maslakBolumBoyu)!==part)continue;
    const shapes=[],line=(l,p,w=.2)=>shapes.push({l,p,w});
    const text=(x,y,s,size=2.5,al='l',bold=false,rot=0,l='YAZI')=>shapes.push({l,x,y,s:String(s),size,al,bold,rot});
    const frame=(x,y,X,Y)=>line('PAFTA',[[x,y],[X,y],[X,Y],[x,Y],[x,y]],.15);
    const hidden=maslakParselCizimAraliklari(st.earth[1]);
    const visible=[st.earth[0],st.earth[1].filter(q=>!hidden.has(q))];
    const tops=new Map((st.profiles||[]).map(q=>[q[0],q]));
    const upper=visible.map(parts=>parts.filter(([l,r,a,b,c,d])=>{
      if(Math.abs(a-c)+Math.abs(b-d)<1e-8)return false;
      const q=tops.get(l);
      return !st.profiles || (q&&Math.abs(q[1]-r)<1e-7&&Math.abs(c-q[4])+Math.abs(d-q[5])<1e-6);
    }));
    const roofSets=upper.map(rows=>new Set(rows));
    const xs=[0],zs=[];
    if(job.terrain){
      for(const {segments} of st.displayProfiles)for(const [l,r,a,b] of segments){xs.push(l,r);zs.push(a,b);}
    }else{
      for(const [l,r,a,b,c,d] of visible.flat()){xs.push(l,r);zs.push(a,b,c,d);}
      for(const [l,r,a,b,c,d] of st.strip.flat()){xs.push(l,r);zs.push(a,b,c,d);}
    }
    if(!zs.length)continue;
    const rowH=job.terrain?10.4:8.55;
    const tableTop=job.terrain ? Math.max(82.7, 33+(st.displayProfiles.length+1)*rowH) : 82.7;
    const legendRows=job.terrain ? Math.max(1,Math.ceil(st.displayProfiles.length/4)) : 1;
    const plotLimit=148.5-(legendRows-1)*4.2;
    const minWidth=job.terrain ? 42 : 29;
    const extent=values=>values.reduce(([a,b],z)=>[Math.min(a,z),Math.max(b,z)],[Infinity,-Infinity]);
    const [lo,hi]=extent(xs),[bot,top]=extent(zs);
    const paperSizes=[['A4',297,210],['A3',420,297],['A2',594,420],['A1',841,594],['A0',1189,841]];
    const needW=(hi-lo+.85)*1000/150+minWidth,needH=(top-bot+.45)*1000/150+210-plotLimit+tableTop+2.8;
    const paper=standard?(paperSizes.find(([,w,h])=>w>=needW&&h>=needH)||
      ['Özel',Math.ceil(needW/10)*10,Math.ceil(needH/10)*10]):paperSizes[job.paper==='a3'?1:0];
    const [paperName,W,H]=paper;
    if(W>5000||H>5000)throw Error('Kesit 1/150 için PDF kâğıt sınırını aşıyor: '+km(st.km));
    const shift=H-210, plotBottom=tableTop+2.8, plotTop=Math.max(plotBottom+20,plotLimit+shift);
    const denom=(d,mm)=>Math.max(150,Math.ceil(d*1000/mm/5)*5);
    const fit=Math.max(1000,denom(hi-lo+.85,W-minWidth),denom(top-bot+.45,plotTop-plotBottom));
    const dx=standard?150:job.terrain?fit:denom(hi-lo+.85,W-minWidth);
    const dy=standard?150:job.terrain?fit:denom(top-bot+.45,plotTop-plotBottom);
    const leftEdge=job.terrain ? 32 : 18;
    const X=o=>(W+leftEdge-9)/2+(o-(lo+hi)/2)*1000/dx;
    const Y=z=>(plotTop+plotBottom)/2+(z-(top+bot)/2)*1000/dy;
    frame(6,174+shift,W-6,204+shift);text(W/2,201+shift,'ENKESİT',3.4,'c',true);
    const project=job.project, cut=W-80;
    const leftFields=[['İŞİN ADI',project.is],['İŞVEREN',project.isveren],['MÜTEAHHİT',project.muteahhit],
      ['HAKEDİŞ',[project.no,project.tarih].filter(Boolean).join('    /    ')]];
    const rightFields=[['YOL NO',job.owners[0]],['ADA / PARSEL',job.owners[1]],
      ['YOL POZU',[project.pozYK,project.pozYD].filter(Boolean).join(' · ')],
      ['PARSEL POZU',[project.pozK,project.pozD].filter(Boolean).join(' · ')]];
    line('PAFTA',[[cut,174+shift],[cut,198.5+shift]],.15);
    line('PAFTA',[[cut+27,174+shift],[cut+27,198.5+shift]],.15);
    for(const [n,[name,value]] of leftFields.entries()){
      const y=196+shift-5.5*n;
      line('PAFTA',[[6,y+2.5],[W-6,y+2.5]],.15);
      text(8,y,name,1.85);text(38,y,value||'',Math.min(2,(cut-41)/Math.max(1,String(value||'').length*.63)));
      const [rightName,rightValue]=rightFields[n];
      text(cut+2,y,rightName,1.82);text(cut+29,y,rightValue||'',Math.min(2,43/Math.max(1,String(rightValue||'').length*.62)));
    }
    const title = job.terrain ? job.title : job.owners.join(' VE ')+' BİRLEŞİK ENKESİTİ';
    text(7,169+shift,'KM '+km(st.km),3.2,'l',true);
    text(W/2,169+shift,title,job.terrain?Math.min(2.8,(W-110)/Math.max(1,title.length*.6)):2.8,'c',true);
    text(W-7,161+shift,paperName+'   Yatay 1/'+dx+'   Düşey 1/'+dy,2,'r');
    const fills = job.terrain
      ? [['Kazı','T_KAZI'],['Dolgu','T_DOLGU'],['Sıyırma','T_SIYIRMA']].filter(([,layer])=>st.regions.some(q=>q.l===layer))
      : [[job.owners[0],'T_YOL'],[job.owners[1],'T_GB'],['Sıyırma','T_SIYIRMA']];
    for(const [j,[name,layer]] of fills.entries()){
      const x=8+62*j,y=159+shift;shapes.push({l:layer,p:[[x,y],[x+5,y],[x+5,y+3],[x,y+3]],fill:true,legend:true});text(x+7,y+1.5,name,2.1);
    }
    const lines = job.terrain
      ? st.displayProfiles.map(({name,layer})=>[name,layer])
      : [['Yol siyah kot','YOL_SIYAH'],['Parsel siyah kot','GB_SIYAH'],['Yol kırmızı kot','YOL_KIRMIZI'],['Parsel kırmızı kot','GB_KIRMIZI'],['Sıyırma tabanı','SIYIRMA_TABANI']];
    for(const [j,[name,layer]] of lines.entries()){
      const x=8+(job.terrain ? j%4*(W-18)/4 : j*(W-18)/5);
      const y=155+shift-(job.terrain ? Math.floor(j/4)*4.2 : 0);
      if(layer.startsWith('GB_'))dash(layer,[x,y],[x+7,y],layer==='GB_KIRMIZI'?.7:1.5);
      else line(layer,[[x,y],[x+7,y]],.22);
      text(x+9,y,name,job.terrain ? Math.min(2.05,(W/4-13)/Math.max(1,name.length*.62)) : 2.05,'l',!job.terrain&&j===1);
      if(!job.terrain&&j===1)text(x+9,y-3.25,'(Yol Proje çizgisi)',1.93);
    }
    frame(leftEdge,plotBottom,W-9,plotTop);
    text(7.5,plotTop+1.5,'Kot (m)',1.95);
    const tickStep=job.terrain ? Math.max(2,Math.ceil((top-bot)/12)) : dy<=200?2:Math.ceil(dy/100);
    for(let z=Math.ceil(bot/tickStep)*tickStep;z<=top;z+=tickStep){
      line('PAFTA',[[leftEdge,Y(z)],[W-9,Y(z)]],.07);
      text(leftEdge-2,Y(z),f(z,2).replace(/\./g,''),1.93,'r');
    }
    const bands = job.terrain
      ? [['Ofset (m)','YAZI'],...st.displayProfiles.map(({name,layer})=>[name,layer])]
      : [['Ofset (m)','YAZI'],['Yol siyah kot','YAZI'],['Parsel siyah kot','YAZI'],['Yol kırmızı kot','YOL_KIRMIZI'],['Parsel kırmızı kot','GB_KIRMIZI'],['Yol sıyırma tabanı','SIYIRMA_TABANI'],['Parsel sıyırma tabanı','SIYIRMA_TABANI']];
    const tableBottom=tableTop-bands.length*rowH, firstLabel=job.terrain?39:28;
    const columns=job.terrain ? st.displayProfiles.map(p=>p.segments) : [visible[0],visible[1],upper[0],upper[1],...st.strip].map((list,i)=>
      list.map(q=>[q[0],q[1],q[i<2||i>=4?2:4],q[i<2||i>=4?3:5]]));
    const labels=MaslakKirik.choose(columns,X,firstLabel,W-10,job.measureStep,st.displayProfiles);
    const labelsX=MaslakKirik.positions(labels.map(x=>x.anchor),firstLabel,W-10);
    function dash(layer,a,b,stroke=1.5,gap=.8){
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<1e-8)return;
      const pos=t=>a.map((v,j)=>v+(b[j]-v)*t/len);
      for(let t=0;t<len;t+=stroke+gap)line(layer,[pos(t),pos(Math.min(len,t+stroke))],.27);
    }
    function regions(parts,layer){
      let lower=[],upper=[],sign=0;
      function close(){
        if(lower.length){shapes.push({l:layer,fill:true,p:lower.concat(upper.reverse())});lower=[];upper=[];}
      }
      for(const [l,r,a,b,c,d] of parts){
        const dir=Math.sign((c-a)+(d-b));
        if(!dir){close();continue;}
        const bl=[X(l),Y(a)],tl=[X(l),Y(c)];
        if(lower.length&&(sign!==dir||Math.hypot(lower.at(-1)[0]-bl[0],lower.at(-1)[1]-bl[1])>.00001||Math.hypot(upper.at(-1)[0]-tl[0],upper.at(-1)[1]-tl[1])>.00001))close();
        if(!lower.length){lower.push(bl);upper.push(tl);}
        lower.push([X(r),Y(b)]);upper.push([X(r),Y(d)]);sign=dir;
      }
      close();
    }
    if (job.terrain) {
      for (const region of st.regions) shapes.push({...region,fill:true,p:region.p.map(([x,y])=>[X(x),Y(y)])});
    } else {
      regions(visible[0],'T_YOL');
      regions(visible[1],'T_GB');
    }
    for(const group of st.strip){
      if (!job.terrain) regions(group,'T_SIYIRMA');
      for(const [l,r,a,b] of group)line('SIYIRMA_TABANI',[[X(l),Y(a)],[X(r),Y(b)]]);
    }
    const profilesStart=shapes.length, guides=[];
    for(const [owner,parts] of st.earth.entries()){
      let last=null;
      for(const [index,[l,r,a,b,c,d]] of parts.entries()){
        const bottom=[[X(l),Y(a)],[X(r),Y(b)]], roof=[[X(l),Y(c)],[X(r),Y(d)]];
        if(!owner)line('YOL_SIYAH',bottom,.32);
        else if(hidden.has(parts[index]))last=null;
        else{
          if(last&&Math.abs(last[0]-l)<1e-6&&Math.abs(last[1]-a)>1e-5)line('GB_SIYAH',[[X(l),Y(last[1])],bottom[0]]);
          dash('GB_SIYAH',...bottom);last=[r,b];
        }
        if(Math.abs(a-c)+Math.abs(b-d)<1e-8)continue;
        if(job.terrain || roofSets[owner].has(parts[index])){
          if(owner)dash('GB_KIRMIZI',...roof,.7,.45);else line('YOL_KIRMIZI',roof,.27);
        }
      }
    }
    if(job.terrain)for(const {layer,segments} of st.displayProfiles)for(const [l,r,a,b] of segments)
      line(layer,[[X(l),Y(a)],[X(r),Y(b)]],layer==='YOL_SIYAH'?.32:.27);
    dash('EKSEN',[X(0),plotBottom],[X(0),plotTop],1.9,1);
    const axisY=X(0)>(W-18)/5+16&&X(0)<(W-18)/5+60?plotTop-3:plotTop+1.3;
    text(X(0),axisY,'Eksen',2,'c',true);
    bands.forEach(([name,layer],j)=>{
      const y=tableTop-rowH*j;line('PAFTA',[[7,y],[W-7,y]],.12);
      if(name.length>15&&labelsX[0]<36){
        const split=name.lastIndexOf(' ');text(8,y-2.4,name.slice(0,split),1.95,'l',false,0,layer);text(8,y-5.2,name.slice(split+1),1.95,'l',false,0,layer);
      }else text(8,y-3.6,name,job.terrain?Math.min(2,46/Math.max(1,name.length)):2,'l',false,0,layer);
    });
    line('PAFTA',[[7,tableTop],[7,tableBottom],[W-7,tableBottom],[W-7,tableTop]],.12);
    labels.forEach((q,i)=>{
      const x=labelsX[i], anchor=q.anchor, start=[anchor,Y(q.guideTop)];
      const path=Math.abs(anchor-x)<.001?[start,[x,tableBottom]]:[start,[anchor,plotBottom],[x,tableTop],[x,tableBottom]];
      guides.push({l:'OFSET',p:path,w:.105});
      [q.x,...q.values].forEach((z,j)=>{
        const ofset=j===0;
        if(z===null || job.terrain && (ofset ? st.showOffset===false : st.showKot===false))return;
        const value=f(Math.abs(z)<.000005?0:z,ofset?2:st.digits||3).replace(/\./g,'');
        const baseline=ofset?(value.length>6?.85:1.2):.23;
        text(x+(job.terrain?1.15:.26),tableTop-rowH*(j+1)+baseline,value,MaslakKirik.minText,'l',false,90,bands[j][1]);
      });
    });
    shapes.splice(profilesStart,0,...guides);
    text(8,job.terrain?tableBottom-3.5:20,'Eksen   Y '+f(st.center[0],3)+' m     X '+f(st.center[1],3)+' m',2);
    if (job.terrain) {
      frame(7,4,W-7,23);
      const labels = ['ADI SOYADI','TARİH','İMZA'];
      const w=(W-36)/3;
      for (let i=0;i<4;i++) line('PAFTA',[[7,4+i*4.7],[W-7,4+i*4.7]],.13);
      for (let i=0;i<3;i++) {
        const x=29+i*w, mid=x+w/2;
        line('PAFTA',[[x,4],[x,23]],.13);
        text(mid,20.75,['MÜTEAHHİT','HARİTA MÜHENDİSİ','KONTROL MÜHENDİSİ'][i],2.05,'c',true);
        text(mid,16.1,project['s'+(i+1)]||'',2,'c');
        text(mid,11.4,project.tarih||'',1.95,'c');
        text(8,16.1-i*4.7,labels[i],1.9,'l',false);
      }
      pages.push({shapes,dx,dy,W,H,km:st.km,plot:[leftEdge,plotBottom,W-9,plotTop]});
      continue;
    }
    frame(7,4,W-7,17);for(const [j,v] of ['MÜTEAHHİT','HARİTA MÜHENDİSİ','KONTROL MÜHENDİSİ'].entries()){
      const x=7+(W-14)*(j+.5)/3;
      if(j)line('PAFTA',[[7+(W-14)*j/3,4],[7+(W-14)*j/3,17]],.12);
      text(x,15,v,2.05,'c',true);text(x,11.4,job.project['s'+(j+1)]||'',2,'c');text(x,7.9,job.project.tarih||'',1.95,'c');
    }
    pages.push({shapes,dx,dy,W,H,km:st.km});
  }
  return pages;
}
// Build font-independent DXF solids from the embedded outlines. Even-odd pairs retain glyph counters.
function maslakGlyphs(rings,owner,handle){
  const edges=[],out=[];
  for(const ring of rings)ring.forEach((a,j)=>{const b=ring[(j+1)%ring.length];if(a[1]!==b[1])edges.push([a,b]);});
  const ys=[...new Set(edges.flatMap(e=>e.map(p=>p[1])))].sort((a,b)=>a-b);
  const x=([a,b],y)=>a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]);
  for(let i=1;i<ys.length;i++){
    const lo=ys[i-1],hi=ys[i],mid=(lo+hi)/2;
    const active=edges.filter(([a,b])=>(a[1]<mid)!==(b[1]<mid)).sort((a,b)=>x(a,mid)-x(b,mid));
    for(let j=0;j+1<active.length;j+=2){
      const a=active[j],b=active[j+1];if(x(b,mid)-x(a,mid)<.01)continue;
      const pts=[[x(a,lo),lo],[x(b,lo),lo],[x(a,hi),hi],[x(b,hi),hi]];
      out.push([0,'SOLID',5,handle(),330,owner,100,'AcDbEntity',8,'0',62,0,100,'AcDbTrace',
        ...pts.flatMap(([u,v],k)=>[10+k,u/100000,20+k,v/100000,30+k,0])].join('\n'));
    }
  }
  return out.join('\n');
}
async function maslakPaftaSablonu(){
  const response=await fetch(new URL('maslak-cad.json.gz',document.baseURI));if(!response.ok)throw Error('CAD pafta şablonu açılamadı.');
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
}
function maslakPlanPaftasi(job){
  const W=297,H=210,shapes=[],all=job.rings.flat().concat(job.axis, (job.planFaces||[]).flat());
  const [minX,minY,maxX,maxY]=all.reduce(([l,b,r,t],[x,y])=>[Math.min(l,x),Math.min(b,y),Math.max(r,x),Math.max(t,y)],[Infinity,Infinity,-Infinity,-Infinity]);
  const s=Math.min(266/Math.max(maxX-minX,1),154/Math.max(maxY-minY,1));
  const point=([x,y])=>[W/2+(x-(minX+maxX)/2)*s,103+(y-(minY+maxY)/2)*s];
  const line=(l,p,w)=>shapes.push({l,p:p.map(point),w});
  const text=(x,y,s,size=2.1,al='l',bold=false)=>shapes.push({l:'YAZI',x,y,s,size,al,bold});
  text(W/2,198,job.owners.join(' VE ')+' ENKESİT YERLEŞİM PLANI',3,'c',true);
  text(9,188,'Kuzey ↑',2.5);
  for(const tri of job.planFaces||[])line('PLAN_GUNCEL_YUZEY',[...tri,tri[0]],.08);
  job.rings.forEach((ring,i)=>line(i?'GB_KIRMIZI':'YOL_KIRMIZI',[...ring,ring[0]],.28));
  line('EKSEN',job.axis,.25);
  for(const [i,st] of job.stations.entries()){
    if(!st.profiles?.length)continue;
    const [l,r]=[st.profiles[0][0],st.profiles.at(-1)[1]];
    const end=[l,r].map(o=>[st.center[0]+o*st.normal[0],st.center[1]+o*st.normal[1]]);
    line('PLAN',end,.12);
    if(i%5===0 || i===job.stations.length-1){
      const [x,y]=point(end[1]);text(x+1,y,K.kmtxt(st.km),1.9);
    }
  }
  text(9,13,'Yol sınırı · Parsel sınırı · Eksen · Enkesit hattı · Güncel yüzey üçgenleri',2.05);
  return {W,H,shapes};
}
async function maslakEnkesitPdf(job,calc,part=0,standard=false,plan=false){
  const pages=maslakPaftalar(job,calc,part,standard);
  if(!pages.length)throw Error('Yazdırılacak enkesit bulunamadı.');
  if(plan)pages.unshift(maslakPlanPaftasi(job));
  const {colors}=await maslakPaftaSablonu();
  const sheets=pages.map(({shapes,W,H})=>({
    W,H,G:shapes.map(g=>{
      const color='#'+colors[g.l];
      if(g.p)return {t:g.fill?'f':'l',p:g.p,w:g.w,color};
      return {...g,t:'x',size:g.size/1.32,color};
    })
  }));
  return new Blob([window.APLGEO.vectorPdf(sheets)],{type:'application/pdf'});
}
function maslakTelefonPdf(job,calc,part=0){
  return maslakEnkesitPdf(job,calc,part,true);
}
async function maslakCadDosyalari(job,calc){
  const base=await maslakPaftaSablonu();
  const pages=maslakPaftalar(job,calc,0,true),items=[],entities=[];
  const shape=(type,layer,...args)=>items.push([type,layer,...args]);
  const layerList=Object.keys(base.colors).map(n=>({n,hidden:n==='YAZI_DUZENLE'}));
  const palette=Object.fromEntries(Object.entries(base.colors).map(([l,h])=>[l,/^(000000|ffffff)$/i.test(h)?7:K.hexAci(h)]));
  const penWidths=Object.create(null),extraColors={};
  const weights=[0,5,9,13,15,18,20,25,30,35,40,50,53,60,70,80,90,100,106];
  let handle=0x100000;function entity(type,l,sub,props,width){
    const color=parseInt(base.colors[l],16);
    const style=[62,palette[l],420,color];
    if(width!=null)style.push(370,weights.reduce((a,b)=>Math.abs(b-width*100)<Math.abs(a-width*100)?b:a));
    entities.push([0,type,5,(handle++).toString(16),330,base.owner,100,'AcDbEntity',8,l,...style,100,sub,...props].join('\n'));}
  function cadLine(l,a,b){shape('line',l,a,b);entity('LINE',l,'AcDbLine',[10,a[0],20,a[1],30,0,11,b[0],21,b[1],31,0]);}
  function poly(l,pts,close,width){
    entity('LWPOLYLINE',l,'AcDbPolyline',[90,pts.length,70,close?1:0,...pts.flatMap(q=>[10,q[0],20,q[1]])],width);
    let layer=l;
    if(width!=null){
      if(penWidths[layer]!=null&&penWidths[layer]!==width)layer=l+'_'+Math.round(width*100);
      if(layer!==l&&!extraColors[layer]){layerList.push({n:layer});extraColors[layer]=base.colors[l];}
      penWidths[layer]=width;
    }
    shape('pline',layer,pts,close);
  }
  function area(l,pts,legend){
    const n=pts.length;
    entity('HATCH',l,'AcDbHatch',[10,0,20,0,30,0,210,0,220,0,230,1,2,'SOLID',70,1,71,0,91,1,92,3,72,0,73,1,93,n,...pts.flatMap(q=>[10,q[0],20,q[1]]),97,0,75,0,76,1,98,0]);
    const bottom=Math.min(...pts.map(p=>p[1])), top=Math.max(...pts.map(p=>p[1]));
    // Native NCZ pen widths are paper millimetres. 1/150 turns the band
    // spacing into .0405 m in the coordinate-based sheet layout.
    penWidths[l]=.29;
    const bands=Math.max(1,Math.ceil((top-bottom)/.0405));
    for(let row=0;row<bands;row++){
      const y=bottom+(top-bottom)*(row+.5)/bands, intersections=[];
      for(const [i,[ax,ay]] of pts.entries()){
        const [bx,by]=pts[(i+1)%n];
        if((ay<=y&&y<by)||(by<=y&&y<ay))intersections.push(ax+(bx-ax)*(y-ay)/(by-ay));
      }
      intersections.sort((a,b)=>a-b);
      for(let i=0;i+1<intersections.length;i+=2){
        if(intersections[i+1]-intersections[i]>1e-8)shape('line',l,[intersections[i],y,0],[intersections[i+1],y,0]);
      }
    }
    if(!legend){const lay=l.replace(/^T_/,'ALAN_');entity('LWPOLYLINE',lay,'AcDbPolyline',[90,pts.length,70,1,...pts.flatMap(q=>[10,q[0],20,q[1]])]);shape('pline',lay,pts.concat([pts[0]]),false);}
  }
  function label(point,text,height,align,bold,rot=0,layer='YAZI'){
    const font=base.metrics[bold?'B':'R'],width=[...text].reduce((n,c)=>n+(font[c]||font['?'])[1]*height,0);
    const shift=align==='c'?width/2:align==='r'?width:0;
    const dx=rot?0:1,dy=rot?1:0;
    let x=point[0]-shift*dx+.34*height*dy,y=point[1]-shift*dy-.34*height*dx;
    shape('text',layer,[x,y,0],text,height*.688,rot,'l');
    const ascii=text.replace(/[^\x20-\x7e]/g,c=>'\\U+'+c.charCodeAt(0).toString(16).padStart(4,'0'));
    entity('TEXT','YAZI_DUZENLE','AcDbText',[10,x,20,y,30,0,40,height*.688,1,ascii,50,rot,100,'AcDbText']);
    for(const c of text){
      const [block,w]=font[c]||font['?'];
      if(block)entity('INSERT',layer,'AcDbBlockReference',[2,block,10,x,20,y,30,0,41,height,42,height,43,height,50,rot]);
      x+=w*height*dx;y+=w*height*dy;
    }
  }
  const all=[...job.rings.flat(),...job.axis],x0=all.reduce((v,p)=>Math.max(v,p[0]),-Infinity)+30,y0=all.reduce((v,p)=>Math.max(v,p[1]),-Infinity);let x=x0,y=y0,h=0;
  for(const tri of job.planFaces||[]){
    const layer='PLAN_GUNCEL_YUZEY';
    shape('face',layer,...tri);
    entity('3DFACE',layer,'AcDbFace',[...tri,tri[2]].flatMap(([x,y,z],i)=>[10+i,x,20+i,y,30+i,z]));
  }
  job.rings.forEach((r,i)=>poly(i?'GB_KIRMIZI':'YOL_KIRMIZI',r,true));poly('EKSEN',job.axis,false);
  for(const st of job.stations){if(!st.profiles.length)continue;const end=[st.profiles[0][0],st.profiles.at(-1)[1]].map(o=>[st.center[0]+o*st.normal[0],st.center[1]+o*st.normal[1],0]);cadLine('PLAN',...end);label(end[1],K.kmtxt(st.km),.8,'l',false);}
  for(const [i,page] of pages.entries()){
    if(i&&i%6===0){x=x0;y-=h+10;h=0;}
    const s=page.dx/1000,point=(a,b)=>[x+a*s,y+(b-page.H)*s,0];
    for(const g of [...page.shapes.filter(q=>q.fill),...page.shapes.filter(q=>!q.fill)]){
      if(g.p){const pp=g.p.map(q=>point(...q));if(g.fill)area(g.l,pp,g.legend);else poly(g.l,pp,false,g.w);}
      else label(point(g.x,g.y),g.s,g.size*s,g.al,g.bold,g.rot,g.l);
    }
    h=Math.max(h,page.H*s);x+=page.W*s+10;
  }
  const rgb=Object.fromEntries(Object.entries({...base.colors,...extraColors}).map(([l,v])=>[l,[0,2,4].map(i=>parseInt(v.slice(i,i+2),16))]));
  const template=base.dxf.replace(/__GL_([0-9A-F]+)__/gi,(_,owner)=>maslakGlyphs(base.outlines[owner],owner,()=>(handle++).toString(16)));
  const layerTemplate=template.replace(/(AcDbLayerTableRecord\n  2\n([^\n]+)\n 70\n\d+\n 62\n)(-?)(\d+)/g,(all,header,name,sign)=>palette[name]==null?all:header+sign+palette[name]);
  const dxf=layerTemplate.replace('__MASLAK_ENTITIES__',entities.join('\n')).replace(/(\$HANDSEED\s*\n\s*5\s*\n)[0-9A-F]+/i,(m,a)=>a+handle.toString(16)).replace(/[^\x00-\x7f]/g,c=>'\\U+'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  const ncz=maslakNczColors(await NCZW.build({layers:layerList,items}),rgb,penWidths);
  const hidden=dxf.replace(/(  2\nT_(?:YOL|GB|SIYIRMA)\n[\s\S]*? 62\n)(\d+)/g,'$1-$2');
  const empty=maslakNczColors(await NCZW.build({layers:layerList.map(l=>({...l,hidden:l.hidden||l.n.startsWith('T_')})),items}),rgb,penWidths);
  return [{name:'Plan_Enkesit.dxf',data:dxf},{name:'Plan_Enkesit.ncz',data:ncz},
    {name:'Ici_Bos_Baski/Plan_Enkesit.dxf',data:hidden},{name:'Ici_Bos_Baski/Plan_Enkesit.ncz',data:empty}];
}
async function maslakCadPaketi(job,calc){
  return O.zip(await maslakCadDosyalari(job,calc),{nczYok:true});
}
async function maslakTeslimPaketi(job,calc){
  const bytes=async pending=>{
    const data=await pending;
    return data instanceof Blob?new Uint8Array(await data.arrayBuffer()):data;
  };
  const name=maslakPdfAdi(job), plan='Plan_ve_Enkesitler.pdf';
  const control='ACAD/Kontrol/Kesit_Kontrol.xlsx';
  const sectionPdf=await bytes(maslakEnkesitPdf(job,calc,0,true));
  const files=[
    {name:'Maslak_Hakedis.xlsx',data:await bytes(maslakCetvel(job,calc))},
    {name:control,data:await bytes(maslakKontrolCetveli(calc))},
    {name,data:sectionPdf},
    {name:plan,data:await bytes(maslakEnkesitPdf(job,calc,0,true,true))},
    {name:name.replace(/\.pdf$/,' - Gerçek 150.pdf'),data:sectionPdf},
    {name:'Telefon/'+name,data:sectionPdf},
    ...await maslakCadDosyalari(job,calc)
  ];
  const manifest={
    schema:'acad.kesit.1',title:job.owners.join(' ve '),owners:job.owners,
    stations:job.stations.map(({km,normal,earth,strip})=>({km,normal,earth,strip})),curveRanges:job.curveRanges,
    previousStrip:job.previous[5],periodParcelStrip:job.stripPeriod[1],
    worksheet:'Kesit kontrolü',controlSheet:'Model toplamları',controlFile:control,
    files:await Promise.all(files.filter(f=>[control,name,plan].includes(f.name)).map(async f=>({
      name:f.name,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',f.data)),b=>b.toString(16).padStart(2,'0')).join('')
    })))
  };
  files.push({name:'ACAD/kesit.json',data:JSON.stringify(manifest)});
  return O.zip(files,{nczYok:true});
}

const ortakPaftaRenkleri = Object.freeze({
  PAFTA:'#a9b1b3', YAZI:'#111111', OFSET:'#666d70', EKSEN:'#485d6c',
  YOL_SIYAH:'#111111', YOL_KIRMIZI:'#ae2428', SIYIRMA_TABANI:'#25814a',
  T_KAZI:'#f5cfd1', T_DOLGU:'#c4e8e7', T_SIYIRMA:'#bad8c3'
});
function ortakEnkesitPaftasi(st, project, paper = "gercek", measureStep = 0) {
  if (!st.displayProfiles.some(p=>p.segments.length)) return null;
  const yol = project.yolDeger || project.yolNo || '', parsel = project.parselDeger || project.parsel || '';
  const location = [yol && ('YOL '+String(yol).replace(/^YOL\s*/i,'')),parsel].filter(Boolean);
  const title = location.length ? location.join(' VE ')+' ENKESİTİ' : 'ARAZİ ENKESİTİ';
  const [page] = maslakPaftalar({
    terrain:true,project,paper,measureStep,title,owners:[yol,parsel],
    stations:[{...st,earth:[[],[]],strip:[[],[]]}]
  },null,0,paper==="gercek");
  const palette = {...ortakPaftaRenkleri};
  for (const p of st.displayProfiles) if (p.color) palette[p.layer] = p.color;
  const G = page.shapes.map(shape=>({
    ...shape,t:shape.p?(shape.fill?'f':'l'):'x', color:palette[shape.l]||'#111111',
    ...(shape.p ? {kot86:true} : {size:shape.size/1.32})
  }));
  G.coz = false;
  const image = st.stamp && O.IMG.kase;
  if (image?.height && image.width) O.kase(G,29+(page.W-36)/2,6.2,Math.min(32,4.15*image.width/image.height));
  return {...page,G,palette};
}
function ortakKesisimBolgesi(a,b,c,d) {
  const [l,z0] = a, [r,z1] = b, start = c-z0, end = d-z1;
  if (Math.abs(start)<1e-9 && Math.abs(end)<1e-9) return [];
  if (start*end < 0) {
    const t = start/(start-end), x = l+(r-l)*t, z = z0+(z1-z0)*t;
    return [...ortakKesisimBolgesi(a,[x,z],c,z),...ortakKesisimBolgesi([x,z],b,z,d)];
  }
  return [{l:start+end<0?'T_KAZI':'T_DOLGU',p:[a,b,[r,d],[l,c]]}];
}

const ortakKesitOnizlemeleri = new WeakMap();
function ortakEnkesitOnizleme(canvas,page) {
  const px=Math.min(5,1650/page.W,1240/page.H);
  canvas.width=Math.round(page.W*px);
  canvas.height=Math.round(page.H*px);
  O.paint(canvas.getContext('2d'),page.G,px,page.W,page.H);
  const state=ortakKesitOnizlemeleri.get(canvas);
  if(state){
    state.page=page;state.px=px;state.points=[];
    state.button.disabled=false;
    state.status.textContent=state.active?'Kesit üzerinde ilk noktayı seç.':'';
  }
}
function ortakEnkesitOlcumuTemizle(canvas) {
  const state=ortakKesitOnizlemeleri.get(canvas);
  if(!state)return;
  state.page=null;state.points=[];state.button.disabled=true;state.status.textContent='';
}
function ortakEnkesitOlcumBagla(canvas,button,status) {
  const state={button,status,page:null,points:[],active:false};
  ortakKesitOnizlemeleri.set(canvas,state);
  button.addEventListener('click',()=>{
    if(!state.page)return;
    state.active=!state.active;
    button.setAttribute('aria-pressed',String(state.active));
    canvas.style.cursor=state.active?'crosshair':'';
    ortakEnkesitOnizleme(canvas,state.page);
  });
  canvas.addEventListener('click',event=>{
    const {page,active,px}=state;
    if(!active||!page)return;
    const box=canvas.getBoundingClientRect();
    const x=(event.clientX-box.left-canvas.clientLeft)/canvas.clientWidth*canvas.width/px;
    const y=page.H-(event.clientY-box.top-canvas.clientTop)/canvas.clientHeight*canvas.height/px;
    const [left,bottom,right,top]=page.plot;
    if(x<left||x>right||y<bottom||y>top){status.textContent='Çizim alanında bir nokta seç.';return;}
    const points=state.points.length===1?[state.points[0],[x,y]]:[[x,y]];
    ortakEnkesitOnizleme(canvas,page);
    state.points=points;
    const ctx=canvas.getContext('2d');
    const marked=points.map(([x,y])=>[x*px,(page.H-y)*px]);
    ctx.save();ctx.fillStyle='#075986';ctx.strokeStyle='#075986';ctx.lineWidth=1.8;
    if(marked.length===2){
      ctx.beginPath();ctx.moveTo(...marked[0]);ctx.lineTo(...marked[1]);ctx.stroke();
      const dx=Math.abs(points[1][0]-points[0][0])*page.dx/1000;
      const dz=Math.abs(points[1][1]-points[0][1])*page.dy/1000;
      const fmt=v=>v.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
      status.textContent=`Yatay ${fmt(dx)} m · Kot farkı ${fmt(dz)} m · Eğik ${fmt(Math.hypot(dx,dz))} m`;
    }else status.textContent='İkinci noktayı seç.';
    for(const [x,y] of marked){ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  });
}
function ortakPaftalariDiz(pages,origin,up=true) {
  if(!pages.length)return [];
  const scale=.15;
  const width=Math.max(...pages.map(p=>p.W))*scale+10;
  const height=Math.max(...pages.map(p=>p.H))*scale+10;
  return pages.flatMap((page,i)=>{
    const x0=origin[0]+i%3*width;
    const y0=origin[1]+(up?Math.floor(i/3)*height:-Math.floor(i/3)*height-page.H*scale);
    const point=(x,y)=>[x0+x*scale,y0+y*scale,0];
    const fills=[],entities=[];
    for(const g of page.G){
      if(g.t==='i')continue;
      const color=g.color, lay='KESIT_'+(g.l||'YAZI');
      if(g.t==='x'){
        if(g.s)entities.push({t:'text',lay,color,pts:[point(g.x,g.y)],s:g.s,h:g.size*1.32*.688*scale,al:g.al,rot:g.rot||0});
      }else{
        const fill=g.t==='f',pts=g.p.map(([x,y])=>point(x,y));
        (fill?fills:entities).push({t:pts.length===2?'line':'pline',lay,color,pts,closed:fill,fill});
      }
    }
    return fills.concat(entities);
  });
}
