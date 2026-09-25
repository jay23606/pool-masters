// How often can one shot clear a small table? (experiment for tools/gen-tricks.mjs)
import {rollout} from '../src/ai.js'
import {POCKETS,R,W,H,setTableSize} from '../src/table.js'
import {kind} from '../src/rules.js'
setTableSize(7)
const rng=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const ball=(n,x,y)=>({id:n,n,x,y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:n?kind(n):'cue'})
const K=Number(process.argv[2])||2,LAYOUTS=Number(process.argv[3])||200
let found=0,t0=Date.now(),best={}
for(let seed=1;seed<=LAYOUTS;seed++){
 const r=rng(seed*977+K)
 const pos=[]
 const place=(x,y)=>{if(x<60||x>640||y<60||y>320)return null;if(pos.every(q=>Math.hypot(q[0]-x,q[1]-y)>R*3)&&POCKETS.every(k=>Math.hypot(k[0]-x,k[1]-y)>R*5))return [x,y];return null}
 const cue=[80+r()*540,80+r()*220];pos.push(cue)
 const balls=[]
 for(let n=1;n<=K;n++){
  let p=null
  for(let t=0;t<60&&!p;t++){const k=POCKETS[Math.floor(r()*6)],d=70+r()*170,a=Math.atan2(190-k[1],350-k[0])+(r()-.5)*1.6;p=place(k[0]+Math.cos(a)*d,k[1]+Math.sin(a)*d)}
  if(!p)break;pos.push(p);balls.push(ball(n,Math.round(p[0]),Math.round(p[1])))
 }
 if(balls.length<K)continue
 const table=[ball(0,Math.round(cue[0]),Math.round(cue[1])),...balls]
 let top=0
 for(let deg=0;deg<360;deg+=.5)for(const power of [40,60,80,100]){
  const out=rollout(table,deg*Math.PI/180,power,10,[0,0])
  if(out.scratch)continue
  if(out.potted.length>top)top=out.potted.length
  if(top===K)break
 }
 best[top]=(best[top]||0)+1
 if(top===K)found++
}
console.log({K,LAYOUTS,found,best,secs:((Date.now()-t0)/1000).toFixed(0)})
