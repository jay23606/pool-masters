import test from 'node:test'
import assert from 'node:assert/strict'
import {roomOccupancy,occupancyLabel} from '../src/room-summary.js'

test('lobby occupancy does not count spectators as players',()=>{
 const room={playerCount:5,metadata:{seats:{a:'host',b:'guest'},spectators:['one','two']}}
 assert.deepEqual(roomOccupancy(room),{players:2,spectators:2})
 assert.equal(occupancyLabel(room),'2/2 players · 2 spectators')
 assert.equal(occupancyLabel({playerCount:0,metadata:{}}),'0/2 players')
})
