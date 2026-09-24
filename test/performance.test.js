import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyPerformance,recordPerformance} from '../src/performance.js'

test('performance tracks wins and losses by table size and only valid break runs',()=>{
 let stats=recordPerformance(emptyPerformance(),{won:true,breakRun:true,tableSize:7})
 stats=recordPerformance(stats,{won:false,breakRun:false,tableSize:7})
 stats=recordPerformance(stats,{won:true,breakRun:false,tableSize:9})
 assert.deepEqual(stats,{breakRuns:1,byTable:{7:{wins:1,losses:1},9:{wins:1,losses:0}}})
})
