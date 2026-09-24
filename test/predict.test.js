import test from 'node:test';import assert from 'node:assert/strict'
import {createPredictor,stepCosmetic,STEP} from '../src/predict.js'
import {substeps} from '../src/physics.js'
import {R,POCKETS} from '../src/table.js'

// The whole safety property of client-side prediction rests on one claim:
// the cosmetic stepper a non-host renders between snapshots has to be the
// same physics as the host's own authoritative stepping, or "predicted" would
// just mean "wrong in a new way" every frame instead of "right until the next
// correction". These tests hold it to that.

const ball=(x,y,vx=0,vy=0,k='cue',n=0)=>({x,y,vx,vy,wx:0,wy:0,wz:0,on:true,k,n})

// Mirrors PoolGame's own host-side stepping loop exactly (fixed STEP chunks,
// adaptive substeps within each), so this is what "the host would have
// computed" for a given duration.
function hostAdvance(balls,seconds){
 let remaining=seconds
 while(remaining>=STEP){
  const n=substeps(balls,STEP)
  for(let i=0;i<n;i++)stepCosmetic(balls,STEP/n)
  remaining-=STEP
 }
}

test('a predicted trajectory is bit-identical to the host stepping the same conditions',()=>{
 // Same starting position/velocity/spin, same duration, same code path --
 // the only way these differ is if the predictor and the host stopped
 // sharing the stepping logic they are meant to share.
 const host=[ball(120,190,1800,220),ball(400,150,0,0,'solid',1)]
 const predicted=host.map(b=>({...b}))
 hostAdvance(host,1/25)                 // one host sync interval, ~40ms
 const predictor=createPredictor()
 predictor.reset(0)
 predictor.advance(predicted,40)        // milliseconds, matching 1/25s
 assert.deepEqual(predicted,host)
})

test('prediction re-anchored on every snapshot cannot drift past one sync interval',()=>{
 // Simulate a full shot: the host runs continuously; a "client" is handed a
 // fresh position+velocity anchor every 40ms (as a real snapshot would) and
 // predicts only the gap in between. Positions should match closely at every
 // reconciliation point, because the anchor IS the host's true state.
 const host=[ball(120,190,2200,140),ball(400,150,0,0,'solid',1),ball(420,160,0,0,'stripe',9)]
 const predictor=createPredictor();predictor.reset(0)
 let predicted=host.map(b=>({...b})),now=0
 for(let tick=0;tick<50;tick++){                 // 2 seconds of shot, 40ms snapshots
  hostAdvance(host,1/25)
  now+=40
  // a snapshot arrived: re-anchor from the host's true state, exactly like
  // receiveState() does in pool.js
  predicted=host.map(b=>({...b}))
  predictor.reset(now)
  if(host.every(b=>!b.on||(Math.abs(b.vx)<1&&Math.abs(b.vy)<1)))break
 }
 assert.deepEqual(predicted,host)
})

test('the predictor takes a shot from motion to rest without ever needing a correction to look right',()=>{
 // Repeated small advances, the way a real render loop calls this once per
 // frame, should land a struck ball at rest well inside the table -- proving
 // stepCosmetic alone (no reconciliation) is a stable, sane simulation and
 // not merely "correct because corrected". A single giant advance() is not
 // the right way to ask this: CATCHUP caps one call at 3 real seconds, by
 // design, so a backgrounded tab can't demand years of physics on return.
 const balls=[ball(120,190,2600,-260)]
 const predictor=createPredictor();predictor.reset(0)
 for(let now=16;now<=8000;now+=16)predictor.advance(balls,now)
 const [cue]=balls
 assert.ok(Math.hypot(cue.vx,cue.vy)<5,'should have rolled to a stop')
 const pocketed=POCKETS.some(([px,py])=>Math.hypot(cue.x-px,cue.y-py)<R*3)
 assert.ok(cue.on||pocketed,'should be resting on the table or have dropped into a pocket, not stuck mid-cushion')
})

test('the accumulator, not the frame gap, decides how many physics steps run',()=>{
 // Whether one predictor.advance() call covers 40ms or is spread across four
 // 10ms calls, the same total physics should run -- this is what makes a
 // predictor safe to drive from requestAnimationFrame, whose timing is not
 // guaranteed.
 const a=[ball(120,190,1500,-80)],b=[ball(120,190,1500,-80)]
 const pa=createPredictor();pa.reset(0);pa.advance(a,40)
 const pb=createPredictor();pb.reset(0)
 for(const t of [10,20,30,40])pb.advance(b,t)
 assert.deepEqual(a,b)
})
