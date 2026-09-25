import test from 'node:test';import assert from 'node:assert/strict'
import * as physics from '../src/physics.js'
import {CONSTANTS,GROUPS,valueOf,format,shotTable,tables,simulation,POWERS} from '../src/physics-info.js'

test('every numeric constant physics.js exports is described in the panel, so it cannot drift',()=>{
 const numeric=Object.entries(physics).filter(([,v])=>typeof v==='number').map(([k])=>k)
 for(const k of numeric)assert.ok(CONSTANTS.some(c=>c.key===k),`${k} is exported by physics.js but not described in physics-info.js`)
 for(const c of CONSTANTS)assert.equal(typeof physics[c.key],'number',`${c.key} is described but is not a number exported by physics.js`)
})

test('each description is complete and belongs to a known group',()=>{
 for(const c of CONSTANTS){assert.ok(c.name&&c.note&&GROUPS.includes(c.group),c.key);assert.equal(typeof c.unit,'string')}
 assert.equal(new Set(CONSTANTS.map(c=>c.key)).size,CONSTANTS.length,'no constant listed twice')
})

test('values are read live from the physics module, not copied',()=>{
 for(const c of CONSTANTS)assert.equal(valueOf(c),physics[c.key])
 assert.equal(valueOf(CONSTANTS.find(c=>c.key==='E_BALL')),.95)
})

test('numbers are shown without noise',()=>{
 assert.equal(format(2414),'2414');assert.equal(format(.22),'0.22');assert.equal(format(1/3),'0.333')
})

test('the shot table matches the real power curve and only ever rises',()=>{
 const t=shotTable()
 assert.deepEqual(t.map(r=>r.power),POWERS)
 t.forEach(r=>assert.equal(r.speed,physics.shotSpeed(r.power)))
 for(let i=1;i<t.length;i++)assert.ok(t[i].speed>t[i-1].speed)
 assert.ok(Math.abs(t[t.length-1].ms-13)<1,'a full-power shot is about 13 m/s')
})

test('the table sizes list the ball and pocket for each',()=>{
 const t=tables();assert.equal(t.length,3)
 assert.ok(t.every(r=>r.ball>0&&r.pocket>r.ball))
 assert.ok(simulation().every(r=>r.name&&r.value&&r.note))
})
