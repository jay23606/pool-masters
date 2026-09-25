import test from 'node:test';import assert from 'node:assert/strict'
import {shotPose,stepBlend,smooth,BEHIND,LOOK_AHEAD,HEIGHT,IN_SECONDS,OUT_SECONDS,MIN_SPEED} from '../src/shot-cam.js'

test('the eye sits behind the cue ball on the line of the shot, looking down it',()=>{
 const p=shotPose({x:200,y:190},{x:300,y:0})
 assert.deepEqual(p.eye,{x:200-BEHIND,y:HEIGHT,z:190})
 assert.deepEqual(p.look,{x:200+LOOK_AHEAD,y:6,z:190})
 // a diagonal shot: still exactly BEHIND away, straight back along the shot
 const q=shotPose({x:300,y:200},{x:30,y:40})
 assert.ok(Math.abs(Math.hypot(q.eye.x-300,q.eye.z-200)-BEHIND)<1e-9)
 assert.ok(Math.abs((q.eye.x-300)/(q.eye.z-200)-30/40)<1e-9)
})

test('the size of the velocity does not matter, only its direction',()=>{
 const a=shotPose({x:100,y:100},{x:6,y:6}),b=shotPose({x:100,y:100},{x:900,y:900})
 for(const k of ['eye','look'])for(const c of ['x','y','z'])assert.ok(Math.abs(a[k][c]-b[k][c])<1e-9)
})

test('a cue ball that is not really moving gives no pose',()=>{
 assert.equal(shotPose({x:1,y:1},{x:0,y:0}),null)
 assert.equal(shotPose({x:1,y:1},{x:MIN_SPEED-1,y:0}),null)
 assert.equal(shotPose({x:1,y:1},{x:NaN,y:3}),null)
})

test('the blend eases in to 1 and back out to 0, and never leaves that range',()=>{
 let b=0;for(let i=0;i<200;i++)b=stepBlend(b,true,IN_SECONDS/100);assert.equal(b,1)
 assert.ok(Math.abs(stepBlend(0,true,IN_SECONDS/2)-.5)<1e-9)
 for(let i=0;i<200;i++)b=stepBlend(b,false,OUT_SECONDS/100);assert.equal(b,0)
 assert.equal(stepBlend(0,false,1),0);assert.equal(stepBlend(1,true,1),1)
 assert.equal(smooth(0),0);assert.equal(smooth(1),1);assert.equal(smooth(.5),.5)
})
