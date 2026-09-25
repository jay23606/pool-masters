import test from 'node:test';import assert from 'node:assert/strict'
import fs from 'node:fs'
import {STEPS,stepAt,hasNext,label,shouldOffer,stepDrill,DONE_KEY} from '../src/tutorial.js'
import {DRILLS,attempt} from '../src/drills.js'
import {setTableSize} from '../src/table.js'
setTableSize(7)

test('every step teaches with a real drill, in plain words, and can be solved',()=>{
 assert.equal(STEPS.length,5)
 for(let i=0;i<STEPS.length;i++){
  const d=stepDrill(DRILLS,i),src=DRILLS.find(x=>x.id===STEPS[i].drill)
  assert.ok(d&&src,`step ${i}: drill ${STEPS[i].drill} exists`)
  assert.equal(d.tutorial,i);assert.equal(d.tip,STEPS[i].text);assert.equal(d.name,STEPS[i].title);assert.equal(d.label,`TUTORIAL ${i+1} OF 5`)
  assert.equal(d.id,src.id,'same id, so progress is the drill\'s own');assert.deepEqual(d.layout,src.layout);assert.deepEqual(d.win,src.win)
  assert.equal(attempt(d,d.hint).ok,true,`${d.id}: Show me solves it`)
  assert.ok(STEPS[i].text.length>40&&STEPS[i].text.length<260,'a sentence or two')
 }
 assert.equal(new Set(STEPS.map(s=>s.drill)).size,STEPS.length,'no drill twice')
})

test('the steps run in order, the last one has no next, and out-of-range asks are refused',()=>{
 assert.equal(hasNext(0),true);assert.equal(hasNext(STEPS.length-2),true);assert.equal(hasNext(STEPS.length-1),false)
 for(const bad of [-1,5,1.5,null,undefined,'2',NaN])assert.equal(hasNext(bad),false,String(bad))
 assert.equal(stepAt(0).title,'Aim and shoot');assert.equal(stepAt(5),null);assert.equal(stepAt(-1),null);assert.equal(stepDrill(DRILLS,9),null)
 assert.equal(label(2),'TUTORIAL 3 OF 5')
})

test('it is offered to a new player once, and never again after they finish or decline',()=>{
 assert.equal(shouldOffer(null),true);assert.equal(shouldOffer(undefined),true);assert.equal(shouldOffer(''),true)
 assert.equal(shouldOffer('done'),false);assert.equal(shouldOffer('skipped'),false)
 assert.match(DONE_KEY,/^pool-masters:/)
})

test('the lobby is grouped, every control keeps one id, and nothing the code binds went missing',()=>{
 const src=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8')
 const a=src.indexOf('<section id="lobby"'),lobby=src.slice(a,src.indexOf('</section>',a))
 const ids=[...lobby.matchAll(/ id="([^"]+)"/g)].map(m=>m[1])
 assert.equal(new Set(ids).size,ids.length,'no duplicate ids')
 for(const id of ['quick','practice','hotseat','game-mode','ai-level','obstacles','house','tutorial','daily','drills','challenges','puzzles','career','rogue','code','join','create','learn','learn-go','learn-skip','rooms','leaders','refresh'])assert.ok(ids.includes(id),`#${id} is on the lobby`)
 for(const g of ['Sharpen your game','Solo runs'])assert.ok(lobby.includes(g),g)
 // every button the old lobby had is still reachable, and each is bound
 for(const id of ['quick','practice','hotseat','house','daily','drills','challenges','puzzles','career','rogue','tutorial'])assert.ok(src.includes(`$('#${id}').onclick`),`#${id} has a handler`)
})
