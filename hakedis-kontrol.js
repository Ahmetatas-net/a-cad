'use strict';
// Measures use metres. Sections contain disjoint cut/fill quads, already split at zero crossings.
function calculateSections(model) {
  const finite = Number.isFinite;
  const six = () => Array(6).fill(0);
  if (model.schema !== 'acad.kesit.1' || !Array.isArray(model.stations) || model.stations.length < 2 ||
      !Array.isArray(model.curveRanges) || !model.curveRanges.every(r => r.length === 2 && r.every(finite) && r[1] > r[0])) throw Error('Kesit verisi veya kurp sınırı geçersiz.');
  let previous;
  const totals = six(), curve = six(), rows = [];
  for (const section of model.stations) {
    const {km, normal} = section;
    if (!finite(km) || (previous && km <= previous.km) || normal.length !== 2 || !normal.every(finite) ||
        Math.abs(Math.hypot(...normal) - 1) > 1e-5) throw Error('Kilometre sırası veya kesit doğrultusu geçersiz.');
    const area = six(), moment = six();
    for (const owner of [0, 1]) {
      for (const type of ['earth', 'strip']) {
        for (const q of section[type][owner]) {
          if (q.length !== 6 || !q.every(finite)) throw Error('Eksik kot veya ofset: ' + km);
          const [l, r, a, b, c, d] = q, h = c-a, k = d-b;
          if (r <= l || (h*k < -1e-7) || (type === 'strip' && Math.min(h,k) < -1e-7)) throw Error('Geçersiz kesit dilimi: ' + km);
          const A = (r-l)*(Math.abs(h)+Math.abs(k))/2;
          const M = (r-l)*(Math.abs(h)*(2*l+r)+Math.abs(k)*(l+2*r))/6;
          const cols = type === 'strip' ? [1,2] : [h+k > 0 ? 1 : 0];
          for (const col of cols) { area[3*owner+col] += A; moment[3*owner+col] += M; }
        }
      }
    }
    if (previous) {
      const inside = model.curveRanges.some(([l,r]) => previous.km >= l && km <= r);
      const [x,y] = previous.normal, [u,v] = normal;
      const angle = inside ? Math.atan2(x*v-y*u, x*u+y*v) : 0;
      for (let i=0; i<6; i++) {
        const a = previous.area[i], b = area[i], col = i%3;
        let volume = (km-previous.km)*(a+b)/2;
        if (col < 2) {
          const other = col === 0 ? i+1 : i-1;
          if (a<=1e-8 && b>1e-8 && previous.area[other]>1e-8) volume *= b/(b+previous.area[other]);
          else if (b<=1e-8 && a>1e-8 && area[other]>1e-8) volume *= a/(a+area[other]);
        }
        volume += angle*(previous.moment[i]+moment[i])/2;
        totals[i] += volume;
        if (inside) curve[i] += volume;
      }
    }
    previous = {km,normal,area,moment};
    rows.push({km,area,moment,cumulative:totals.slice()});
  }
  return {rows, totals, curve};
}
if (typeof module !== 'undefined') module.exports = calculateSections;

