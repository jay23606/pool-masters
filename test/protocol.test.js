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
 assert.equal(isGameMessage({t:'shot',vx:'fast',vy:0}),false)
})
