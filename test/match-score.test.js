import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyScore,scoreRack,scoreLine} from '../src/match-score.js'

test('session score advances only for a valid table side',()=>{
 const start=emptyScore(),after=scoreRack(start,'a')
 assert.deepEqual(start,{a:0,b:0})
 assert.deepEqual(after,{a:1,b:0})
 assert.equal(scoreLine(scoreRack(after,'b'),'a','Nikki','Coach'),'Nikki 1 — 1 Coach')
 assert.deepEqual(scoreRack(after,'spectator'),after)
})