if (typeof document !== 'undefined') {
  const input = document.querySelector('#hkDosya');
  const status = document.querySelector('#hkDurum');
  const output = document.querySelector('#hkSonuc');
  const fmt = n => n.toLocaleString('tr-TR', {minimumFractionDigits:2,maximumFractionDigits:2});
  const readSelected = async (buf, accept) => { const d = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(d.buffer, d.byteOffset, d.byteLength), out = {};
  let e = d.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error("zip değil");
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const td = new TextDecoder();
  for (let i = 0; i < n; i++) { const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = td.decode(d.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    if (accept && !accept(name)) continue;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true); const raw = d.subarray(ds, ds + csz);
    out[name] = meth === 0 ? raw : meth === 8 ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()) : null; }
  return out; };
  const readText = bytes => new TextDecoder().decode(bytes);
  const xml = bytes => new DOMParser().parseFromString(readText(bytes),'application/xml');
  let generation = 0, links = [];
  async function readSheetCells(bytes, names) {
    const workbook = new Set(['xl/workbook.xml','xl/_rels/workbook.xml.rels']);
    const members = await readSelected(bytes, path => workbook.has(path));
    const sheets = [...xml(members['xl/workbook.xml']).getElementsByTagName('sheet')];
    const relationships = [...xml(members['xl/_rels/workbook.xml.rels']).getElementsByTagName('Relationship')];
    const paths = names.map(name => {
      const id = sheets.find(s => s.getAttribute('name') === name)?.getAttribute('r:id');
      if (!id) throw Error('Cetvel bulunamadı: ' + name);
      const target = relationships.find(r => r.getAttribute('Id') === id).getAttribute('Target');
      return new URL(target,'https://acad.invalid/xl/workbook.xml').pathname.slice(1);
    });
    const tables = await readSelected(bytes, path => paths.includes(path));
    return paths.map(path => {
      const row = new Map();
      for (const c of xml(tables[path]).getElementsByTagName('c')) {
        const v = c.getElementsByTagName('v')[0]?.textContent;
        if (v !== undefined && v !== '' && (!c.hasAttribute('t') || c.getAttribute('t') === 'n')) row.set(c.getAttribute('r'),Number(v));
      }
      return row;
    });
  }
  function assertMatch(measured, excel, tolerance, where) {
    if (!Number.isFinite(excel) || Math.abs(measured-excel)>tolerance) throw Error('Excel ile uyuşmuyor: '+where);
  }
  input?.addEventListener('change', async () => {
    const token = ++generation, file = input.files[0];
    output.replaceChildren(); links.forEach(URL.revokeObjectURL); links=[];
    if (!file) {status.textContent='';return;}
    status.textContent='Kesitler ve Excel kontrol ediliyor…';
    try {
      const archive = await file.arrayBuffer();
      const path = 'ACAD/kesit.json';
      const header = await readSelected(archive,n=>n===path);
      if (!header[path]) throw Error('Birleşik kesit kaydı içeren teslim ZIP dosyasını seçin.');
      const model = JSON.parse(readText(header[path]));
      const result = calculateSections(model);
      const names = new Set(model.files.map(f=>f.name));
      const files = await readSelected(archive,n=>names.has(n));
      for (const f of model.files) {
        if (!files[f.name]) throw Error('Eksik belge: '+f.name);
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256',files[f.name]));
        if (Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')!==f.sha256) throw Error('Belge içeriği değişmiş: '+f.name);
      }
      const excel = model.files.find(f=>f.name.endsWith('.xlsx'));
      const [station,control] = await readSheetCells(files[excel.name],[model.worksheet,model.controlSheet]);
      if (Array.from(station.keys()).filter(k=>/^B\d+$/.test(k)).length!==result.rows.length) throw Error('Excel istasyon sayısı farklı.');
      result.rows.forEach(({km,area},j)=>{
        const row=j+2;
        assertMatch(km,station.get('B'+row),1e-7,'KM '+km);
        area.forEach((v,c)=>assertMatch(v,station.get('CDEFGH'[c]+row),1e-6,'KM '+km+' · '+'CDEFGH'[c]+row));
      });
      result.totals.forEach((v,i)=>assertMatch(v,control.get('B'+(i+2)),.00501,'genel toplam '+(i+1)));
      if (token!==generation) return;
      status.textContent=model.title+' · '+result.rows.length+' istasyon ve 6 genel toplam Excel ile doğrulandı.';
      const table=document.createElement('table');
      for (const [index,cells] of [
        ['İmalat','Kazı (m³)','Brüt dolgu (m³)','Model sıyırması (m³)'],
        ...model.owners.map((owner,i)=>[owner,...result.totals.slice(3*i,3*i+3).map(fmt)])
      ].entries()) {
        const tr=table.insertRow();
        for(const cell of cells) { const el=document.createElement(index?'td':'th');el.textContent=cell;tr.append(el); }
      }
      output.append(table);
      const text=document.createElement('p');
      const diff=model.curveSurfaceFill.map((v,i)=>v-result.curve[i*3+1]);
      text.textContent='Kurpta brüt dolgu, yüzey − kesit: '+model.owners.map((o,i)=>o+' '+fmt(diff[i])+' m³').join(' · ')+'.';
      output.append(text);
      const period=document.createElement('p');
      period.textContent='Parsel sıyırma devri '+fmt(model.previousStrip)+' m³ · Bu dönem '+fmt(model.periodParcelStrip)+' m³.'+(model.roadOffset==null?' Yol sıyırması için önceki dönemle çakışan miktar bekleniyor.':'');
      if(Number.isFinite(model.stripLedger?.roadModelPrior)){
        period.textContent+=' Yol brüt sıyırması önceki cetvelden '+fmt(model.stripLedger.roadModelPrior)+' m³ olarak taşındı.';
      }
      output.append(period);
      for (const f of model.files) {
        const a=document.createElement('a'); a.download=f.name;a.textContent=f.name.endsWith('.xlsx')?'Hakediş Excel’i':(f.name.includes('Plan')?'Planlı PDF':'Enkesit PDF');
        a.href=URL.createObjectURL(new Blob([files[f.name]]));links.push(a.href);output.append(a);
      }
    } catch(e) { if(token===generation) {output.replaceChildren(); status.textContent='Kontrol tamamlanamadı. '+e.message;} }
  });
}
