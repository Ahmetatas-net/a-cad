'use strict';
// Generate all four sheets locally. The application ships only labels, styles and formulas.
function maslakCetvel(job, calculated) {
  const book=O.xlsx(), number={border:'thin',nf:'#,##0.00'}, heading={b:true,h:'center',border:'thin'}, title={b:true,h:'center',sz:14};
  const project=job.project;
  for(let owner=0;owner<2;owner++)for(const strip of [false,true]){
    const sh=book.sheet((owner?'Parsel':'Yol')+(strip?' Sıyırma':' Kazı-Dolgu')),base=owner*3;
    const count=calculated.rows.length,first=15,last=first+2*(count-1);
    const cell=(ref,val,style={},formula)=>sh.set(ref,val,style,formula);
    [3,19,16,13,13,15,15,16,16].forEach((w,i)=>sh.col(i,w));
    sh.merge('B2:I2').set('B2',(owner?'BİNA':'YOL')+' İŞLERİ KÜBAJ CETVELİ',title);
    for(const [index,[key,val]] of [['İŞİN ADI',project.is],['İŞVEREN',project.isveren],['MÜTEAHHİT',project.muteahhit],['HAKEDİŞ TARİHİ',project.tarih],['HAKEDİŞ NO',project.no],[owner?'PARSEL/BLOK NO':'YOL NO',job.owners[owner]]].entries()){
      const r=3+index;cell('B'+r,key,{b:true});sh.merge('C'+r+':G'+r);cell('C'+r,val||'');
    }
    cell('I8','GENEL TOPLAM',heading);
    for(const [r,key,value] of [[9,'POZ NO / AÇKL',strip?'Sıyırma':(owner?project.pozK:project.pozYK)],[10,'',strip?'':(owner?project.pozD:project.pozYD)]]){
      cell('B'+r,key,{b:true});sh.merge('C'+r+':G'+r);cell('C'+r,value||'');
    }
    let carry=job.previous[base+2],period=job.stripPeriod[owner];
    const hasLedger=strip&&period!=null;
    const footer=last+2;
    if(hasLedger){
      cell('B'+footer,'Önceki sıyırma (m³)',{b:true});cell('D'+footer,carry,number);
      cell('E'+footer,'Bu hakediş (m³)',{b:true});cell('G'+footer,period,number);
    }
    if(strip)cell('I9',hasLedger?(carry==null?null:carry+period):calculated.totals[base+2],number,hasLedger?(carry==null?undefined:'D'+footer+'+G'+footer):'H'+last);
    else{cell('I9',calculated.totals[base],number,'H'+last);cell('I10',calculated.totals[base+1],number,'I'+last);}
    cell('B11','KM',{b:true});cell('C11',job.stations[0].km,number,'B'+first);cell('D11',job.stations.at(-1).km,number,'B'+last);cell('E11','ARASI');
    for(const [range,ref,label] of [['B12:B13','B12','Kilometre'],['C12:C13','C12','Ara uzaklık (m)'],['D12:E12','D12','ALAN (m²)'],['F12:G12','F12','HACİM (m³)'],['H12:I12','H12','KÜMÜLATİF HACİM (m³)']]){
      sh.merge(range,heading);cell(ref,label,heading);
    }
    for(const [k,col] of [...'DEFGHI'].entries())cell(col+'13',k%2?'DOLGU':strip?'SIYIRMA':'YARMA',heading);
    for(const [i,cur] of calculated.rows.entries()){
      const r=first+2*i;
      cell('B'+r,cur.km,{...number,nf:'0"+"000.00'});
      for(let col=0;col<2;col++){
        const idx=base+(strip?2:col),zero=strip&&col,area='DE'[col],other='ED'[col],inc='FG'[col],sum='HI'[col];
        const total=zero?0:cur.cumulative[idx];cell(area+r,zero?0:cur.area[idx],number);
        if(i){
          const prev=calculated.rows[i-1],prior=zero?0:prev.cumulative[idx],km=cur.km-prev.km;
          cell('C'+(r-1),km,number,'B'+r+'-B'+(r-2));
          const a=area+(r-2),b=area+r,u=other+(r-2),v=other+r,len='C'+(r-1);
          const mean=len+'*('+a+'+'+b+')/2';
          const f=strip?mean:`IF(AND(${a}<=1E-8,${b}>1E-8,${u}>1E-8),${len}*${b}^2/(2*(${b}+${u})),IF(AND(${b}<=1E-8,${a}>1E-8,${v}>1E-8),${len}*${a}^2/(2*(${a}+${v})),${mean}))`;
          const [x,y]=job.stations[i-1].normal,[xx,yy]=job.stations[i].normal;
          const angle=job.curveRanges.some(([s,e])=>prev.km>=s&&cur.km<=e)?Math.atan2(x*yy-y*xx,x*xx+y*yy):0;
          const adj=angle*(cur.moment[idx]+prev.moment[idx])/2;
          cell(inc+(r-1),total-prior,number,zero?'0':'('+f+')+('+adj+')');
        }
        cell(sum+r,total,number,i?sum+(r-2)+'+'+inc+(r-1):undefined);
      }
    }
    const sign=footer+(hasLedger?2:0);
    ['MÜTEAHHİT','HARİTA MÜHENDİSİ','KONTROL MÜHENDİSİ'].forEach((label,i)=>{
      const col='CFH'[i],to='EGI'[i];for(const [j,val] of [label,project['s'+(i+1)],project.tarih,''].entries()){
        sh.merge(col+(sign+j)+':'+to+(sign+j),heading);cell(col+(sign+j),val||'',j?{h:'center',border:'thin'}:heading);
      }
    });
    sh.page({land:false,pa:'$B$2:$I$'+(sign+3),ptr:'$12:$13'});
  }
  return book.build();
}
