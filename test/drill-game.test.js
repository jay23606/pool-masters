import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {DRILLS,buildBalls,attempt,REASONS} from '../src/drills.js'

// The real game, with the DOM and network stubbed. What matters is that the game
// judges a drill exactly as the drill module says it would: the hint tests in
// drills.test.js use a rollout, and the two have to agree.
function drillGame(d){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{drill:d,mode:'8ball',turn:'a',me:'a',host:true,phase:'aim',over:false,result:'',finished:false,
  round:1,groups:{a:null,b:null},assignment:null,calledPocket:null,ballInHand:false,placed:false,practice:false,
  ready:true,shots:{a:0,b:0},acc:0,flash(){},sync(){},setSpin(a,b){this.spin={a,b}},onFinish(){},
  power:{value:50},powerOut:{textContent:''},spin:{a:0,b:0},events:[]})
 g.onDrill=e=>g.events.push(e?(e.ok?'ok':e.reason):'reset')
 g.resetRack()
 return g
}
function shoot(g,shot){
 g.angle=shot.angle;g.power.value=shot.power;g.spin={a:shot.spin[0],b:shot.spin[1]};g.aiming=true
 g.takeShot()
 let now=0;for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 clearTimeout(g.retryTimer)
 return g
}
const same=(a,b)=>JSON.stringify(a.map(x=>[Math.round(x.x),Math.round(x.y),x.on]))===JSON.stringify(b.map(x=>[Math.round(x.x),Math.round(x.y),x.on]))

test('the real game judges every drill exactly as the drill module does, for a solving shot',()=>{
 for(const d of DRILLS){
  const g=shoot(drillGame(d),d.hint)
  const expected=attempt(d,d.hint)
  assert.equal(g.drillOutcome.ok,expected.ok,`${d.id}: the game and the rollout disagree about the hint`)
  assert.equal(g.drillOutcome.ok,true,`${d.id}: the hint should solve it in the real game`)
 }
})

test('and for shots that fail, it gives the same reason',()=>{
 let compared=0
 for(const d of DRILLS.filter(x=>x.id!=='break')){
  for(const da of [.12,-.25,.6,2.4]){
   const shot={...d.hint,angle:d.hint.angle+da}
   const g=shoot(drillGame(d),shot),expected=attempt(d,shot)
   assert.equal(g.drillOutcome.ok,expected.ok,`${d.id} at ${da}`)
   assert.equal(g.drillOutcome.reason,expected.reason,`${d.id} at ${da}`)
   compared++
  }
 }
 assert.ok(compared>=36)
})

test('a drill starts on its own table, aimed at its first ball, and never changes whose turn it is',()=>{
 const d=DRILLS.find(x=>x.id==='straight-in')
 const g=drillGame(d)
 assert.ok(same(g.balls,buildBalls(d)))
 assert.ok(Math.abs(g.angle-Math.atan2(150-260,0))<1e-9,'aimed straight up the table at the 1')
 shoot(g,{...d.hint,angle:d.hint.angle+.5})
 assert.equal(g.turn,'a');assert.equal(g.over,false)
})

test('a miss puts the table back by itself; a success leaves it to be looked at',()=>{
 const d=DRILLS.find(x=>x.id==='straight-in')
 const miss=shoot(drillGame(d),{...d.hint,angle:d.hint.angle+.4})
 assert.equal(miss.drillOutcome.ok,false)
 assert.equal(miss.attempts,1)
 assert.ok(!same(miss.balls,buildBalls(d)),'not reset yet: the miss is still on the table')
 miss.retryDrill()
 assert.ok(same(miss.balls,buildBalls(d)),'the retry restores the layout exactly')
 assert.equal(miss.phase,'aim');assert.equal(miss.drillOutcome,null);assert.equal(miss.aiming,true)
 assert.equal(miss.canControl(),true)
 assert.deepEqual(miss.events,['missed','reset'])

 const win=shoot(drillGame(d),d.hint)
 assert.equal(win.drillOutcome.ok,true)
 assert.equal(win.retryTimer,undefined,'no automatic retry after a success')
 assert.deepEqual(win.events,['ok'])
})

test('a miss schedules the automatic retry',()=>{
 const d=DRILLS.find(x=>x.id==='straight-in')
 const g=drillGame(d)
 g.angle=d.hint.angle+.4;g.power.value=50;g.spin={a:0,b:0};g.aiming=true;g.takeShot()
 let now=0;for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 assert.ok(g.retryTimer,'a retry is scheduled')
 clearTimeout(g.retryTimer)
})

