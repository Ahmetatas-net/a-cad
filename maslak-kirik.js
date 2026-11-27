'use strict';

const MaslakKirik = (() => {
  const epsilon = 1e-5;
  const minText = 2.23; // mm em. The embedded font's digits are at least 1.53 mm tall.
  const spacing = 3.05;

  function paths(segments) {
    const result = [];
    for (const [left, right, zl, zr] of [...segments].sort((a, b) => a[0] - b[0])) {
      if (right - left < epsilon) continue;
      const path = result.at(-1), end = path?.at(-1);
      if (end && Math.abs(end[0] - left) < epsilon && Math.abs(end[1] - zl) < epsilon) path.push([right, zr]);
      else result.push([[left, zl], [right, zr]]);
    }
    return result;
  }

  function level(points, x) {
    if (x < points[0][0] - epsilon || x > points.at(-1)[0] + epsilon) return null;
    let lo = 0, hi = points.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >>> 1;
      if (points[m][0] <= x) lo = m;
      else hi = m;
    }
    const [a, za] = points[lo], [b, zb] = points[hi];
    return za + (zb - za) * Math.max(0, Math.min(1, (x - a) / (b - a)));
  }

  function corners(p, projectLine, stripping) {
    const found = new Map([[0, 2.5], [p.length - 1, 2.5]]);
    const add = (i, score) => found.set(i, Math.max(score, found.get(i) || 0));
    const heightLimit = projectLine ? .032 : .055;
    const gradeLimit = projectLine ? .055 : .105;
    const grade = (i, j) => (p[j][1] - p[i][1]) / (p[j][0] - p[i][0]);
    // Capture long profile departures without using the drawing scale.
    const ranges = [[0, p.length - 1]];
    while (ranges.length) {
      const [a, b] = ranges.pop(), m = grade(a, b);
      let best = -1, height = .055;
      for (let i = a + 1; i < b; i++) {
        const delta = Math.abs(p[i][1] - p[a][1] - (p[i][0] - p[a][0]) * m);
        if (delta > height) {best = i; height = delta;}
      }
      if (best < 0) continue;
      add(best, 1 + Math.min(height, .9));
      if (best - a > 1) ranges.push([a, best]);
      if (b - best > 1) ranges.push([best, b]);
    }
    if (stripping) return found;
    for (let i = 1; i + 1 < p.length; i++) {
      const [x, z] = p[i];
      const left = Math.min(1.8, x - p[0][0]), right = Math.min(1.8, p.at(-1)[0] - x);
      if (Math.min(left, right) >= .22 && Math.abs(grade(i, i+1) - grade(i-1, i)) >= gradeLimit) {
        const change = Math.abs((level(p, x+right)-z)/right - (z-level(p, x-left))/left);
        const drop = change * left * right / (left + right);
        if (change >= gradeLimit * .6 && drop >= heightLimit) add(i, 3 + Math.min(drop, 1.8));
      }
      if (projectLine || i+2 >= p.length) continue;
      const width = p[i+1][0] - x, rise = p[i+1][1] - z;
      if (width < .08 || width > .65 || Math.abs(rise) < .075) continue;
      const l = Math.min(.5, x-p[0][0]), r = Math.min(.5, p.at(-1)[0]-p[i+1][0]);
      if (Math.min(l,r) < .15) continue;
      const slope = rise/width;
      if (Math.min(Math.abs(slope-(z-level(p,x-l))/l),Math.abs(slope-(level(p,p[i+1][0]+r)-p[i+1][1])/r)) >= .24) {
        const strength = 3.7+Math.min(Math.abs(rise),1);
        add(i,strength);add(i+1,strength);
      }
    }
    return found;
  }

  function choose(segments, toPaper, first, last) {
    const profiles = segments.map(paths), candidates = [];
    for (const [slot, collection] of profiles.entries()) {
      for (const p of collection) {
        for (const [i, score] of corners(p, slot === 2 || slot === 3, slot >= 4)) {
          candidates.push({x:p[i][0], z:p[i][1], slot, score});
        }
      }
    }
    const capacity = Math.floor((last-first)/spacing)+1;
    const taken = [];
    for (const q of candidates.sort((a,b) => b.score-a.score || a.x-b.x || a.slot-b.slot)) {
      const key = toPaper(q.x);
      const same = taken.find(p => Math.abs(p.x-q.x)<epsilon);
      if (same) {
        if (!same.matched.has(q.slot)) {
          same.values[q.slot] = q.z;
          same.matched.add(q.slot);
        }
        continue;
      }
      const nearest = q.score >= 3 ? .36 : q.score >= 2.5 ? 1.95 : spacing;
      if (taken.length >= capacity || taken.some(p => Math.abs(p.anchor-key)<nearest)) continue;
      let guideTop = q.z;
      const values = profiles.map(profile => {
        let firstLevel = null;
        for (const p of profile) {
          const z = level(p,q.x);
          if (z === null) continue;
          firstLevel ??= z;
          guideTop = Math.max(guideTop,z);
        }
        return firstLevel;
      });
      values[q.slot] = q.z;
      taken.push({...q,anchor:key,guideTop,values,matched:new Set([q.slot])});
    }
    return taken.sort((a,b) => a.x-b.x);
  }

  function positions(anchors, first, last) {
    const pools = [];
    for (const [i, x] of anchors.entries()) {
      pools.push({sum:x-i*spacing,n:1});
      while (pools.length > 1) {
        const a = pools.at(-2), b = pools.at(-1);
        if (a.sum/a.n <= b.sum/b.n) break;
        a.sum += b.sum; a.n += b.n; pools.pop();
      }
    }
    const slots = [], max = last-(anchors.length-1)*spacing;
    for (const {sum,n} of pools) {
      const x = Math.min(max,Math.max(first,sum/n));
      for (let i=0;i<n;i++) slots.push(x+slots.length*spacing);
    }
    return slots;
  }
  return {choose, positions, minText};
})();
if (typeof module !== 'undefined') module.exports=MaslakKirik;
