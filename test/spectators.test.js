import test from 'node:test'
import assert from 'node:assert/strict'
import {spectatorMeta,roleFor,reconcileSpectators,admitSpectator,removeSpectator} from '../src/spectators.js'

const players=(...xs)=>xs.map(([id,poolRole])=>({id,state:{poolRole}}))
test('the host assigns the second player seat and queues spectators',()=>{
 const meta=reconcileSpectators(spectatorMeta('host'),players(['host','player'],['guest','player'],['watcher','spectator']))
 assert.equal(roleFor(meta,'guest'),'player')
 assert.deepEqual(meta.spectatorRequests,['watcher'])
 assert.equal(roleFor(admitSpectator(meta,'watcher'),'watcher'),'spectator')
})
test('the host can remove an admitted spectator',()=>{
 const meta=admitSpectator({...spectatorMeta('host'),spectatorRequests:['watcher']},'watcher')
 assert.equal(roleFor(removeSpectator(meta,'watcher'),'watcher'),'pending')
})
test('departed guests free their seat and spectator admission is host-owned metadata',()=>{
 const meta={...spectatorMeta('host'),seats:{a:'host',b:'guest'},spectators:['watcher'],spectatorRequests:['waiting']}
 const next=reconcileSpectators(meta,players(['host','player'],['waiting','spectator']))
 assert.equal(next.seats.b,null)
 assert.deepEqual(next.spectators,[])
 assert.deepEqual(next.spectatorRequests,['waiting'])
})
