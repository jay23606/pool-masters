import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'

test('a fresh host state starts a playable rematch on the guest',()=>{
 let racks=0
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{host:false,round:1,ready:false,finished:true,groups:{a:'solid',b:'stripe'},onRack:()=>racks++,onFinish:()=>{}})
 g.receiveState({t:'state',round:2,turn:'a',phase:'aim',over:false,result:'',groups:{a:null,b:null},breakShot:true,ballInHand:false,calledPocket:null,b:[[154,190,true,'cue',0],[420,190,true,'solid',1],[436,190,true,'stripe',9],[452,190,true,'eight',8]]})
 assert.equal(g.ready,true)
 assert.equal(g.finished,false)
 assert.equal(racks,1)
 assert.equal(g.over,false)
})

test('a next-rack request is host-authoritative',()=>{
 const g=Object.create(PoolGame.prototype);let started=0
 Object.assign(g,{host:true,newRack:()=>started++})
 g.receive({t:'next-rack'})
 assert.equal(started,1)
})

test('a called eight-ball pocket survives while the shot is rolling',()=>{
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{calledPocket:4,phase:'roll',canCallEight:()=>false})
 g.clearInvalidCall()
 assert.equal(g.calledPocket,4)
 g.phase='aim';g.clearInvalidCall()
 assert.equal(g.calledPocket,null)
})

test('legacy plural group names cannot make a stripe disappear from the count',()=>{
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{balls:[{on:true,k:'cue'},{on:true,k:'stripe'},{on:true,k:'eight'}],groups:{a:'stripes',b:'solids'},turn:'a',me:'a',phase:'aim',over:false})
 assert.equal(g.group(),'stripe')
 assert.equal(g.remaining(g.group()),1)
 assert.equal(g.canCallEight(),false)
})
