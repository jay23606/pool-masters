import test from 'node:test'
import assert from 'node:assert/strict'
import {MUSIC_PRESETS} from '../src/music.js'

test('Pool Masters Radio has a varied catalogue of original stations',()=>{
 assert.ok(MUSIC_PRESETS.length>=48)
 assert.equal(new Set(MUSIC_PRESETS.map(track=>track.name)).size,MUSIC_PRESETS.length)
 assert.ok(MUSIC_PRESETS.every(track=>track.lyric&&track.lead&&track.bpm>60&&track.bpm<130))
 assert.ok(new Set(MUSIC_PRESETS.map(track=>track.lead)).size>=4)
})
