import test from 'node:test';import assert from 'node:assert/strict'
import {COSMETICS,FELTS,CUE_STYLES,RAIL_STYLES,DEFAULTS,ofKind,find,isUnlocked,trophyFor,rewardsOf,label,usable} from '../src/cosmetics.js'
import {TROPHIES} from '../src/trophies.js'
import {loadTablePrefs,saveTablePrefs,FELTS as PREF_FELTS} from '../src/preferences.js'

test('everything a player could choose before is still free',()=>{
 for(const [kind,keys] of [['cue',['classic','ebony','midnight']],['felt',['green','blue','burgundy','charcoal']],['rails',['walnut']]])
  for(const k of keys)assert.equal(find(kind,k).trophy,undefined,`${kind} ${k} must stay free`)
 for(const d of ['cue','felt','rails'])assert.equal(find(d,DEFAULTS[d]).trophy,undefined,'a default must be free')
})

test('every choice has a palette, and every palette entry is a choice',()=>{
 const keys=kind=>ofKind(kind).map(c=>c.key).sort()
 assert.deepEqual(keys('cue'),Object.keys(CUE_STYLES).sort())
 assert.deepEqual(keys('felt'),Object.keys(FELTS).sort())
 assert.deepEqual(keys('rails'),Object.keys(RAIL_STYLES).sort())
 assert.equal(PREF_FELTS,FELTS,'preferences and cosmetics share one felt list')
 for(const c of Object.values(CUE_STYLES))assert.ok(['shaft','butt','tip'].every(k=>/^#[0-9a-f]{6}$/i.test(c[k])))
 for(const c of Object.values(RAIL_STYLES))assert.ok(['base','dark','light'].every(k=>/^#[0-9a-f]{6}$/i.test(c[k])))
 assert.ok(Object.values(FELTS).every(c=>/^#[0-9a-f]{6}$/i.test(c)))
 assert.equal(new Set(Object.values(FELTS)).size,Object.keys(FELTS).length,'no two felts share a colour')
})

test('every unlock names a real trophy, and no choice is listed twice',()=>{
 const ids=new Set(TROPHIES.map(t=>t.id))
 for(const c of COSMETICS)if(c.trophy)assert.ok(ids.has(c.trophy),`${c.kind} ${c.key} names a trophy that does not exist: ${c.trophy}`)
 assert.equal(new Set(COSMETICS.map(c=>`${c.kind}:${c.key}`)).size,COSMETICS.length)
 assert.ok(COSMETICS.every(c=>c.name))
 assert.ok(COSMETICS.filter(c=>c.trophy).length>=8,'there is something worth earning')
})

test('a choice is unlocked by its trophy and by nothing else',()=>{
 const gold=find('cue','gold')
 assert.equal(isUnlocked(gold,{}),false);assert.equal(isUnlocked(gold,undefined),false)
 assert.equal(isUnlocked(gold,{'first-rack':{at:1}}),false,'a different trophy is no use')
 assert.equal(isUnlocked(gold,{[gold.trophy]:{at:1}}),true)
 assert.equal(isUnlocked(find('cue','classic'),{}),true)
})

test('the words say what is locked and how to get it',()=>{
 const gold=find('cue','gold'),t=trophyFor(gold)
 assert.ok(t);assert.equal(label(gold,{}),`🔒 Gold leaf — earn “${t.name}”`)
 assert.equal(label(gold,{[gold.trophy]:{at:1}}),'Gold leaf')
 assert.equal(trophyFor(find('cue','classic')),null)
 assert.deepEqual(rewardsOf(gold.trophy).map(r=>r.key),['gold'])
 assert.deepEqual(rewardsOf('nonsense'),[])
})

test('a stored choice that is not yet earned falls back to the default',()=>{
 assert.equal(usable('cue','gold',{}),'classic')
 assert.equal(usable('cue','gold',{'ten-racks':{at:1}}),'gold')
 assert.equal(usable('cue','not-a-cue',{}),'classic')
 assert.equal(usable('rails','maple',{}),'walnut')
 assert.equal(usable('felt','royal',{match:{at:1}}),'royal')
})

test('the new choices survive the preferences boundary, and junk does not',()=>{
 const store={};const st={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v}}
 const saved=saveTablePrefs({...loadTablePrefs({getItem:()=>null}),cue:'galaxy',rails:'cherry',felt:FELTS.ice},st)
 assert.deepEqual([saved.cue,saved.rails,saved.felt],['galaxy','cherry',FELTS.ice])
 assert.equal(loadTablePrefs(st).rails,'cherry')
 assert.equal(loadTablePrefs({getItem:k=>k==='pool-masters:rails'?'plastic':null}).rails,'walnut')
})
