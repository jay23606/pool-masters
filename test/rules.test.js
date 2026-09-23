import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'

// Characterisation tests: these pin down what resolve() already does, so the
// split that follows can be shown not to change any of it.
const ball=(k,n)=>({x:300,y:190,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k,n})
function shot(o){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{
  balls:o.balls||[ball('cue',0),ball('solid',1),ball('stripe',9),ball('eight',8)],
  groups:o.groups||{a:null,b:null},turn:o.turn||'a',me:'a',phase:'roll',over:false,result:'',
  finished:false,round:1,practice:false,ballInHand:false,placed:false,
  breakShot:!!o.breakShot,potted:o.potted||[],firstObjectPotted:o.firstObjectPotted??null,scratch:!!o.scratch,firstHit:o.firstHit===undefined?(o.potted||[]).find(b=>b.k!=='cue')||null:o.firstHit,
  before:o.before??null,calledPocket:o.calledPocket??null,eightPocket:o.eightPocket??null})
 g.flash=()=>{};g.sync=()=>{};g.onFinish=()=>{}
 g.resolve()
 return g
}

test('a break that drops one group keeps the table open, and the shooter carries on',()=>{
 const g=shot({breakShot:true,potted:[ball('solid',1)]})
 assert.equal(g.groups.a,null);assert.equal(g.groups.b,null)
 assert.equal(g.turn,'a','potting an object ball keeps you at the table')
})

test('dropping one of each leaves the table open and you stay at it',()=>{
 const g=shot({breakShot:true,potted:[ball('solid',1),ball('stripe',9)]})
 assert.equal(g.groups.a,null);assert.equal(g.groups.b,null)
 assert.equal(g.turn,'a','you potted something, so you keep shooting')
})

test('on an open table after the break, the first ball down decides the groups',()=>{
 const g=shot({potted:[ball('solid',2),ball('stripe',11)],firstObjectPotted:ball('stripe',11)})
 assert.equal(g.groups.a,'stripe');assert.equal(g.groups.b,'solid')
 assert.deepEqual(g.assignment,{player:'a',ball:11,group:'stripe'})
 assert.equal(g.turn,'a')
})

test('potting nothing passes the turn',()=>{
 const g=shot({groups:{a:'solid',b:'stripe'},before:3,firstHit:ball('solid',2)})
 assert.equal(g.turn,'b')
})

test('potting one of your own keeps the turn',()=>{
 const g=shot({groups:{a:'solid',b:'stripe'},before:3,firstHit:ball('solid',2),potted:[ball('solid',2)]})
 assert.equal(g.turn,'a')
})

test('a scratch is a foul: turn passes with ball in hand',()=>{
 const g=shot({groups:{a:'solid',b:'stripe'},before:3,scratch:true,firstHit:ball('solid',2),
               potted:[ball('solid',2)],calledPocket:3})
 assert.equal(g.turn,'b')
 assert.equal(g.ballInHand,true)
 assert.equal(g.calledPocket,null,'a foul clears any called pocket')
 assert.equal(g.balls[0].on,true,'the cue ball comes back')
})

test('hitting the wrong group first is a foul even if you pot your own',()=>{
 const g=shot({groups:{a:'solid',b:'stripe'},before:3,firstHit:ball('stripe',9),potted:[ball('solid',2)]})
 assert.equal(g.turn,'b');assert.equal(g.ballInHand,true)
})

test('potting the eight with your group cleared and the pocket called wins',()=>{
 const g=shot({groups:{a:'solid',b:'stripe'},before:0,firstHit:ball('eight',8),
               potted:[ball('eight',8)],calledPocket:2,eightPocket:2})
 assert.equal(g.over,true);assert.equal(g.result,'a')
})

test('potting the eight into a pocket you did not call loses',()=>{
 const g=shot({groups:{a:'solid',b:'stripe'},before:0,firstHit:ball('eight',8),
               potted:[ball('eight',8)],calledPocket:2,eightPocket:5})
 assert.equal(g.over,true);assert.equal(g.result,'b')
})

test('potting the eight while you still have balls loses',()=>{
 const g=shot({groups:{a:'solid',b:'stripe'},before:2,firstHit:ball('solid',2),
               potted:[ball('eight',8)],calledPocket:2,eightPocket:2})
 assert.equal(g.over,true);assert.equal(g.result,'b')
})

test('scratching while potting the eight loses even when it was legal otherwise',()=>{
 const g=shot({groups:{a:'solid',b:'stripe'},before:0,scratch:true,firstHit:ball('eight',8),
               potted:[ball('eight',8)],calledPocket:2,eightPocket:2})
 assert.equal(g.result,'b')
})

test('a later solid pocket cannot reassign a player who owns stripes',()=>{
 const g=shot({groups:{a:'stripe',b:'solid'},before:3,firstHit:ball('stripe',9),potted:[ball('solid',2)]})
 assert.equal(g.groups.a,'stripe')
 assert.equal(g.groups.b,'solid')
 assert.equal(g.turn,'b')
})

test('when the AI claims stripes, the human is assigned solids',()=>{
 const g=shot({turn:'b',potted:[ball('stripe',11)],firstObjectPotted:ball('stripe',11)})
 assert.equal(g.groups.b,'stripe')
 assert.equal(g.groups.a,'solid')
})

test('missing every object ball is a foul',()=>{
 const g=shot({groups:{a:'solid',b:'stripe'},before:3,firstHit:null})
 assert.equal(g.turn,'b');assert.equal(g.ballInHand,true)
})

test('scratching while playing the eight loses even when it stays up',()=>{
 const g=shot({groups:{a:'solid',b:'stripe'},before:0,scratch:true,firstHit:ball('eight',8),
               potted:[],calledPocket:2})
 assert.equal(g.over,true)
 assert.equal(g.result,'b')
})

test('the eight on the break wins, and is not treated as an early eight',()=>{
 const g=shot({breakShot:true,potted:[ball('eight',8)],eightPocket:1})
 assert.equal(g.over,true);assert.equal(g.result,'a')
})

test('the break flag is cleared and motion stops once a shot is judged',()=>{
 const g=shot({breakShot:true,potted:[ball('solid',1)]})
 assert.equal(g.breakShot,false)
 assert.equal(g.phase,'aim')
 assert.ok(g.balls.every(b=>b.vx===0&&b.vy===0&&b.wz===0))
})

test('mixed pots use the first ball to fall, never rack-array order',()=>{
 const solid=ball('solid',1),stripe=ball('stripe',9)
 const g=shot({potted:[solid,stripe],firstObjectPotted:stripe})
 assert.equal(g.groups.a,'stripe')
 assert.equal(g.groups.b,'solid')
 assert.equal(g.turn,'a')
})

test('the group you get does not depend on the order balls are listed',()=>{
 const one=shot({potted:[ball('solid',1),ball('solid',2)]})
 const two=shot({potted:[ball('solid',2),ball('solid',1)]})
 assert.equal(one.groups.a,'solid');assert.equal(two.groups.a,'solid')
})
