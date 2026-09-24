import test from 'node:test'
import assert from 'node:assert/strict'
import {acceptsGameMessage} from '../src/room-security.js'

test('only the assigned guest can send a command to the host',()=>{
 assert.equal(acceptsGameMessage({isHost:true,from:'guest',seatB:'guest'}),true)
 assert.equal(acceptsGameMessage({isHost:true,from:'spectator',seatB:'guest'}),false)
 assert.equal(acceptsGameMessage({isHost:false,from:'host',seatB:'guest'}),true)
})
