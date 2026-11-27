'use strict';
function maslakPaftalar(job,calc){
  const pages=[],km=n=>Math.floor(n/1000)+'+'+(n%1000).toFixed(2).padStart(6,'0').replace('.',','),f=(n,d=2)=>n.toLocaleString('tr-TR',{minimumFractionDigits:d,maximumFractionDigits:d});
  for(const [i,st] of job.stations.entries()){
    if(!calc.rows[i].area.some(n=>n>=.005))continue;
    const shapes=[],line=(l,p,w=.2)=>shapes.push({l,p,w}),text=(x,y,s,size=2.5,al='l',bold=false)=>shapes.push({l:'YAZI',x,y,s:String(s),size,al,bold});
    const frame=(x,y,X,Y)=>line('PAFTA',[[x,y],[X,y],[X,Y],[x,Y],[x,y]],.15);
    const qs=st.earth.flat(),xs=[0],zs=[];for(const q of qs){xs.push(q[0],q[1]);zs.push(...q.slice(2));}
    for(const q of st.strip.flat())zs.push(q[2],q[3]);
    const extent=v=>v.reduce(([a,b],z)=>[Math.min(a,z),Math.max(b,z)],[Infinity,-Infinity]);
    const [lo,hi]=extent(xs),[bot,top]=extent(zs);
    const denom=(d,mm)=>Math.max(150,Math.ceil(d*1000/mm/5)*5),dx=denom(hi-lo+.8,268),dy=denom(top-bot+.6,67);
    const X=o=>153+(o-(lo+hi)/2)*1000/dx,Y=z=>110+(z-(top+bot)/2)*1000/dy;
    frame(6,174,291,204);text(148.5,201,'ENKESİT',3.4,'c',true);
    for(const [n,[label,value]] of [['İŞİN ADI',job.project.is],['İŞVEREN',job.project.isveren],['MÜTEAHHİT',job.project.muteahhit],['HAKEDİŞ',String(job.project.no||'')+'    '+(job.project.tarih||'')]].entries()){
      const y=196-5.5*n;line('PAFTA',[[6,y+2.5],[291,y+2.5]],.15);text(8,y,label,1.9);text(39,y,value||'',2);
    }
    text(7,169,'KM '+km(st.km),3.2,'l',true);text(148.5,169,job.owners.join(' VE ')+' BİRLEŞİK ENKESİTİ',2.8,'c',true);
    text(289,169,String(pages.length+1),2.4,'r');text(290,161,'A4   Yatay 1/'+dx+'   Düşey 1/'+dy,2,'r');
    for(const [j,[name,layer]] of [[job.owners[0],'T_YOL'],[job.owners[1],'T_GB'],['Sıyırma','T_SIYIRMA']].entries()){
      const x=8+70*j;shapes.push({l:layer,p:[[x,159],[x+5,159],[x+5,162],[x,162]],fill:true,legend:true});text(x+7,160.5,name,2.1);
    }
    frame(18,74,288,146);
    const offsets=[...new Set([lo,hi,0,...Array.from({length:7},(_,j)=>lo+(j+1)*(hi-lo)/8)])].sort((a,b)=>a-b);
    const sample=(list,o,top=false)=>{const q=list.find(q=>o>=q[0]-1e-7&&o<=q[1]+1e-7);if(!q)return null;const j=top?4:2;return q[j]+(q[j+1]-q[j])*(o-q[0])/(q[1]-q[0]);};
    for(const o of offsets){
      let z=sample(st.earth[0],o)??sample(st.earth[1],o);
      if(z!==null&&Math.abs(o)>.001)line('OFSET',[[X(o),74],[X(o),Y(z)]],.12);
    }
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
    st.earth.forEach((parts,i)=>regions(parts,i?'T_GB':'T_YOL'));
    for(const group of st.strip){
      regions(group,'T_SIYIRMA');
      for(const [l,r,a,b] of group)line('SIYIRMA_TABANI',[[X(l),Y(a)],[X(r),Y(b)]]);
    }
    for(const [owner,parts] of st.earth.entries()){
      let last=null;
      for(const [l,r,a,b,c,d] of parts){
        const bottom=[[X(l),Y(a)],[X(r),Y(b)]], roof=[[X(l),Y(c)],[X(r),Y(d)]];
        if(owner){if(last&&Math.abs(last[0]-l)<1e-6&&Math.abs(last[1]-a)>1e-5)line('GB_SIYAH',[[X(l),Y(last[1])],bottom[0]]);
          dash('GB_SIYAH',...bottom);last=[r,b];}else line('YOL_SIYAH',bottom,.32);
        if(Math.abs(a-c)+Math.abs(b-d)<1e-8)continue;
        const topOwner=st.profiles.find(v=>Math.abs(v[0]-l)<1e-7&&Math.abs(v[1]-r)<1e-7);
        if(topOwner&&Math.abs(c-topOwner[4])+Math.abs(d-topOwner[5])<1e-6){
          if(owner)dash('GB_KIRMIZI',...roof,.7,.45);else line('YOL_KIRMIZI',roof,.27);
        }
      }
    }
    dash('EKSEN',[X(0),74],[X(0),146],1.9,1);text(X(0),148,'Eksen',2,'c',true);
    const bands=[['Ofset (m)',null],['Parsel kırmızı kot',o=>sample(st.earth[1],o,true)],['Yol siyah kot',o=>sample(st.earth[0],o)],['Yol kırmızı kot',o=>sample(st.earth[0],o,true)],['Parsel siyah kot',o=>sample(st.earth[1],o)],['Yol sıyırma tabanı',o=>sample(st.strip[0],o)],['Parsel sıyırma tabanı',o=>sample(st.strip[1],o)]];
    const cell=246/offsets.length;
    bands.forEach(([name,fn],j)=>{const y=68-4.5*j;frame(7,y-2,290,y+2.5);text(8,y,name,2);offsets.forEach((o,k)=>{const v=fn?fn(o):o;text(44+(k+.5)*cell,y,v==null?'—':f(v,fn?3:2),1.9,'c');});});
    for(let j=0;j<2;j++){const v=calc.rows[i].area.slice(3*j,3*j+3);text(8+142*j,36,job.owners[j]+'   Kazı '+f(v[0])+'   Brüt dolgu '+f(v[1])+'   Sıyırma '+f(v[2])+' m²',2.1);}
    text(8,30,'Eksen   Y '+f(st.center[0],3)+' m     X '+f(st.center[1],3)+' m',2);
    frame(7,5,290,25);for(const [j,v] of ['MÜTEAHHİT','HARİTA MÜHENDİSİ','KONTROL MÜHENDİSİ'].entries()){
      const x=54+j*93;text(x,22,v,2.2,'c',true);text(x,16,job.project['s'+(j+1)]||'',2.2,'c');text(x,10,job.project.tarih||'',2,'c');
    }
    pages.push({shapes,dx,km:st.km});
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
async function maslakCadPaketi(job,calc){
  const response=await fetch(new URL('maslak-cad.json.gz',document.baseURI));if(!response.ok)throw Error('CAD pafta şablonu açılamadı.');
  const base=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
  const pages=maslakPaftalar(job,calc),items=[],entities=[];
  const shape=(type,layer,...args)=>items.push([type,layer,...args]);
  const layerList=Object.entries(base.colors).map(([n,c])=>({n,c:7,hidden:n==='YAZI_DUZENLE'}));
  let handle=0x100000;function entity(type,l,sub,props){entities.push([0,type,5,(handle++).toString(16),330,base.owner,100,'AcDbEntity',8,l,100,sub,...props].join('\n'));}
  function cadLine(l,a,b){shape('line',l,a,b);entity('LINE',l,'AcDbLine',[10,a[0],20,a[1],30,0,11,b[0],21,b[1],31,0]);}
  function poly(l,pts,close){
    entity('LWPOLYLINE',l,'AcDbPolyline',[90,pts.length,70,close?1:0,...pts.flatMap(q=>[10,q[0],20,q[1]])]);shape('pline',l,pts,close);
  }
  function area(l,pts,legend){
    const n=pts.length;
    entity('HATCH',l,'AcDbHatch',[10,0,20,0,30,0,210,0,220,0,230,1,2,'SOLID',70,1,71,0,91,1,92,3,72,0,73,1,93,n,...pts.flatMap(q=>[10,q[0],20,q[1]]),97,0,75,0,76,1,98,0]);
    shape('pline',l,pts,true);
    if(!legend){const lay=l.replace(/^T_/,'ALAN_');entity('LWPOLYLINE',lay,'AcDbPolyline',[90,pts.length,70,1,...pts.flatMap(q=>[10,q[0],20,q[1]])]);shape('pline',lay,pts.concat([pts[0]]),false);}
  }
  function label(point,text,height,align,bold){
    const font=base.metrics[bold?'B':'R'],width=[...text].reduce((n,c)=>n+(font[c]||font['?'])[1]*height,0);
    let x=point[0]-(align==='c'?width/2:align==='r'?width:0),y=point[1]-.34*height;
    shape('text','YAZI',[x,y,0],text,height*.688,0,'l');
    const ascii=text.replace(/[^\x20-\x7e]/g,c=>'\\U+'+c.charCodeAt(0).toString(16).padStart(4,'0'));
    entity('TEXT','YAZI_DUZENLE','AcDbText',[10,x,20,y,30,0,40,height*.688,1,ascii,100,'AcDbText']);
    for(const c of text){const [block,w]=font[c]||font['?'];if(block)entity('INSERT','YAZI','AcDbBlockReference',[2,block,10,x,20,y,30,0,41,height,42,height,43,height]);x+=w*height;}
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
    const s=page.dx/1000,point=(a,b)=>[x+a*s,y+(b-210)*s,0];
    for(const g of [...page.shapes.filter(q=>q.fill),...page.shapes.filter(q=>!q.fill)]){
      if(g.p){const pp=g.p.map(q=>point(...q));if(g.fill)area(g.l,pp,g.legend);else poly(g.l,pp,false);}
      else label(point(g.x,g.y),g.s,g.size*s,g.al,g.bold);
    }
    h=Math.max(h,210*s);x+=297*s+10;
  }
  const rgb=Object.fromEntries(Object.entries(base.colors).map(([l,v])=>[l,[0,2,4].map(i=>parseInt(v.slice(i,i+2),16))]));
  const template=base.dxf.replace(/__GL_([0-9A-F]+)__/gi,(_,owner)=>maslakGlyphs(base.outlines[owner],owner,()=>(handle++).toString(16)));
  const dxf=template.replace('__MASLAK_ENTITIES__',entities.join('\n')).replace(/(\$HANDSEED\s*\n\s*5\s*\n)[0-9A-F]+/i,(m,a)=>a+handle.toString(16)).replace(/[^\x00-\x7f]/g,c=>'\\U+'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  const ncz=maslakNczColors(await NCZW.build({layers:layerList,items}),rgb);
  const hidden=dxf.replace(/(  2\nT_(?:YOL|GB|SIYIRMA)\n[\s\S]*? 62\n)(\d+)/g,'$1-$2');
  const empty=maslakNczColors(await NCZW.build({layers:layerList.map(l=>({...l,hidden:l.hidden||l.n.startsWith('T_')})),items}),rgb);
  return O.zip([{name:'Plan_Enkesit.dxf',data:dxf},{name:'Plan_Enkesit.ncz',data:ncz},
    {name:'Ici_Bos_Baski/Plan_Enkesit.dxf',data:hidden},{name:'Ici_Bos_Baski/Plan_Enkesit.ncz',data:empty}],{nczYok:true});
}
