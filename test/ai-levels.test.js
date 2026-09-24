import test from 'node:test'
import assert from 'node:assert/strict'
import {AI_LEVELS,difficultyFor} from '../src/ai.js'

test('AI difficulties progress from forgiving to precise',()=>{
 assert.equal(difficultyFor('unknown'),AI_LEVELS.league)
 assert.ok(AI_LEVELS.beginner.aimError>AI_LEVELS.league.aimError)
 assert.ok(AI_LEVELS.league.aimError>AI_LEVELS.pro.aimError)
 assert.ok(AI_LEVELS.beginner.safetyCut>AI_LEVELS.pro.safetyCut)
})