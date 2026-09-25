// How good is the geometric aim snap? For random tables, aim roughly at a pocket with the object ball, let snapAim
// pick an angle, and check with the real physics whether that angle pots the ball, and whether some other angle
// within the snap's reach would have done better.
//   node tools/snap-audit.mjs [tables]
import {snapAim,refineAim} from '../src/snap.js'
import {rollout} from '../src/ai.js'
import {POCKETS,R,setTableSize} from '../src/table.js'
import {kind} from '../src/rules.js'
setTableSize(7)
const rng=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const ball=(n,x,y)=>({id:n,n,x,y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:n?kind(n):'cue'})
const N=Number(process.argv[2])||150,POWER=Number(process.argv[3])||55
let refinedPots=0,snapped=0,pots=0,better=0,worse=0,nearMiss=[]
for(let seed=1;seed<=N;seed++){
 const r=rng(seed),p=()=>[60+r()*580,60+r()*260]
 const c=p(),o=p()
 if(Math.hypot(c[0]-o[0],c[1]-o[1])<60)continue
 const balls=[ball(0,...c),ball(1,...o)]
 const k=POCKETS[Math.floor(r()*6)]
 // a raw aim: at the ghost ball for the pocket, then knocked a little off it
 const u=[k[0]-o[0],k[1]-o[1]],m=Math.hypot(...u),g=[o[0]-u[0]/m*2*R,o[1]-u[1]/m*2*R]
 const raw=Math.atan2(g[1]-c[1],g[0]-c[0])+(r()-.5)*4*Math.PI/180
 const s=snapAim(balls,raw)
 if(s.pocket==null)continue
 snapped++
 const ok=a=>rollout(balls.map(b=>({...b})),a,POWER,8,[0,0]).potted.some(b=>b===1||b?.n===1)
 const hit=ok(s.angle)
 if(ok(refineAim(balls,s.angle,{target:1,power:POWER})))refinedPots++
 if(hit){pots++;continue}
 // did anything close by work?
 let found=null
 for(let d=-3;d<=3&&found==null;d+=.25){if(d&&ok(s.angle+d*Math.PI/180))found=d}
 if(found!=null){better++;nearMiss.push(found)}else worse++
}
console.log({tables:N,snapped,potRate:(pots/snapped).toFixed(2),refinedPotRate:(refinedPots/snapped).toFixed(2),missedButFixableNearby:better,missedNoFixNearby:worse,offsets:nearMiss.map(x=>+x.toFixed(2)).slice(0,30)})
