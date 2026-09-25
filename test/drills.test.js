import test from 'node:test';import assert from 'node:assert/strict'
import {DRILLS,HINTS,buildBalls,evaluate,attempt,resultOf,REASONS} from '../src/drills.js'
import {R,MINX,MAXX,MINY,MAXY} from '../src/table.js'

const drill=id=>DRILLS.find(d=>d.id===id)

test('every drill is described, levelled and uniquely named',()=>{
 assert.ok(DRILLS.length>=10)
 assert.equal(new Set(DRILLS.map(d=>d.id)).size,DRILLS.length,'ids are unique')
 assert.equal(new Set(DRILLS.map(d=>d.name)).size,DRILLS.length,'names are unique')
 for(const d of DRILLS){
  assert.ok([1,2,3].includes(d.level),`${d.id} level`)
  assert.ok(d.goal.length>10&&d.tip.length>10,`${d.id} needs a goal and a tip`)
  assert.ok(d.win&&typeof d.win==='object',`${d.id} needs a win condition`)
  const known=['pot','pocket','first','bank','kick','zone','anyPot']
  for(const k of Object.keys(d.win))assert.ok(known.includes(k),`${d.id}: unknown win rule ${k}`)
 }
 assert.ok(DRILLS.some(d=>d.level===1)&&DRILLS.some(d=>d.level===2)&&DRILLS.some(d=>d.level===3),'a spread of difficulty')
})

test('every layout is a legal table: balls inside the cushions and not touching each other',()=>{
 for(const d of DRILLS){
  const balls=buildBalls(d)
  assert.equal(balls[0].k,'cue',`${d.id}: the cue ball comes first`)
  assert.ok(balls.every(b=>b.on&&b.x>=MINX&&b.x<=MAXX&&b.y>=MINY&&b.y<=MAXY),`${d.id}: a ball is outside the playing area`)
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++)
   assert.ok(Math.hypot(balls[i].x-balls[j].x,balls[i].y-balls[j].y)>=2*R-1e-6,`${d.id}: balls ${balls[i].n} and ${balls[j].n} overlap`)
  assert.equal(new Set(balls.map(b=>b.n)).size,balls.length,`${d.id}: ball numbers repeat`)
 }
})

test('every drill has a hint, and that shot really solves it through the real physics',()=>{
 for(const d of DRILLS){
  assert.ok(d.hint,`${d.id} has no hint`)
  const r=attempt(d,d.hint)
  assert.equal(r.ok,true,`${d.id}: its own hint does not solve it (${r.reason}). If the physics or a layout changed, run: node tools/solve-drills.mjs`)
 }
 assert.deepEqual(Object.keys(HINTS).sort(),DRILLS.map(d=>d.id).sort(),'no hint without a drill, no drill without a hint')
})

test('the easier drills are not a lottery: their hints survive a nudge to the aim and the power',()=>{
 const nudges=[[0,0],[.003,0],[-.003,0],[.006,0],[-.006,0],[0,3],[0,-3],[.003,3],[-.003,-3]]
 for(const d of DRILLS.filter(x=>x.level<=2)){
  const held=nudges.filter(([da,dp])=>attempt(d,{...d.hint,angle:d.hint.angle+da,power:d.hint.power+dp}).ok).length
  assert.ok(held/nudges.length>=.7,`${d.id}: the hint holds for only ${held}/${nudges.length} small nudges`)
 }
})

test('no drill is solved by a random shot: each one asks for something',()=>{
 for(const d of DRILLS.filter(x=>x.id!=='break')){
  let ok=0;const N=150
  for(let i=0;i<N;i++){
   const shot={angle:Math.random()*Math.PI*2,power:15+Math.random()*85,spin:[(Math.random()-.5)*.6,(Math.random()-.5)*.6]}
   if(attempt(d,shot).ok)ok++
  }
  assert.ok(ok/N<.15,`${d.id}: ${ok}/${N} random shots passed, so it is too easy to pass by accident`)
 }
})

test('the break: a square hit at about three-quarters power drops a ball; full power with no spin scratches',()=>{
 const d=drill('break')
 for(let i=0;i<20;i++)assert.equal(attempt(d,d.hint).ok,true)
 const full=attempt(d,{angle:0,power:100,spin:[0,0]})
 assert.equal(full.ok,false);assert.equal(full.reason,'scratch','which is what the tip warns about')
})

// ---- the rules of judging, one at a time ----

const shot=o=>({scratch:false,first:1,cueRailFirst:false,potted:[],pockets:{},railBalls:[],cue:{x:300,y:190,on:true},...o})
const d=win=>({win})

