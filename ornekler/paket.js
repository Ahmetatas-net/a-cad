'use strict';
const download = document.querySelector('#download');
const statusLine = document.querySelector('#durum');
async function request(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error('Paket alınamadı (' + response.status + ').');
  return response;
}
download.addEventListener('click', async () => {
  download.disabled = true;
  statusLine.textContent = 'Paket indiriliyor…';
  try {
    const pack = await (await request('paket.json')).json();
    const parts = await Promise.all(pack.parts.map(async name => (await request(name)).arrayBuffer()));
    const zip = new Blob(parts, {type: 'application/zip'});
    const sha256 = new Uint8Array(await crypto.subtle.digest('SHA-256',await zip.arrayBuffer()));
    const hex = Array.from(sha256,n => n.toString(16).padStart(2,'0')).join('');
    if(hex !== pack.sha256) throw Error('Paket doğrulanamadı. Lütfen yeniden deneyin.');
    const link=document.createElement('a'), url=URL.createObjectURL(zip);
    link.href=url; link.download=pack.filename;
    document.body.append(link);link.click();link.remove();
    setTimeout(() => URL.revokeObjectURL(url),60000);
    statusLine.textContent='Doğrulanan ZIP indirmeye hazır.';
  } catch(error) {
    statusLine.textContent=error.message;
  } finally {
    download.disabled=false;
  }
});
