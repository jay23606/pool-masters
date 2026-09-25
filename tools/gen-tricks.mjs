// Finds trick shots: small tables that ONE shot clears completely, proven by the real physics.
//
//   node tools/gen-tricks.mjs <balls> <seed> <seconds> <out.jsonl>
//
// Layouts are drawn from a seeded generator (each ball placed on an approach line to a random pocket, so the balls
// have somewhere to go), then every angle, a few powers and a little side spin are tried. Layouts that a single shot
// clears are written out one per line with the best shot found and how many degrees of aim still clear the table.
// Run several in parallel with different seeds, then tools/build-tricks.mjs picks and names the set.
import fs from 'node:fs'
import {attempt} from '../src/drills.js'
import {POCKETS,R,setTableSize} from '../src/table.js'
setTableSize(7)

const [K,SEED0,SECS,OUT]=[Number(process.argv[2])||2,Number(process.argv[3])||1,Number(process.argv[4])||60,process.argv[5]||`tricks-${process.argv[2]}.jsonl`]
const rng=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}

const POWERS=[40,60,80,100]
const SPINS=K>=3?[[0,0],[0,.45],[0,-.45],[.45,0],[-.45,0]]:[[0,0],[0,.45],[0,-.45]]

function layout(r){
 const pos=[]
 const place=(x,y)=>{if(x<60||x>640||y<60||y>320)return null;if(pos.every(q=>Math.hypot(q[0]-x,q[1]-y)>R*3)&&POCKETS.every(k=>Math.hypot(k[0]-x,k[1]-y)>R*5))return [Math.round(x),Math.round(y)];return null}
 const cue=[Math.round(80+r()*540),Math.round(80+r()*220)];pos.push(cue)
 const balls=[]
 for(let n=1;n<=K;n++){
  let p=null
  for(let t=0;t<60&&!p;t++){const k=POCKETS[Math.floor(r()*6)],d=70+r()*170,a=Math.atan2(190-k[1],350-k[0])+(r()-.5)*1.6;p=place(k[0]+Math.cos(a)*d,k[1]+Math.sin(a)*d)}
  if(!p)return null;pos.push(p);balls.push([n,p[0],p[1]])
 }
 return {cue,balls}
}

const windowDegrees=(drill,shot)=>{
 const ok=d=>attempt(drill,{...shot,angle:shot.angle+d*Math.PI/180}).ok
 let lo=0,hi=0
 while(lo>-3&&ok(lo-.05))lo-=.05
 while(hi<3&&ok(hi+.05))hi+=.05
 return Math.round((hi-lo+.05)*100)/100
}

const t0=Date.now();let tried=0,found=0
for(let seed=SEED0;(Date.now()-t0)/1000<SECS;seed++){
 const l=layout(rng(seed*977+K));if(!l)continue
 tried++
 const drill={layout:l,win:{clear:true}}
 let best=null,hits=0
 search:for(const spin of SPINS)for(let deg=0;deg<360;deg+=1)for(const power of POWERS){
  const shot={angle:deg*Math.PI/180,power,spin}
  if(!attempt(drill,shot).ok)continue
  const w=windowDegrees(drill,shot)
  if(!best||w>best.window)best={shot,window:w}
  if(++hits>=4)break search
 }
 if(!best||best.window<.1)continue
 found++
 fs.appendFileSync(OUT,JSON.stringify({seed,balls:K,cue:l.cue,ballsAt:l.balls,hint:{angle:Math.round(best.shot.angle*10000)/10000,power:best.shot.power,spin:best.shot.spin},window:best.window})+'\n')
}
console.error(`K=${K} seed0=${SEED0}: tried ${tried} layouts, found ${found}`)
