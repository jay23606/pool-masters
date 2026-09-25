// Grows trick shots: takes a table one shot clears, adds one more ball, and looks for a nearby shot that still clears
// everything. Random four-ball layouts are almost never clearable, but a clearable three-ball one with a ball added on
// the path of the play often is.
//
//   node tools/extend-tricks.mjs <in.jsonl> <seed> <tries> <out.jsonl>
import fs from 'node:fs'
import {attempt} from '../src/drills.js'
import {rollout} from '../src/ai.js'
import {POCKETS,R,PR,setTableSize} from '../src/table.js'
import {kind} from '../src/rules.js'
setTableSize(7)
const [IN,SEED,TRIES,OUT]=[process.argv[2],Number(process.argv[3])||1,Number(process.argv[4])||300,process.argv[5]]
const rng=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const ball=(n,x,y)=>({id:n,n,x,y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:n?kind(n):'cue'})
const windowDegrees=(drill,shot)=>{
 const ok=d=>attempt(drill,{...shot,angle:shot.angle+d*Math.PI/180}).ok
 let lo=0,hi=0
 while(lo>-3&&ok(lo-.05))lo-=.05
 while(hi<3&&ok(hi+.05))hi+=.05
 return Math.round((hi-lo+.05)*100)/100
}
const rows=fs.readFileSync(IN,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l))
const r=rng(SEED)
let made=0
for(const t of rows){
 // where things go during the play: every ball and the cue ball, sampled along the way
 const table=[ball(0,...t.cue),...t.ballsAt.map(b=>ball(b[0],b[1],b[2]))]
 const path=[]
 rollout(table,t.hint.angle,t.hint.power,10,t.hint.spin,(bs,time)=>{if(Math.round(time*120)%12===0)for(const b of bs)if(b.on)path.push([b.x,b.y])})
 for(let i=0;i<TRIES;i++){
  const base=path[Math.floor(r()*path.length)]||[350,190]
  const x=Math.round(base[0]+(r()-.5)*70),y=Math.round(base[1]+(r()-.5)*70)
  if(x<60||x>640||y<60||y>320)continue
  const all=[t.cue,...t.ballsAt.map(b=>[b[1],b[2]])]
  if(all.some(p=>Math.hypot(p[0]-x,p[1]-y)<R*3)||POCKETS.some(k=>Math.hypot(k[0]-x,k[1]-y)<R*5))continue
  const balls=[...t.ballsAt,[4,x,y]]
  const drill={layout:{cue:t.cue,balls},win:{clear:true}}
  let best=null
  for(let da=-1;da<=1.001;da+=.1)for(const dp of [0,-6,6]){
   const shot={angle:t.hint.angle+da*Math.PI/180,power:Math.max(10,Math.min(100,t.hint.power+dp)),spin:t.hint.spin}
   if(!attempt(drill,shot).ok)continue
   const w=windowDegrees(drill,shot)
   if(!best||w>best.window)best={shot,window:w}
  }
  if(best&&best.window>=.1){
   made++
   fs.appendFileSync(OUT,JSON.stringify({seed:t.seed,balls:4,cue:t.cue,ballsAt:balls,hint:{angle:Math.round(best.shot.angle*10000)/10000,power:best.shot.power,spin:best.shot.spin},window:best.window})+'\n')
   break
  }
 }
}
console.error(`extended ${made} of ${rows.length} in ${IN}`)
