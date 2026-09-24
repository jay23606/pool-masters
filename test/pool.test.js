import test from 'node:test';import assert from 'node:assert/strict';import{PoolGame,shotSpeed,rayToRail,bankPath,aimStep,openingAim}from'../src/pool.js';import{rack}from'../src/rules.js'
test('a fresh rack is lined up for a one-click opening break',()=>{assert.ok(Math.abs(openingAim(rack()))<.001)})
test('power curve gives precise low power and a broad range',()=>{assert.ok(shotSpeed(10)<shotSpeed(50));assert.equal(shotSpeed(100),3200)})
test('guide reflects through two cushions',()=>{const p=bankPath(350,190,1,.25,2);assert.equal(p.length,2);assert.ok(Math.abs(p[0].x-663)<.1);assert.ok(Math.abs(p[1].y-343)<.1)})
test('ray stops at playable rail',()=>assert.equal(rayToRail(37,190,1,0),626))
test('aim rotation stays continuous across the angle boundary and through full circles',()=>{
 // sensitivity=.5 is the historical default this test was written against; the
 // wrapping math itself is what's under test here, not the current UI default
 let aim=0,previous=0
 for(const current of [Math.PI/2,Math.PI-.01,-Math.PI+.01,-Math.PI/2,0]){aim=aimStep(aim,previous,current,.5);previous=current}
 assert.ok(Math.abs(aim-Math.PI)<.02)
})
test('lower aim sensitivity turns the cue more slowly per drag step',()=>{
 const step=sensitivity=>aimStep(0,0,Math.PI/2,sensitivity)
 assert.ok(step(.1)<step(.3));assert.ok(step(.3)<step(.5))
})

test('an eight-ball pocket cannot be called while a group ball remains',()=>{
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{balls:[{on:true,k:'cue'},{on:true,k:'stripe'},{on:true,k:'eight'}],groups:{a:'stripe',b:'solid'},turn:'a',me:'a',phase:'aim',over:false})
 assert.equal(g.canCallEight(),false)
 g.balls[1].on=false
 assert.equal(g.canCallEight(),true)
})
