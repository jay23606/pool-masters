import test from 'node:test';import assert from 'node:assert/strict'
import {loadTablePrefs,saveTablePrefs,FELTS} from '../src/preferences.js'

const memory=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),data}}
test('table preferences reject stale or invalid values',()=>{
 const p=loadTablePrefs({getItem:k=>({
  'pool-masters:table-size':'12','pool-masters:felt':'#bad',
  'pool-masters:cue':'neon','pool-masters:lighting':'laser','pool-masters:rails':'plastic'}[k]??null)})
 assert.deepEqual(p,{size:7,felt:FELTS.green,cue:'classic',rails:'walnut',lighting:'hall',aimSensitivity:.3,shotCam:true,snap:true,eyeHeight:46})
})
test('an out-of-range aim sensitivity falls back to the default rather than clamping silently',()=>{
 for(const bad of ['0','.05','1.4','not-a-number',null])
  assert.equal(loadTablePrefs({getItem:k=>k==='pool-masters:aim-sensitivity'?bad:null}).aimSensitivity,.3,`${bad} should fall back`)
 assert.equal(loadTablePrefs({getItem:k=>k==='pool-masters:aim-sensitivity'?'.65':null}).aimSensitivity,.65)
})
test('table preferences are normalized before persisting',()=>{
 const store=memory(),p=saveTablePrefs({size:9,felt:FELTS.blue,cue:'ebony',lighting:'warm'},store)
 assert.equal(p.size,9);assert.equal(store.getItem('pool-masters:cue'),'ebony')
})

test('the follow-the-shot camera is on unless the player turned it off, and only "0" turns it off',()=>{
 assert.equal(loadTablePrefs({getItem:()=>null}).shotCam,true)
 assert.equal(loadTablePrefs({getItem:k=>k==='pool-masters:shot-cam'?'0':null}).shotCam,false)
 for(const junk of ['1','','off','false','x'])assert.equal(loadTablePrefs({getItem:k=>k==='pool-masters:shot-cam'?junk:null}).shotCam,true)
 const store={};const st={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}}
 assert.equal(saveTablePrefs({...loadTablePrefs({getItem:()=>null}),shotCam:false},st).shotCam,false)
 assert.equal(store['pool-masters:shot-cam'],'0')
})

test('the shot camera height is kept in range and falls back to the default when it is not',()=>{
 const load=v=>loadTablePrefs({getItem:k=>k==='pool-masters:eye-height'?v:null}).eyeHeight
 assert.equal(load(null),46);assert.equal(load('90'),90);assert.equal(load('16'),16);assert.equal(load('160'),160)
 for(const bad of ['5','161','abc','','-3'])assert.equal(load(bad),46,bad)
 const store={};const st={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}}
 assert.equal(saveTablePrefs({...loadTablePrefs({getItem:()=>null}),eyeHeight:120},st).eyeHeight,120)
 assert.equal(store['pool-masters:eye-height'],120)
})
