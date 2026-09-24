import test from 'node:test'
import assert from 'node:assert/strict'
import {parseGameMessage,isGameMessage} from '../src/protocol.js'
import {freshRackState,snapshotOf,applySnapshot} from '../src/game-state.js'

test('a rack has stable, unique ball identities',()=>{
 const s=freshRackState(),ids=s.balls.map(b=>b.id)
 assert.equal(new Set(ids).size,16)
 assert.deepEqual(ids.sort((a,b)=>a-b),Array.from({length:16},(_,i)=>i))
})

test('a snapshot round-trips only authoritative state',()=>{
 const source={...freshRackState(),round:4,assignment:{player:'a',ball:3,group:'solid'}}
 const target={round:1};applySnapshot(target,snapshotOf(source))
 assert.equal(target.round,4);assert.equal(target.balls[3].id,target.balls[3].n)
 assert.deepEqual(target.assignment,source.assignment)
})

test('network protocol rejects malformed state and accepts valid snapshots',()=>{
 const good=snapshotOf({...freshRackState(),round:1})
 assert.equal(isGameMessage(good),true)
 assert.deepEqual(parseGameMessage(JSON.stringify(good)),good)
 assert.equal(parseGameMessage('{bad json'),null)
 assert.equal(isGameMessage({...good,b:[[0,0,true,'bogus',1]]}),false)
 assert.equal(isGameMessage({...good,b:good.b.map((b,i)=>i?b:[...b.slice(0,4),9])}),false)
 assert.equal(isGameMessage({...good,b:good.b.slice(1)}),false)
 assert.equal(isGameMessage({t:'shot',vx:'fast',vy:0}),false)
})

test('a snapshot carries velocity and spin, not just position, and applySnapshot restores it',()=>{
 const source={...freshRackState(),round:1}
 source.balls[1].vx=812.4;source.balls[1].vy=-93.1;source.balls[1].wz=6.3
 const s=snapshotOf(source)
 assert.equal(s.b[1].length,10,'a ball tuple should carry position plus motion')
 assert.equal(s.v,2)
 const target={};applySnapshot(target,s)
 assert.equal(target.balls[1].vx,812.4);assert.equal(target.balls[1].vy,-93.1);assert.equal(target.balls[1].wz,6.3)
 assert.equal(target.balls[0].vx,0,'a ball with no motion should round-trip as no motion, not undefined')
})

test('a legacy position-only ball tuple is still accepted, and reads as motionless',()=>{
 const s=snapshotOf({...freshRackState(),round:1})
 const legacy={...s,v:1,b:s.b.map(b=>b.slice(0,5))}
 assert.equal(isGameMessage(legacy),true,'a stale tab from before this change must not be locked out mid-deploy')
 const target={};applySnapshot(target,legacy)
 assert.equal(target.balls[0].vx,0);assert.equal(target.balls[0].wz,0)
})

test('a motion field that is not a finite number is rejected, not silently coerced',()=>{
 const s=snapshotOf({...freshRackState(),round:1})
 const bad={...s,b:s.b.map((b,i)=>i?b:[...b.slice(0,5),'fast',0,0,0,0])}
 assert.equal(isGameMessage(bad),false)
})
