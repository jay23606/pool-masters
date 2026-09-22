import test from 'node:test';import assert from 'node:assert/strict';import{shotSpeed,rayToRail,bankPath}from'../src/pool.js'
test('power curve gives precise low power and a broad range',()=>{assert.ok(shotSpeed(10)<shotSpeed(50));assert.equal(shotSpeed(100),3200)})
test('guide reflects through two cushions',()=>{const p=bankPath(350,190,1,.25,2);assert.equal(p.length,2);assert.ok(Math.abs(p[0].x-663)<.1);assert.ok(Math.abs(p[1].y-343)<.1)})
test('ray stops at playable rail',()=>assert.equal(rayToRail(37,190,1,0),626))
