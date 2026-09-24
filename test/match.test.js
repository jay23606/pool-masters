import test from 'node:test'
import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {freshRackState,snapshotOf,applySnapshot} from '../src/game-state.js'

const make=()=>{
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,freshRackState(),{round:1,me:'a',host:true,practice:false,ready:true})
 g.flash=()=>{};g.sync=()=>{};g.onFinish=()=>{};g.setSpin=()=>{}
 return g
}
const play=(g,n)=>{
 const b=g.balls.find(x=>x.n===n);g.startShot();g.firstHit=b;g.firstObjectPotted=b;g.potted=[b];b.on=false
 if(n===8)g.eightPocket=2
 g.resolve()
}

test('a complete rack preserves rules through state transfer and rematch',()=>{
 const g=make()
 // Break pots a solid but correctly leaves the table open.
 play(g,1);assert.equal(g.group('a'),null);assert.equal(g.breakShot,false)
 // First post-break pocket claims stripes for player a.
 play(g,9);assert.equal(g.group('a'),'stripe');assert.equal(g.group('b'),'solid')
 const guest={round:0};applySnapshot(guest,snapshotOf(g));assert.equal(guest.groups.a,'stripe')
 assert.equal(guest.balls.find(b=>b.n===9).on,false)
 for(const n of [10,11,12,13,14,15])play(g,n)
 assert.equal(g.remaining('stripe'),0);assert.equal(g.canCallEight(),true)
 g.calledPocket=2;play(g,8)
 assert.equal(g.over,true);assert.equal(g.result,'a')
 g.newRack();assert.equal(g.over,false);assert.equal(g.groups.a,null);assert.equal(g.balls.filter(b=>b.on).length,16)
})
