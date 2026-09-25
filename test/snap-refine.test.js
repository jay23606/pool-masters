import test from 'node:test';import assert from 'node:assert/strict'
import {snapAim,refineAim} from '../src/snap.js'
import {rollout} from '../src/ai.js'
import {POCKETS,R,setTableSize} from '../src/table.js'
import {kind} from '../src/rules.js'
setTableSize(7)

const rng=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const ball=(n,x,y)=>({id:n,n,x,y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:n?kind(n):'cue'})
const pots=(balls,a,power)=>{const r=rollout(balls,a,power,8,[0,0]);return !r.scratch&&r.potted.includes(1)}

// tables where the snap has something to aim at, found the same way every time
function snapped(count,power=55){
 const out=[]
 for(let seed=1;out.length<count&&seed<2000;seed++){
  const r=rng(seed),p=()=>[60+r()*580,60+r()*260],c=p(),o=p()
  if(Math.hypot(c[0]-o[0],c[1]-o[1])<60)continue
  const balls=[ball(0,...c),ball(1,...o)],k=POCKETS[Math.floor(r()*6)]
  const u=[k[0]-o[0],k[1]-o[1]],m=Math.hypot(...u),g=[o[0]-u[0]/m*2*R,o[1]-u[1]/m*2*R]
  const s=snapAim(balls,Math.atan2(g[1]-c[1],g[0]-c[0])+(r()-.5)*4*Math.PI/180)
  if(s.pocket!=null)out.push({balls,angle:s.angle,power})
 }
 return out
}

test('the physics check rescues aims the geometry gets wrong, and never makes a working one worse',()=>{
 const cases=snapped(40);let missed=0,rescued=0
 assert.ok(cases.length>=30)
 for(const {balls,angle,power} of cases){
  const before=pots(balls,angle,power),after=pots(balls,refineAim(balls,angle,{target:1,power}),power)
  if(before)assert.equal(after,true,'a working aim stays working')
  else{missed++;if(after)rescued++}
 }
 assert.ok(missed>=5,`there were misses to fix (${missed})`)
 assert.ok(rescued>=missed*.6,`rescued ${rescued} of ${missed}`)
})

test('it moves the aim only a little, and returns the aim untouched when it has nothing to check',()=>{
 for(const {balls,angle,power} of snapped(15)){
  const a=refineAim(balls,angle,{target:1,power})
  assert.ok(Math.abs(a-angle)<=2.5*Math.PI/180+1e-9,'within the range')
 }
 const {balls,angle}=snapped(1)[0]
 assert.equal(refineAim(balls,angle,{target:null,power:50}),angle);assert.equal(refineAim(balls,angle,{target:1,power:0}),angle)
 // nothing pots: a ball with no line to any pocket keeps the geometric aim
 const shut=[ball(0,150,190),ball(1,350,190),ball(2,350,215),ball(3,350,165)]
 assert.equal(refineAim(shut,0,{target:1,power:50,range:.5}),0)
})

test('it picks the middle of the widest window, so there is room for error either side',()=>{
 for(const {balls,angle,power} of snapped(30)){
  const a=refineAim(balls,angle,{target:1,power});if(a===angle&&!pots(balls,angle,power))continue
  const d=.25*Math.PI/180
  if(pots(balls,a,power)&&pots(balls,a+d,power)&&pots(balls,a-d,power))return
 }
 assert.fail('no refined aim had a shot that works a quarter of a degree either side')
})
