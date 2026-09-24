import test from 'node:test'
import assert from 'node:assert/strict'
import {winnerForResult} from '../src/ranking.js'

test('ranked result maps the winning table side to its profile',()=>{
 assert.equal(winnerForResult({winner:'a',round:1},true,'host','guest'),'host')
 assert.equal(winnerForResult({winner:'b',round:1},true,'host','guest'),'guest')
 assert.equal(winnerForResult({winner:'a',round:1},false,'guest','host'),'host')
 assert.equal(winnerForResult({winner:'b',round:1},false,'guest','host'),'guest')
})
