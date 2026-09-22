import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike} from '../src/physics.js'

// A bare game with the simulation wired up but nothing else: advance() is the
// only thing under test.
function rolling(){
 const g=Object.create(PoolGame.prototype)
 const ball=(x,y,k,n)=>({x,y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k,n})
 g.balls=[ball(120,190,'cue',0),ball(400,150,'solid',1),ball(430,240,'solid',2),ball(520,190,'stripe',9)]
 Object.assign(g,{host:true,me:'a',turn:'a',groups:{a:null,b:null},over:false,round:1,
  calledPocket:null,ballInHand:false,practice:false})
 g.flash=()=>{};g.sync=()=>{};g.onFinish=()=>{}
 g.resolve=function(){this.phase='aim'}
 g.startShot()
 strike(g.balls[0],2100,140,.2,-.3)
 return g
}
const run=(g,slice)=>{let now=0
 for(let i=0;i<4000&&g.phase==='roll';i++){now+=slice;g.advance(now)}
 return g}
const snap=g=>g.balls.map(b=>[Math.round(b.x*100)/100,Math.round(b.y*100)/100,b.on])

test('a shot comes out the same however the frames fall',()=>{
 const smooth=run(rolling(),1000/60)
 const fast=run(rolling(),1000/240)
 assert.deepEqual(snap(smooth),snap(fast))
})

test('a host whose tab stalls still gets the same result, just in fewer chunks',()=>{
 const smooth=run(rolling(),1000/60)
 const stalled=run(rolling(),1000)       // one update per second, as a hidden tab gets
 assert.equal(stalled.phase,'aim','the shot must still finish')
 assert.deepEqual(snap(stalled),snap(smooth))
})

test('an irregular, jittery frame rate changes nothing',()=>{
 const smooth=run(rolling(),1000/60)
 const jittery=rolling();let now=0
 for(let i=0;i<4000&&jittery.phase==='roll';i++){now+=[4,60,9,250,16,700][i%6];jittery.advance(now)}
 assert.deepEqual(snap(jittery),snap(smooth))
})

test('time is not invented when nothing is rolling',()=>{
 const g=rolling();g.phase='aim'
 const before=snap(g)
 g.advance(0);g.advance(5000)
 assert.deepEqual(snap(g),before)
})