test('a scratch fails, takes the cue ball off the table, and the retry brings it back',()=>{
 const d=DRILLS.find(x=>x.id==='straight-in')
 // hit it far too hard along the line: the cue ball follows the 1 in
 let g=null
 for(const power of [100,95,90,85,80]){
  const t=shoot(drillGame(d),{angle:d.hint.angle,power,spin:[0,.45]})
  if(t.drillOutcome.reason==='scratch'){g=t;break}
 }
 assert.ok(g,'some hard follow shot should scratch on this table')
 assert.equal(g.balls[0].on,false)
 assert.equal(g.canControl(),false,'cannot shoot without a cue ball')
 g.retryDrill()
 assert.equal(g.balls[0].on,true);assert.equal(g.canControl(),true)
})

test('the hint sets the aim, the power and the spin, and only when you could shoot',()=>{
 const d=DRILLS.find(x=>x.id==='draw-back')
 const g=drillGame(d)
 g.angle=1;g.power.value=10;g.spin={a:.3,b:.3};g.aiming=false
 assert.equal(g.applyHint(),true)
 assert.equal(g.angle,d.hint.angle);assert.equal(+g.power.value,d.hint.power);assert.equal(g.aiming,true)
 assert.deepEqual([g.spin.a,g.spin.b],d.hint.spin,'the draw drill needs backspin, and the hint dials it in')
 assert.equal(g.powerOut.textContent,d.hint.power+'%')
 g.phase='roll'
 assert.equal(g.applyHint(),false,'no hints in the middle of a shot')
})

test('shooting the hint actually works after applyHint, start to finish',()=>{
 for(const d of DRILLS){
  const g=drillGame(d)
  g.applyHint();g.takeShot()
  let now=0;for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
  clearTimeout(g.retryTimer)
  assert.equal(g.drillOutcome?.ok,true,`${d.id}: the applied hint should solve it`)
 }
})

test('the drill HUD names the drill, counts attempts, and says why an attempt failed',()=>{
 const d=DRILLS.find(x=>x.id==='straight-in')
 const el=()=>({textContent:'',className:'',hidden:false,disabled:false})
 const g=drillGame(d);Object.assign(g,{groupStatus:el(),status:el(),shoot:el(),moveCue:el(),changePocket:el()})
 g.updateHud()
 assert.equal(g.groupStatus.textContent,'DRILL · STRAIGHT IN');assert.equal(g.status.textContent,'Your shot')
 shoot(g,{...d.hint,angle:d.hint.angle+.4});g.updateHud()
 assert.equal(g.status.textContent,REASONS.missed)
 g.retryDrill();g.updateHud()
 assert.equal(g.status.textContent,'Attempt 2')
 shoot(g,d.hint);g.updateHud()
 assert.match(g.status.textContent,/Drill complete in 2 attempts/)
 const first=shoot(drillGame(d),d.hint);Object.assign(first,{groupStatus:el(),status:el(),shoot:el(),moveCue:el(),changePocket:el()});first.updateHud()
 assert.equal(first.status.textContent,'Drill complete first time')
})

test('the game knows when an attempt was aimed by the hint, and forgets it on the next attempt',()=>{
 const d=DRILLS.find(x=>x.id==='straight-in')
 const events=[];const g=drillGame(d);g.onDrill=e=>events.push(e)
 g.applyHint();g.takeShot()
 let now=0;for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 assert.equal(events.at(-1).hinted,true)
 g.retryDrill()
 assert.equal(g.hinted,false,'a fresh attempt is unaided until the hint is used again')
 shoot(g,d.hint)
 assert.equal(events.at(-1).hinted,false,'a solve you aimed yourself is not marked as hinted')
 assert.equal(events.at(-1).ok,true)
})

test('the HUD is honest about a hinted solve, and the header says which drill of how many',()=>{
 const d=DRILLS.find(x=>x.id==='straight-in')
 const el=()=>({textContent:'',className:'',hidden:false,disabled:false})
 const g=drillGame(d);Object.assign(g,{groupStatus:el(),status:el(),shoot:el(),moveCue:el(),changePocket:el(),drillLabel:'1 OF 11'})
 g.applyHint();g.takeShot()
 let now=0;for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 clearTimeout(g.retryTimer);g.updateHud()
 assert.equal(g.status.textContent,'Drill complete, with a hint')
 assert.equal(g.groupStatus.textContent,'DRILL · 1 OF 11')
})

test('a drill shot is recorded, so it can be replayed',()=>{
 const d=DRILLS.find(x=>x.id==='straight-in')
 const g=drillGame(d);g.sync=PoolGame.prototype.sync;g.send=()=>{}
 shoot(g,d.hint)
 assert.ok(g.lastReplay,'the attempt should leave a replay behind')
 assert.equal(g.lastReplay.ids.length,g.balls.length)
})

test('drill mode leaves an ordinary game alone',()=>{
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{mode:'8ball',turn:'a',me:'a',host:true,flash(){},setSpin(){}})
 g.resetRack()
 assert.equal(g.balls.length,16);assert.ok(!g.drill)
})
