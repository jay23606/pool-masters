import test from 'node:test';import assert from 'node:assert/strict'
import {grabs,pull,GRAB,DEAD,FULL} from '../src/pullback.js'

const cue={x:200,y:190}

test('a press near the cue ball starts a pull, one far from it does not',()=>{
 assert.ok(grabs(cue,{x:200+GRAB-1,y:190}))
 assert.ok(!grabs(cue,{x:200+GRAB+1,y:190}))
})

test('the shot goes opposite to the pull, along the line through the ball',()=>{
 // pulled to the left: shoot right
 assert.equal(pull(cue,{x:120,y:190}).angle,0)
 // pulled up the table: shoot down it
 assert.ok(Math.abs(pull(cue,{x:200,y:100}).angle-Math.PI/2)<1e-9)
 // pulled toward the bottom right: shoot up and to the left
 const a=pull(cue,{x:260,y:250}).angle
 assert.ok(Math.abs(a-Math.atan2(-60,-60))<1e-9)
})

test('power grows with the pull, from a tap to full, and never leaves 1..100',()=>{
 const at=d=>pull(cue,{x:200-d,y:190}).power
 assert.equal(at(FULL),100);assert.equal(at(FULL*3),100)
 assert.equal(at(FULL/2),50)
 assert.ok(at(DEAD)>=1&&at(DEAD)<15)
 assert.ok(at(60)>at(30))
})

test('a pull inside the dead zone is not armed, so letting go cancels it',()=>{
 assert.equal(pull(cue,{x:200-DEAD+1,y:190}).armed,false)
 assert.equal(pull(cue,{x:200,y:190}).armed,false)
 assert.equal(pull(cue,{x:200-DEAD,y:190}).armed,true)
})
