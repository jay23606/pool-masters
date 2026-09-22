import test from 'node:test';import assert from 'node:assert/strict'
import {integrate,strike,ballCollide,railBounce,substeps,slipSpeed,speed,setRolling} from '../src/physics.js'
import {R,MAXX} from '../src/table.js'

const ball=(x,y,k='cue')=>({x,y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k,n:k==='cue'?0:1})
const touching=(x,y)=>ball(x+2*R-.4,y,'solid')   // just inside contact range

// Run the same fixed-step loop the game runs, so the tests exercise the real
// substep count rather than a convenient one.
function run(balls,seconds,dt=1/60){
 for(let t=0;t<seconds;t+=dt){
  const n=substeps(balls,dt)
  for(let s=0;s<n;s++){
   for(const b of balls){integrate(b,dt/n);railBounce(b)}
   for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++)ballCollide(balls[i],balls[j])
  }
 }
 return balls
}

test('a centre-ball hit that meets the object ball while still skidding stops dead',()=>{
 const cue=ball(100,190),obj=touching(100,190)
 strike(cue,1000,0)
 assert.ok(ballCollide(cue,obj))
 assert.ok(cue.vx<40,`cue kept ${cue.vx}`)
 assert.ok(obj.vx>900,`object ball only got ${obj.vx}`)
 run([cue],.6)
 assert.ok(Math.abs(cue.x-100)<12,`stun ball drifted to ${cue.x}`)
})

test('a rolling cue ball follows through after a full hit',()=>{
 const cue=ball(100,190),obj=touching(100,190)
 cue.vx=1000;setRolling(cue)
 ballCollide(cue,obj)
 run([cue],.35)
 assert.ok(cue.vx>100,`expected follow, got vx=${cue.vx}`)
})

test('backspin draws the cue ball back',()=>{
 const cue=ball(300,190),obj=touching(300,190)
 strike(cue,1000,0,0,-.4)
 ballCollide(cue,obj)
 run([cue],.45)
 assert.ok(cue.vx<-50,`expected draw, got vx=${cue.vx}`)
 assert.ok(cue.x<300,`cue ended at ${cue.x}, should be behind where it was struck`)
})

test('English throws the object ball off the line of centres',()=>{
 const plain=ball(100,190),spun=ball(100,190)
 const hitPlain=touching(100,190),hitSpun=touching(100,190)
 strike(plain,1000,0)
 strike(spun,1000,0,.5)                       // right-hand English
 ballCollide(plain,hitPlain);ballCollide(spun,hitSpun)
 assert.equal(hitPlain.vy,0,'a centre hit sends it straight down the line')
 assert.ok(hitSpun.vy>1,`expected throw, got vy=${hitSpun.vy}`)
 assert.ok(spun.wz>0,'some English survives the collision')
})

test('a struck ball skids, then grips and rolls',()=>{
 const b=ball(60,190)
 strike(b,900,0)
 assert.ok(slipSpeed(b)>100,'a centre hit starts out skidding')
 run([b],.6)
 assert.ok(slipSpeed(b)<5,`still skidding after 0.6s: ${slipSpeed(b)}`)
 run([b],.2)
 assert.ok(slipSpeed(b)<5,'a rolling ball should not spontaneously start skidding')
 assert.ok(speed(b)>0,'and should still be moving')
})

test('the result does not depend on the host frame rate',()=>{
 const mk=()=>{const b=ball(60,190);strike(b,1400,0,0,.2);return b}
 const slow=mk(),fast=mk()
 run([slow],1.5,1/60)
 run([fast],1.5,1/240)
 assert.ok(Math.abs(slow.x-fast.x)<6,`60Hz ended at ${slow.x}, 240Hz at ${fast.x}`)
 assert.ok(Math.abs(speed(slow)-speed(fast))<25)
})

test('cushions absorb more of a hard impact than a soft one',()=>{
 const soft=ball(MAXX+1,190),hard=ball(MAXX+1,190)
 soft.vx=300;hard.vx=2600
 setRolling(soft);setRolling(hard)
 railBounce(soft);railBounce(hard)
 const softE=-soft.vx/300,hardE=-hard.vx/2600
 assert.ok(softE>0&&softE<1,`soft rebound ${softE}`)
 assert.ok(hardE>0&&hardE<1,`hard rebound ${hardE}`)
 assert.ok(softE>hardE,`soft ${softE} should keep more than hard ${hardE}`)
})

test('English changes the rebound angle off a cushion',()=>{
 const plain=ball(MAXX+1,190),spun=ball(MAXX+1,190)
 for(const b of [plain,spun]){b.vx=900;b.vy=300;setRolling(b)}
 spun.wz=60
 railBounce(plain);railBounce(spun)
 assert.ok(Math.abs(spun.vy-plain.vy)>5,`plain ${plain.vy} vs spun ${spun.vy}`)
})
