import test from 'node:test';import assert from 'node:assert/strict'
import {LADDER,byId,emptyCareer,isBeaten,isOpen,nextOpponent,recordWin,beatenCount,isChampion,summaryOf} from '../src/career.js'
import {AI_LEVELS,difficultyFor} from '../src/ai.js'
import {MODES} from '../src/rules.js'
import {TROPHIES,earned,emptyStats} from '../src/trophies.js'
import {COSMETICS} from '../src/cosmetics.js'

test('the ladder is well formed: ten opponents, each a real game at a real level',()=>{
 assert.equal(LADDER.length,10)
 assert.equal(new Set(LADDER.map(o=>o.id)).size,10)
 for(const o of LADDER){
  assert.ok(o.name&&o.venue&&o.bio,o.id)
  assert.ok(AI_LEVELS[o.level],`${o.id}: unknown level ${o.level}`)
  assert.ok(MODES[o.mode],`${o.id}: unknown game ${o.mode}`)
  assert.ok(Number.isInteger(o.race)&&o.race>=1&&o.race<=5,`${o.id}: race`)
 }
})

test('the ladder gets harder: the aim error never rises from one opponent to the next',()=>{
 for(let i=1;i<LADDER.length;i++)assert.ok(difficultyFor(LADDER[i].level).aimError<=difficultyFor(LADDER[i-1].level).aimError,`${LADDER[i].id} is easier than ${LADDER[i-1].id}`)
 assert.ok(difficultyFor(LADDER[0].level).aimError>difficultyFor(LADDER[9].level).aimError*10,'the top is far better than the bottom')
})

test('the AI levels form one scale, from novice to legend',()=>{
 const order=['novice','beginner','club','league','ace','pro','legend']
 for(let i=1;i<order.length;i++){
  const a=AI_LEVELS[order[i-1]],b=AI_LEVELS[order[i]]
  assert.ok(a.aimError>b.aimError&&a.powerError>b.powerError&&a.safetyCut>b.safetyCut,`${order[i-1]} should be worse than ${order[i]}`)
 }
 assert.ok(AI_LEVELS.legend.label&&AI_LEVELS.novice.label)
})

test('the ladder covers all four games, and the scored games are a single rack',()=>{
 for(const m of ['8ball','9ball','bank','onepocket'])assert.ok(LADDER.some(o=>o.mode===m),m)
 for(const o of LADDER.filter(o=>o.mode==='bank'||o.mode==='onepocket'))assert.equal(o.race,1)
})

test('only the first opponent is open until it is beaten, then the next, and so on',()=>{
 let p=emptyCareer()
 assert.deepEqual(LADDER.filter(o=>isOpen(p,o.id)).map(o=>o.id),['ray'])
 p=recordWin(p,'ray',1)
 assert.deepEqual(LADDER.filter(o=>isOpen(p,o.id)).map(o=>o.id),['ray','dee'])
 assert.equal(nextOpponent(p).id,'dee')
 // an opponent two steps ahead cannot be played by skipping
 assert.equal(isOpen(p,'bo'),false)
 assert.equal(isOpen(p,'nobody'),false)
})

test('a win is recorded once and losing takes nothing away',()=>{
 let p=recordWin(emptyCareer(),'ray',100)
 const again=recordWin(p,'ray',999)
 assert.equal(again.beaten.ray.at,100,'the first win is the one that counts')
 assert.equal(recordWin(p,'nobody',5),p,'an unknown opponent changes nothing')
 assert.equal(beatenCount(p),1)
 assert.equal(isBeaten(p,'ray'),true)
})

test('recordWin does not change the progress it was given',()=>{
 const p=emptyCareer(),copy=JSON.stringify(p)
 recordWin(p,'ray');assert.equal(JSON.stringify(p),copy)
})

test('broken saved progress is treated as a fresh start',()=>{
 for(const junk of [null,undefined,42,'x',{},{beaten:null},{beaten:'no'}]){
  assert.equal(beatenCount(junk),0);assert.deepEqual(LADDER.filter(o=>isOpen(junk,o.id)).map(o=>o.id),['ray'])
  assert.equal(recordWin(junk,'ray').beaten.ray!==undefined,true)
 }
})

test('beating everyone makes a champion and leaves nobody next',()=>{
 let p=emptyCareer();for(const o of LADDER)p=recordWin(p,o.id,1)
 assert.equal(isChampion(p),true);assert.equal(nextOpponent(p),null);assert.equal(beatenCount(p),10)
 assert.equal(isChampion(emptyCareer()),false)
})

test('the words after a match say what happened and what is next',()=>{
 const ray=byId('ray'),p=recordWin(emptyCareer(),'ray')
 assert.match(summaryOf(ray,true,p),/You beat Rookie Ray\. Next up: Diner Dee at Sunrise Diner\./)
 assert.match(summaryOf(ray,false,emptyCareer()),/takes it/)
 let all=emptyCareer();for(const o of LADDER)all=recordWin(all,o.id)
 assert.match(summaryOf(byId('legend'),true,all),/champion/)
})

test('the career trophies follow the ladder, and unlock cosmetics that exist',()=>{
 const t=id=>TROPHIES.find(x=>x.id===id),ctx=career=>({stats:emptyStats(),drills:{},career,profile:null})
 let p=emptyCareer()
 assert.equal(earned(t('career-1'),ctx(p)),false)
 p=recordWin(p,'ray');assert.equal(earned(t('career-1'),ctx(p)),true);assert.equal(earned(t('career-5'),ctx(p)),false)
 for(const id of ['dee','bo','bea'])p=recordWin(p,id)
 assert.equal(earned(t('career-5'),ctx(p)),false,'four is not five')
 p=recordWin(p,'cal')
 assert.equal(earned(t('career-5'),ctx(p)),true);assert.equal(earned(t('career-all'),ctx(p)),false)
 for(const o of LADDER)p=recordWin(p,o.id)
 assert.equal(earned(t('career-all'),ctx(p)),true)
 assert.equal(earned(t('career-1'),{stats:emptyStats(),drills:{},profile:null}),false,'no career at all is fine')
 assert.ok(COSMETICS.some(c=>c.trophy==='career-all')&&COSMETICS.some(c=>c.trophy==='career-5'))
})
