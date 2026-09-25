// Finds a shot that solves each drill, by searching with the real physics, and
// prints them as JSON. The hints in src/drills.js came from this; run it again
// after any change to the physics or to a layout:
//
//   node tools/solve-drills.mjs
//
// It prefers the most robust solution -- one that still works when the aim and
// power are nudged -- because a hint that only works to the last decimal place
// is fragile, and other browsers' maths is not bit-identical to this one's.
import {DRILLS,attempt} from '../src/drills.js'

const POWERS=[20,30,40,50,60,70,80,90,100]
const SPINS=[[0,0],[0,-.45],[0,.45],[.4,0],[-.4,0],[0,-.25],[0,.25]]
const NUDGES=[[0,0],[.003,0],[-.003,0],[.006,0],[-.006,0],[0,3],[0,-3],[.003,3],[-.003,-3]]

// How wide, in degrees, is the range of aims that still works around a shot?
// This is what a player actually feels: a window of 0.3 degrees is a lottery.
function windowDegrees(drill,shot){
 const ok=d=>attempt(drill,{...shot,angle:shot.angle+d*Math.PI/180}).ok
 let lo=0,hi=0
 while(lo>-4&&ok(lo-.05))lo-=.05
 while(hi<4&&ok(hi+.05))hi+=.05
 return Math.round((hi-lo+.05)*100)/100
}
const nudge=(shot,[da,dp])=>({...shot,angle:shot.angle+da,power:Math.max(5,Math.min(100,shot.power+dp))})
const robustness=(drill,shot)=>NUDGES.filter(n=>attempt(drill,nudge(shot,n)).ok).length/NUDGES.length

const only=process.argv[2]
const out={}
for(const drill of DRILLS){
 if(drill.random||(only&&drill.id!==only))continue
 const found=[]
 const degrees=drill.layout.rack?[...Array(21)].map((_,i)=>i-10):[...Array(360)].map((_,i)=>i)
 for(const deg of degrees)for(const power of POWERS)for(const spin of SPINS){
  const shot={angle:deg*Math.PI/180,power,spin}
  if(attempt(drill,shot).ok)found.push(shot)
 }
 if(!found.length){console.error(`UNSOLVABLE  ${drill.id}`);out[drill.id]=null;continue}
 // refine around each hit at finer angles, then rank by robustness
 let best=null
 const seen=new Set()
 for(const f of found){
  for(let d=-.9;d<=.9;d+=.3){
   const shot={...f,angle:f.angle+d*Math.PI/180}
   const key=`${shot.angle.toFixed(4)}|${shot.power}|${shot.spin}`
   if(seen.has(key))continue;seen.add(key)
   if(!attempt(drill,shot).ok)continue
   const r=robustness(drill,shot)
   const plain=(shot.spin[0]===0&&shot.spin[1]===0)?.01:0        // all else equal, no spin
   const mid=-Math.abs(shot.power-55)/10000                        // and a moderate power
   if(!best||r+plain+mid>best.score)best={score:r+plain+mid,robust:r,shot}
  }
 }
 const s=best.shot
 const win=windowDegrees(drill,s)
 out[drill.id]={angle:Math.round(s.angle*10000)/10000,power:s.power,spin:s.spin,robust:Math.round(best.robust*100),window:win,solutions:found.length}
 console.error(`${drill.id.padEnd(16)} ${String(found.length).padStart(3)} solutions | robust ${String(Math.round(best.robust*100)).padStart(3)}% | window ${String(win).padStart(5)}° | angle ${out[drill.id].angle} power ${s.power} spin ${s.spin}`)
}
console.log(JSON.stringify(out,null,1))
