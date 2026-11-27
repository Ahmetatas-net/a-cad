'use strict';
const MaslakHesap = (() => {
  const eps = 1e-7;
  function splitSection(K, frame, rings, models, thickness) {
    const {center, normal, km} = frame, [black, red, parcelBase] = models;
    const project = p => (p[0]-center[0])*normal[0]+(p[1]-center[1])*normal[1];
    const at = o => [center[0]+o*normal[0],center[1]+o*normal[1]];
    const offsets = rings.flat().map(project);
    let low=Infinity,high=-Infinity;
    for(const o of offsets){low=Math.min(low,o);high=Math.max(high,o);}
    low-=1;high+=1;
    const a=at(low), b=at(high), width=high-low;
    const ts=[0,1];
    for (const ring of rings) ts.push(...K.polyHits(ring,a,b));
    for (const tin of new Set(models.filter(Boolean))) {
      for(const t of K.edgeHits(tin,a,b)) ts.push(t);
    }
    ts.sort((x,y)=>x-y);
    const earth=[[],[]],strip=[[],[]], footprints=[],profiles=[];
    let missing=0;
    for(let j=1;j<ts.length;j++){
      const left=low+ts[j-1]*width,right=low+ts[j]*width;
      if(right-left<eps)continue;
      const mid=at((left+right)/2), road=K.inPoly(rings[0],...mid), parcel=K.inPoly(rings[1],...mid);
      if(!road&&!parcel)continue;
      // Two interior samples reconstruct the owning triangle's plane at each endpoint, including a model discontinuity.
      const sample=tin=>{
        const p=K.zAt(tin,...at((3*left+right)/4)),q=K.zAt(tin,...at((left+3*right)/4));
        return p==null||q==null?null:[(3*p-q)/2,(3*q-p)/2];
      };
      const base=sample(!road&&parcelBase?parcelBase:black),top=sample(red);
      const sep=road&&parcel&&parcelBase?sample(parcelBase):null;
      if(!base||!top||(road&&parcel&&parcelBase&&!sep)){missing+=right-left;continue;}
      const cuts=[0,1],lines=[base,top,...(sep?[sep]:[])];
      for(let n=1;n<lines.length;n++) for(let k=0;k<n;k++){
        const u=lines[n][0]-lines[k][0],v=lines[n][1]-lines[k][1];
        if(u*v<0)cuts.push(u/(u-v));
      }
      cuts.sort((x,y)=>x-y);
      for(let k=1;k<cuts.length;k++){
        const f=cuts[k-1],g=cuts[k],l=left+f*(right-left),r=left+g*(right-left);
        if(r-l<eps)continue;
        const pair=z=>[z[0]+f*(z[1]-z[0]),z[0]+g*(z[1]-z[0])];
        const floor=pair(base), roof=pair(top);
        const boundary=sep?pair(sep).map((v,i)=>Math.min(Math.max(floor[i],roof[i]),Math.max(Math.min(floor[i],roof[i]),v))):null;
        if(boundary){earth[0].push([l,r,...floor,...boundary]);earth[1].push([l,r,...boundary,...roof]);}
        else earth[road?0:1].push([l,r,...floor,...roof]);
        profiles.push([l,r,...floor,...roof,...(boundary||[])]);
        if(roof[0]+roof[1]>floor[0]+floor[1]+1e-9){
          const owner=boundary?(boundary[0]+boundary[1]>floor[0]+floor[1]+1e-9?0:1):(road?0:1);
          footprints.push({l,r,floor,owner});
        }
      }
    }
    for(let j=0;j<footprints.length;){
      let end=j+1;while(end<footprints.length&&Math.abs(footprints[end-1].r-footprints[end].l)<1e-4)end++;
      const l0=footprints[j].l,r0=footprints[end-1].r;
      const transitions=r0-l0>2*thickness?[l0+thickness,r0-thickness]:[(l0+r0)/2];
      for(const {l,r,floor,owner} of footprints.slice(j,end)){
        const bounds=[l,...transitions.filter(o=>l+eps<o&&o<r-eps),r];
        const z=x=>floor[0]+(x-l)/(r-l)*(floor[1]-floor[0]),d=x=>Math.max(0,Math.min(thickness,x-l0,r0-x));
        for(let q=1;thickness>0&&q<bounds.length;q++){const a=bounds[q-1],b=bounds[q];strip[owner].push([a,b,z(a)-d(a),z(b)-d(b),z(a),z(b)]);}
      }
      j=end;
    }
    return {km,center,normal,earth,strip,profiles,missing};
  }
  function frames(K,axis,baseKm,step,curveStep,angle,extras) {
    if(!axis||axis.length<2||axis.some((p,i)=>!p.slice(0,2).every(Number.isFinite)||(i&&Math.hypot(p[0]-axis[i-1][0],p[1]-axis[i-1][1])<eps)))throw Error('Eksen boş veya ardışık köşeleri çakışıyor.');
    const chain=[0],ranges=[];
    for(let j=1;j<axis.length;j++)chain.push(chain[j-1]+Math.hypot(axis[j][0]-axis[j-1][0],axis[j][1]-axis[j-1][1]));
    const last=chain.at(-1);
    const stations=new Set([0,last]);
    function insertRange(l,r,spacing){
      for(let i=Math.ceil((l+baseKm-1e-8)/spacing);i*spacing-baseKm<r-1e-8;i++)stations.add(Math.max(l,i*spacing-baseKm));
      stations.add(l);stations.add(r);
    }
    if(last/Math.min(step,curveStep)>100000)throw Error('Eksen uzunluğunu ve kesit aralığını kontrol edin.');
    insertRange(0,last,step);
    for(let j=1;j<axis.length-1;j++){
      const v=axis[j-1],c=axis[j],w=axis[j+1];
      const ax=c[0]-v[0],ay=c[1]-v[1],bx=w[0]-c[0],by=w[1]-c[1];
      const turn=Math.abs(Math.atan2(ax*by-ay*bx,ax*bx+ay*by))*180/Math.PI;
      if(turn<angle)continue;
      const l=Math.max(0,chain[j]-step),r=Math.min(last,chain[j]+step);
      insertRange(l,r,curveStep);stations.add(chain[j]);
      if(ranges.length&&l<=ranges.at(-1)[1])ranges.at(-1)[1]=Math.max(r,ranges.at(-1)[1]);else ranges.push([l,r]);
    }
    for(const km of extras){const v=km-baseKm;if(v<0||v>last)throw Error('Özel kilometre eksen dışında: '+km);stations.add(v);}
    const list=[...stations].sort((a,b)=>a-b).filter((v,i,all)=>i===0||v-all[i-1]>eps);
    return {frames:list.map(s=>{const {p,u}=K.pointAt(axis,chain,s);return {km:baseKm+s,center:p,normal:[u[1],-u[0]]};}),ranges:ranges.map(r=>r.map(s=>s+baseKm))};
  }
  function surface(K,clip,rings,models) {
    const [black,red,parcelBase]=models, [road,parcel]=rings;
    const outside=clip.difference([parcel],[road]);
    const totals={fill:0,cut:0,area:0,covered:0};
    function add(ring,base,sign){
      const r=K.surfDiffExact(base,red,ring,0,0,0);
      if(!r)throw Error('Yüzey karşılaştırması yapılamadı.');
      totals.fill+=sign*r.dolgu;totals.cut+=sign*r.kazi;totals.covered+=sign*r.ortak;
      const origin=ring[0];totals.area+=sign*K.area(ring.map(q=>[q[0]-origin[0],q[1]-origin[1]]));
    }
    add(road,black,1);
    for(const poly of outside)poly.forEach((ring,i)=>add(ring,parcelBase||black,i?-1:1));
    return totals;
  }
  // Select original XYZ facets that touch either work boundary; never retriangulate the measured surface.
  function planFaces(K,model,rings){
    const faces=[];
    if(!model?.tri)return faces;
    const box=points=>points.reduce(([l,b,r,t],[x,y])=>[Math.min(l,x),Math.min(b,y),Math.max(r,x),Math.max(t,y)],[Infinity,Infinity,-Infinity,-Infinity]);
    const bounds=rings.map(box),overlaps=(a,b)=>!(a[2]<b[0]||a[0]>b[2]||a[3]<b[1]||a[1]>b[3]);
    for(let i=0;i<model.tri.length;i+=3){
      const tri=[0,1,2].map(j=>{const p=model.pts[model.tri[i+j]];return [p.e,p.y,p.z];});
      const b=box(tri);
      if(rings.some((r,j)=>overlaps(b,bounds[j])&&(tri.some(p=>K.inPoly(r,p[0],p[1]))||r.some(p=>K.inPoly(tri,p[0],p[1]))||tri.some((p,k)=>K.polyHits(r,p,tri[(k+1)%3]).length))))faces.push(tri);
    }
    return faces;
  }
  return {splitSection,frames,surface,planFaces};
})();
if(typeof module!=='undefined')module.exports=MaslakHesap;
