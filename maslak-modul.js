'use strict';
(()=>{
  const panel=document.getElementById('maslakPanel'), get=id=>panel.querySelector('[name="'+id+'"]');
  const status=panel.querySelector('[role="status"]'),results=panel.querySelector('[data-result]');
  const fmt=n=>n.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
  let worker=null, completed=null, version=0, lastProject=null;
  const keys=['yol','parsel','step','curve','depth','extras','netcad','previous','period','mode'];
  panel.querySelector('section').innerHTML=`
  <div class="ms-grid"><label>Yol alanı<select name="yol"></select></label><label>Parsel / blok alanı<select name="parsel"></select></label></div>
  <div class="ms-grid"><label>Ortak alan<select name="mode"><option value="road">Yol sınırında parseli bitir</option><option value="sep">Şevde ara yüzeyle böl</option></select></label><label hidden data-sep>Parsel siyahı / ara yüzey (NCZ, DXF)<input name="surface" type="file" accept=".ncz,.dxf"><select name="layer"></select></label></div>
  <details><summary>Kesit, sıyırma ve dönem bilgileri</summary><div class="ms-grid">
  <label>Düzde kesit (m)<input type="number" name="step" value="5" min=".01" step=".01"></label><label>Kurpta kesit (m)<input type="number" name="curve" value="1" min=".01" step=".01"></label>
  <label>Sıyırma (m)<input type="number" name="depth" value=".25" min="0" step=".01"></label><label>Özel kilometreler (m, noktalı virgülle)<input name="extras" placeholder="460,24; 463,47"></label>
  <label>Netcad birleşik dolgu (m³, sıyırmasız)<input type="number" min="0" step="any" name="netcad"></label></div>
  <table><thead><tr><th>Önceki onaylı (m³)</th><th>Kazı</th><th>Brüt dolgu</th><th>Sıyırma</th><th>Bu dönem sıyırma</th></tr></thead><tbody>${['Yol','Parsel'].map((n,i)=>'<tr><th>'+n+'</th>'+[0,1,2,3].map(j=>'<td><input aria-label="'+n+' '+['önceki kazı','önceki dolgu','önceki sıyırma','bu dönem sıyırma'][j]+'" type="number" min="0" step="any" name="ledger'+(i*4+j)+'"></td>').join('')+'</tr>').join('')}</tbody></table></details>
  <div class="row"><button name="run" type="button" class="primary">Hesapla ve karşılaştır</button><button name="excel" type="button" disabled>Maslak Excel</button><select name="pdfPart" aria-label="Enkesit PDF sayfaları" hidden></select><button name="pdf" type="button" disabled>Enkesit PDF</button><button name="mobile" type="button" disabled>Telefon PDF</button><button name="cad" type="button" disabled>Plan ve enkesit CAD</button></div>`;
  let sepFaces=null, fileGeneration=0;
  const numbers=field=>{const v=get(field).value;return v===''?null:Number(v);};
  function cancel(){get('pdfPart').hidden=true;version++;if(worker)worker.terminate();worker=null;completed=null;results.textContent='';status.textContent='';get('mobile').disabled=get('pdf').disabled=get('cad').disabled=get('excel').disabled=true;}
  function saveSettings(){
    if(!ST)return;
    ST.maslak={...Object.fromEntries(keys.filter(k=>get(k)).map(k=>[k,get(k).value])),ledger:Array.from({length:8},(_,i)=>get('ledger'+i).value)};
    save();
  }
  function refresh(){
    cancel();const areas=ST.alanlar||[],prefs=ST.maslak||{};
    for(const role of ['yol','parsel']){
      const sel=get(role);sel.replaceChildren(new Option('Alan seçin',''));
      areas.forEach((a,i)=>{if(a.pts?.length>=3)sel.add(new Option(a.no||a.ad||('Alan '+(i+1)),String(i)));});
      const idx=areas.findIndex(a=>a.tur===role);sel.value=prefs[role]??(idx>=0?String(idx):'');
    }
    for(const key of keys.filter(k=>!['yol','parsel'].includes(k)&&get(k)))get(key).value=prefs[key]??get(key).defaultValue??'';
    get('mode').value=prefs.mode||'road';
    for(let i=0;i<8;i++)get('ledger'+i).value=prefs.ledger?.[i]??'';
    get('surface').value='';get('layer').replaceChildren();sepFaces=null;fileGeneration++;
    panel.querySelector('[data-sep]').hidden=get('mode').value!=='sep';
    lastProject=ST;status.textContent=[ST.eksen?.length?'Eksen hazır':'Eksen seçin',MS?'Siyah yüzey hazır':'Siyah yüzey yükleyin',MR?'Kırmızı yüzey hazır':'Kırmızı yüzey yükleyin'].join(' · ');
  }
  panel.ontoggle=()=>{if(panel.open)refresh();};
  panel.oninput=e=>{if(e.target.type==='file'||e.target===get('pdfPart'))return;cancel();panel.querySelector('[data-sep]').hidden=get('mode').value!=='sep';saveSettings();};
  get('surface').onchange=async()=>{
    cancel();sepFaces=null;get('layer').replaceChildren();const token=++fileGeneration,file=get('surface').files[0];if(!file)return;
    try{const b=new Uint8Array(await file.arrayBuffer());const d=/\.ncz$/i.test(file.name)?K.parseNCZ(b):K.parseDXF(toText(b));if(token!==fileGeneration)return;
      if(!d.faces.length)throw Error('Üçgen yüzey bulunamadı.');sepFaces=d.faces;
      for(const n of new Set(d.faces.map(f=>f.lay)))get('layer').add(new Option(n,n));
    }catch(e){status.textContent=e.message;}
  };
  function buildWorker(){
    const imports=['maslak-hesap.js','hakedis-kontrol.js'].map(n=>JSON.stringify(new URL(n,document.baseURI).href)).join(',');
    const code=[document.querySelector('script[data-src="core.js"]').textContent, document.querySelector('#kgm-polygon-clipping').textContent,
      '\nimportScripts('+imports+');\n',`onmessage=({data:j})=>{try{
      const models=j.models.map(m=>m?(m.flat!==undefined?m:K.index(m)):null);
      const frames=MaslakHesap.frames(K,j.axis,j.km0,j.step,j.curve,j.angle,j.extras);
      const stations=frames.frames.map(frame=>MaslakHesap.splitSection(K,frame,j.rings,models,j.depth));
      const first=stations.findIndex(s=>s.profiles.length),end=stations.findLastIndex(s=>s.profiles.length);
      if(first<0||first===end)throw Error('İmalatı kesen en az iki istasyon gerekir.');
      if(stations.some(s=>s.missing>.001))throw Error('Kesit içinde ölçüsüz yüzey aralığı var. Yüzey kapsamını kontrol edin.');
      const job={...j,planFaces:MaslakHesap.planFaces(K,models[1],j.rings),models:undefined,schema:'acad.kesit.1',stations:stations.slice(Math.max(0,first-1),end+2),curveRanges:frames.ranges};
      const calc=calculateSections(job),raw=calculateSections({...job,stations:job.stations.map(s=>({...s,strip:[[],[]]}))});
      const surface=MaslakHesap.surface(K,polygonClipping,j.rings,models);
      if(surface.area<=0||Math.abs(surface.covered-surface.area)>Math.max(.03,surface.area*.00001))throw Error('Alan ve iki yüzeyin ortak kapsamı uyuşmuyor.');
      postMessage({job,calc,raw,surface});}catch(e){postMessage({error:e.message});}};`];
    const url=URL.createObjectURL(new Blob(code,{type:'text/javascript'}));try{return new Worker(url);}finally{URL.revokeObjectURL(url);}
  }
  function stamp(){return JSON.stringify([MVER,ST.eksen,ST.alanlar.map(a=>[a.ad,a.no,a.pts]),ST.proj,ST.set.km0]);}
  get('run').onclick=()=>{
    cancel();
    try{
      if(ST!==lastProject){refresh();throw Error('Proje değişti. Alan seçimlerini kontrol edin.');}
      const ids=['yol','parsel'].map(k=>get(k).value),areas=ids.map(i=>i!==''&&ST.alanlar[i]);
      if(!MS||!MR||!ST.eksen?.length||areas.some(a=>!a)||ids[0]===ids[1])throw Error('Eksen, iki yüzey ve iki ayrı alan seçin.');
      const step=numbers('step'),curve=numbers('curve'),depth=numbers('depth');
      if(!(step>0&&curve>0&&curve<=step&&depth!==null&&depth>=0))throw Error('Kesit aralıklarını ve sıyırma kalınlığını kontrol edin.');
      let sep=null;if(get('mode').value==='sep'){if(!sepFaces)throw Error('Şev ayrımı için parsel siyah yüzeyini seçin.');sep=K.facesToModel(sepFaces.filter(f=>f.lay===get('layer').value));}
      const nullable=Array.from({length:8},(_,i)=>numbers('ledger'+i));if(nullable.some(v=>v!==null&&(!Number.isFinite(v)||v<0)))throw Error('Devir miktarlarını kontrol edin.');
      const extras=get('extras').value.split(';').map(v=>v.trim()).filter(Boolean).map(v=>Number(v.replace('+','').replace(',','.')));if(!extras.every(Number.isFinite))throw Error('Özel kilometre biçimini kontrol edin.');
      const job={rings:areas.map(a=>a.pts),owners:areas.map(a=>a.no||a.ad),axis:ST.eksen,models:[MS,MR,sep].map(m=>m?(m.flat!==undefined?{flat:m.flat}:{pts:m.pts,tri:m.tri}):null),step,curve,depth,extras,angle:.25,km0:+ST.set.km0||0,project:{...ST.proj},
        previous:[...nullable.slice(0,3),...nullable.slice(4,7)],stripPeriod:[nullable[3],nullable[7]],netcad:numbers('netcad')};
      const current=stamp();worker=buildWorker();status.textContent='Enkesit ve yüzey hacimleri hesaplanıyor…';
      worker.onmessage=({data})=>{worker.terminate();worker=null;try{
        if(data.error)throw Error(data.error);if(current!==stamp())throw Error('Proje değişti. Yeniden hesaplayın.');
        completed={...data,current};const {raw,surface,calc}=data,fill=raw.totals[1]+raw.totals[4],delta=fill-surface.fill;
        status.textContent=calc.rows.length+' hesap istasyonu · Sıyırmasız enkesit '+fmt(fill)+' m³ · Birleşik yüzey '+fmt(surface.fill)+' m³';
        results.textContent='Enkesit − yüzey '+fmt(delta)+' m³.'+(job.netcad!==null?' Netcad farkı '+fmt(fill-job.netcad)+' m³'+(job.netcad>0?' (%'+fmt(100*(fill-job.netcad)/job.netcad)+', hedef ±%2).':'.'):'');
        const selector=get('pdfPart'), count=calc.rows.filter(maslakImalatKesiti).length;
        selector.replaceChildren(new Option('Tüm enkesitler ('+count+')','0'));
        selector.hidden=count<=maslakBolumBoyu;
        for(let first=0;!selector.hidden && first<count;first+=maslakBolumBoyu){
          selector.add(new Option('Sayfa '+(first+1)+'–'+Math.min(first+maslakBolumBoyu,count),String(first/maslakBolumBoyu+1)));
        }
        get('mobile').disabled=get('pdf').disabled=get('cad').disabled=get('excel').disabled=false;
      }catch(e){status.textContent=e.message;}};
      worker.onerror=e=>{cancel();status.textContent='Hesap açılamadı. '+e.message;};worker.postMessage(job);
    }catch(e){status.textContent=e.message;}
  };
  async function download(kind){
    try{
      const result=completed;if(!result||stamp()!==result.current){cancel();throw Error('Girdiler değişti. Yeniden hesaplayın.');}
      const formats={excel:[maslakCetvel,'.xlsx'],pdf:[maslakEnkesitPdf],mobile:[maslakTelefonPdf],cad:[maslakCadPaketi,'_CAD.zip']};
      const [build,suffix]=formats[kind];
      const part=Number(get('pdfPart').value)||0;
      const isPdf=kind==='pdf'||kind==='mobile';
      const blob=isPdf?await build(result.job,result.calc,part):await build(result.job,result.calc);
      if(completed!==result||stamp()!==result.current)throw Error('Proje değişti. Yeniden hesaplayın.');
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=isPdf?maslakPdfAdi(result.job,part).replace(/\.pdf$/,kind==='mobile'?' - Telefon.pdf':'.pdf'):'Maslak_Hakedis_'+String(result.job.project.no||'').replace(/[^\w-]/g,'')+suffix;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
    }catch(e){status.textContent=e.message;}
  }
  for(const kind of ['excel','pdf','mobile','cad'])get(kind).onclick=()=>download(kind);
})();
