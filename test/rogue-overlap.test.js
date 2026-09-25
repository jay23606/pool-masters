import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {newRun} from '../src/rogue.js'
import {R} from '../src/table.js'

const rogue=()=>{
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{mode:'8ball',run:newRun(5),rogueSeed:5,flash(){},sync(){},onRogue(){},potted:[],scratch:false,usedJump:false,phase:'roll'})
 g.balls=g.rogueRack();return g
}
const apart=balls=>{for(const a of balls)for(const b of balls)if(a!==b&&a.on&&b.on&&Math.hypot(a.x-b.x,a.y-b.y)<2*R-.01)return false;return true}

test('a new rogue table starts with the cue ball on the head spot, wherever the last one ended',()=>{
 const g=rogue();const cue=g.balls[0];cue.x=500;cue.y=300;cue.vx=50
 for(let level=2;level<=8;level++){
  g.run={...g.run,level:level-1};g.run=Object.assign({},g.run)
  g.rogueWait=true;g.pickUpgrade('shots')
  assert.deepEqual([g.balls[0].x,g.balls[0].y,g.balls[0].vx],[154,190,0])
  assert.ok(apart(g.balls),`table ${level}: no two balls overlap`)
  g.balls[0].x=400;g.balls[0].y=200
 }
})

test('a scratch puts the cue ball back on the head spot, or beside it when a ball is sitting there',()=>{
 const g=rogue();g.run={...g.run,shotsLeft:9}
 g.balls.slice(1).forEach((b,i)=>{if(i)b.on=true})
 g.balls[1].x=154;g.balls[1].y=190
 g.balls[0].on=false;g.scratch=true;g.potted=[g.balls[0]]
 g.resolveRogue()
 assert.equal(g.balls[0].on,true);assert.ok(apart(g.balls),'the cue ball is not on top of the ball on the spot')
})
