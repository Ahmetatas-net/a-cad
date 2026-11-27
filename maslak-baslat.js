'use strict';
(()=>{
  const area=document.querySelector('#v-veri'),reports=document.querySelector('#v-cikti');
  if(!area||!reports||document.getElementById('maslakPanel'))return;
  const panel=document.createElement('details');panel.id='maslakPanel';panel.className='card';
  panel.innerHTML='<summary><strong>Maslak hakediş formatı</strong></summary><section></section><p role="status"></p><p data-result></p>';
  area.querySelector('.kub-guide')?.after(panel);if(!panel.isConnected)area.prepend(panel);
  const css=document.createElement('style');css.textContent='#maslakPanel summary,#hkPanel summary{cursor:pointer;padding:.3rem 0}#maslakPanel section{overflow:auto}#maslakPanel .ms-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr));gap:.6rem;margin:.6rem 0}#maslakPanel table,#hkSonuc table{border-collapse:collapse;font-variant-numeric:tabular-nums}#maslakPanel td,#maslakPanel th,#hkSonuc td,#hkSonuc th{padding:.35rem;text-align:start}#maslakPanel td input{width:6rem}#maslakPanel [hidden]{display:none}#hkSonuc{overflow:auto}#hkSonuc a{display:inline-block;margin:.5rem}';document.head.append(css);
  const check=document.createElement('details');check.className='card';check.id='hkPanel';
  check.innerHTML='<summary><strong>Yol ve parsel hakediş kontrolü</strong></summary><label>Teslim paketi (ZIP)<input id="hkDosya" type="file" accept=".zip"></label><p id="hkDurum" role="status"></p><div id="hkSonuc"></div>';
  reports.prepend(check);
  const sampleLink=document.createElement('a');
  sampleLink.href='./ornekler/index.html';
  sampleLink.textContent='Yol 2 ve 267/1 GB örnek teslim ZIP’i';
  check.querySelector('label').before(sampleLink);
  let ready;
  function load(){
    return ready??=Promise.resolve().then(async()=>{
      for(const file of ['hakedis-kontrol.js','maslak-cetvel.js','maslak-ncz.js','maslak-kirik.js','maslak-cad.js','maslak-modul.js']){
        await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./'+file;s.onload=resolve;s.onerror=()=>reject(Error(file+' yüklenemedi.'));document.head.append(s);});
      }
      if(panel.open)panel.ontoggle?.();
    }).catch(e=>{panel.querySelector('[role=status]').textContent=e.message;check.querySelector('[role=status]').textContent=e.message;});
  }
  for(const el of [panel,check])el.addEventListener('toggle',()=>{if(el.open)load();});
})();
