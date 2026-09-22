import test from 'node:test';import assert from 'node:assert/strict'
import {loadTablePrefs,saveTablePrefs,FELTS} from '../src/preferences.js'

const memory=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),data}}
test('table preferences reject stale or invalid values',()=>{
 const p=loadTablePrefs({getItem:k=>({
  'pool-masters:table-size':'12','pool-masters:felt':'#bad',
  'pool-masters:cue':'gold','pool-masters:lighting':'laser'}[k]??null)})
 assert.deepEqual(p,{size:7,felt:FELTS.green,cue:'classic',lighting:'hall'})
})
test('table preferences are normalized before persisting',()=>{
 const store=memory(),p=saveTablePrefs({size:9,felt:FELTS.blue,cue:'ebony',lighting:'warm'},store)
 assert.equal(p.size,9);assert.equal(store.getItem('pool-masters:cue'),'ebony')
})