test('a scratch always fails, even if the ball dropped',()=>{
 assert.deepEqual(evaluate(d({pot:1}),shot({potted:[1],pockets:{1:1},scratch:true})),{ok:false,reason:'scratch'})
})
test('the ball must drop',()=>{
 assert.equal(evaluate(d({pot:1}),shot({})).reason,'missed')
 assert.equal(evaluate(d({pot:1}),shot({potted:[1],pockets:{1:2}})).ok,true,'any pocket will do when none is named')
})
test('it must drop in the pocket that was asked for',()=>{
 assert.equal(evaluate(d({pot:1,pocket:4}),shot({potted:[1],pockets:{1:2}})).reason,'wrong-pocket')
 assert.equal(evaluate(d({pot:1,pocket:4}),shot({potted:[1],pockets:{1:4}})).ok,true)
})
test('the wrong ball dropping does not count',()=>{
 assert.equal(evaluate(d({pot:1}),shot({potted:[2],pockets:{2:1}})).reason,'missed')
})
test('a first-contact rule checks the first ball hit',()=>{
 assert.equal(evaluate(d({first:1,pot:2}),shot({first:3,potted:[2],pockets:{2:1}})).reason,'wrong-first')
 assert.equal(evaluate(d({first:1,pot:2}),shot({first:1,potted:[2],pockets:{2:1}})).ok,true)
 assert.equal(evaluate(d({first:1}),shot({first:null})).reason,'wrong-first','touching nothing is not hitting the 1')
})
test('a bank must touch a cushion on the way, a kick must be the cue ball that does',()=>{
 assert.equal(evaluate(d({pot:1,bank:true}),shot({potted:[1],pockets:{1:1},railBalls:[0]})).reason,'no-bank','the cue touching a cushion is not the ball banking')
 assert.equal(evaluate(d({pot:1,bank:true}),shot({potted:[1],pockets:{1:1},railBalls:[1]})).ok,true)
 assert.equal(evaluate(d({pot:1,kick:true}),shot({potted:[1],pockets:{1:1}})).reason,'no-kick')
 assert.equal(evaluate(d({pot:1,kick:true}),shot({potted:[1],pockets:{1:1},cueRailFirst:true})).ok,true)
})
test('a position rule needs the cue ball inside the circle, and on the table',()=>{
 const w={pot:1,zone:{x:300,y:190,r:20}}
 assert.equal(evaluate(d(w),shot({potted:[1],pockets:{1:1},cue:{x:310,y:195,on:true}})).ok,true)
 assert.equal(evaluate(d(w),shot({potted:[1],pockets:{1:1},cue:{x:400,y:190,on:true}})).reason,'position')
 assert.equal(evaluate(d(w),shot({potted:[1],pockets:{1:1},cue:{x:300,y:190,on:false}})).reason,'position')
})
test('anyPot passes on any drop and fails on none',()=>{
 assert.equal(evaluate(d({anyPot:true}),shot({potted:[7],pockets:{7:0}})).ok,true)
 assert.equal(evaluate(d({anyPot:true}),shot({})).reason,'missed')
})
test('every failure reason has a sentence a player can read',()=>{
 for(const r of ['scratch','missed','wrong-pocket','no-bank','no-kick','wrong-first','position'])
  assert.ok(REASONS[r]&&REASONS[r].length>8,r)
})
test('resultOf reads a rollout the way evaluate expects',()=>{
 const r=resultOf({scratch:false,firstHit:{n:3,k:'solid'},cueRailFirst:true,potted:[3],pockets:{3:1},railBalls:[0],cue:{x:1,y:2,on:true}})
 assert.equal(r.first,3);assert.equal(r.cueRailFirst,true)
 assert.equal(resultOf({scratch:false,firstHit:null,potted:[],pockets:{},railBalls:[],cueRailFirst:false,cue:{x:0,y:0,on:true}}).first,null)
})

// ---- progress ----
import {emptyProgress,recordDrill,doneCount,nextDrill} from '../src/drills.js'

test('progress starts empty and records tries, completion and the best number of attempts',()=>{
 let p=emptyProgress()
 assert.equal(doneCount(p),0)
 p=recordDrill(p,'straight-in',{ok:false,attempts:1})
 assert.deepEqual(p['straight-in'],{tries:1,done:false,best:null})
 p=recordDrill(p,'straight-in',{ok:true,attempts:3})
 assert.deepEqual(p['straight-in'],{tries:2,done:true,best:3})
 p=recordDrill(p,'straight-in',{ok:true,attempts:1})
 assert.equal(p['straight-in'].best,1,'a better run lowers the best')
 p=recordDrill(p,'straight-in',{ok:true,attempts:5})
 assert.equal(p['straight-in'].best,1,'a worse run does not raise it')
 p=recordDrill(p,'straight-in',{ok:false,attempts:2})
 assert.equal(p['straight-in'].done,true,'a later miss does not undo completion')
 assert.equal(doneCount(p),1)
})

test('a solve the hint aimed completes the drill but does not set a record',()=>{
 let p=recordDrill(emptyProgress(),'stop-shot',{ok:true,attempts:1,hinted:true})
 assert.deepEqual(p['stop-shot'],{tries:1,done:true,best:null},'done, but no best: the game did the aiming')
 p=recordDrill(p,'stop-shot',{ok:true,attempts:2,hinted:false})
 assert.equal(p['stop-shot'].best,2,'a later unaided solve does')
 p=recordDrill(p,'stop-shot',{ok:true,attempts:1,hinted:true})
 assert.equal(p['stop-shot'].best,2,'and a later hinted one cannot lower it')
})

test('recording one drill leaves the others alone and does not mutate what it was given',()=>{
 const before=recordDrill(emptyProgress(),'side-cut',{ok:true,attempts:2})
 const snapshot=JSON.stringify(before)
 const after=recordDrill(before,'straight-in',{ok:true,attempts:1})
 assert.equal(JSON.stringify(before),snapshot)
 assert.deepEqual(after['side-cut'],before['side-cut'])
 assert.equal(doneCount(after),2)
})

test('progress read back from storage in a bad state does not throw',()=>{
 for(const bad of [null,undefined,{},{'straight-in':null}])
  assert.doesNotThrow(()=>recordDrill(bad,'straight-in',{ok:true,attempts:1}))
 assert.equal(doneCount(null),0)
})

test('the drills form a sequence: each has a next, and the last has none',()=>{
 assert.equal(nextDrill(DRILLS[0].id).id,DRILLS[1].id)
 assert.equal(nextDrill(DRILLS[DRILLS.length-1].id),null)
 assert.equal(nextDrill('nonsense'),null)
})
