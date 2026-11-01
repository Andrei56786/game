// Замер и предпросмотр генерации мира в node:
//   node tools/genbench.mjs [seed] [png]     — png: путь для картинки (1 пиксель = 1 клетка)
import fs from 'fs'; import path from 'path'; import cp from 'child_process';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [seed = '777', png = ''] = process.argv.slice(2);
const eng = fs.readFileSync(path.join(ROOT, 'src/engine.js'), 'utf8').split('\n');
const i0 = eng.findIndex(l => l.startsWith('function mulberry32')); let i1 = eng.findIndex(l => l.startsWith('function mkRng')); while (!eng[i1].startsWith('}')) i1++;
let src = eng.slice(i0, i1 + 1).join('\n') + '\n' + eng.filter(l => /^const (clamp|lerp|ease) =/.test(l)).join('\n') + '\n';
src += fs.readFileSync(path.join(ROOT, 'src/worldgen.js'), 'utf8');
src += `
const t0=performance.now(); const WD=genWorld(${seed}); const ms=performance.now()-t0;
const types=WD.setts.reduce((o,s)=>(o[s.type]=(o[s.type]||0)+1,o),{});
const L=[]; for (const P of WD.provs) { let best=1e9; for (const Q of WD.provs) if (Q!==P) best=Math.min(best, Math.hypot(P.x-Q.x,P.y-Q.y)); L.push(best);} L.sort((a,b)=>a-b);
let land=0, riv=0; for (let i=0;i<NT;i++) { if(!TINFO[WD.ter[i]].water) land++; if (WD.river[i]) riv++; }
const areas=WD.provs.map(p=>p.area).sort((a,b)=>a-b);
const realmN=[0,1,2,3,4].map(r=>WD.owner.filter(o=>o===r).length);
const vil=WD.provs.map(p=>p.villages.length).sort((a,b)=>a-b);
const ter={}; for (let i=0;i<NT;i++) { const n=TINFO[WD.ter[i]].n; ter[n]=(ter[n]||0)+1; } for (const k in ter) ter[k]=Math.round(ter[k]/NT*1000)/10;
console.log(JSON.stringify({MW,MH,ms:Math.round(ms),tt:WD.tt,provs:WD.provs.length,types,lairs:WD.lairs.length,roads:WD.roadList.length,land,riv,lakes:WD.labels.filter(l=>l.kind==='lake').length,
 seatDist:{min:+L[0].toFixed(1),med:+L[L.length>>1].toFixed(1),max:+L[L.length-1].toFixed(1)}, area:{min:areas[0],med:areas[areas.length>>1],max:areas[areas.length-1]}, vil:{min:vil[0],med:vil[vil.length>>1],max:vil[vil.length-1]}, realmN, free: WD.owner.filter(o=>o<0).length, ter}));
if (${JSON.stringify(png)}) {
  const RC=['#c03030','#3050c0','#30a050','#c0a030','#9040b0'];
  const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const buf=Buffer.alloc(NT*3);
  for (let i=0;i<NT;i++){ let c=hex(TINFO[WD.ter[i]].mc); if (WD.river[i]) c=[50,110,200]; if (WD.road[i]) c=WD.road[i]===2?[120,80,40]:[150,120,80];
    const p=WD.prov[i]; if (p>=0) { const x=i%MW,y=(i/MW)|0; let edge=false; for (const [dx,dy] of N4){const nx=x+dx,ny=y+dy; if(inMap(nx,ny)&&WD.prov[ny*MW+nx]>=0&&WD.prov[ny*MW+nx]!==p) edge=true;} if (edge) { const o=WD.owner[p]; c=o>=0?hex(RC[o]):[60,60,60]; } }
    buf[i*3]=c[0];buf[i*3+1]=c[1];buf[i*3+2]=c[2]; }
  for (const s of WD.setts){ const r=s.type==='village'?0:s.type==='capital'?2:1; const col=s.type==='village'?[255,255,255]:s.type==='town'?[255,230,0]:s.type==='capital'?[255,0,255]:[0,0,0]; for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const x=s.x+dx,y=s.y+dy; if(inMap(x,y)){const i=y*MW+x; buf[i*3]=col[0];buf[i*3+1]=col[1];buf[i*3+2]=col[2];}} }
  for (const l of WD.lairs){ const i=l.y*MW+l.x; buf[i*3]=255;buf[i*3+1]=0;buf[i*3+2]=0; }
  require('fs').writeFileSync('/tmp/genbench.ppm', Buffer.concat([Buffer.from('P6\\n'+MW+' '+MH+'\\n255\\n'), buf]));
}`;
fs.writeFileSync('/tmp/genbench_run.cjs', '(function(){\n' + src + '\n})();\n');
process.stdout.write(cp.execFileSync('node', ['/tmp/genbench_run.cjs'], { encoding: 'utf8' }));
if (png) cp.execFileSync('magick', ['/tmp/genbench.ppm', '-scale', '200%', png]);
