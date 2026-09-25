import test from 'node:test';import assert from 'node:assert/strict'
import {TRICKS,TRICK_DRILLS,trickById,isTrick,nextTrick,tricksDone} from '../src/tricks.js'
import {attempt,evaluate,REASONS} from '../src/drills.js'
import {PoolGame} from '../src/pool.js'
import {POCKETS,R,PR,setTableSize} from '../src/table.js'
setTableSize(7)

const drillOf=t=>({layout:{cue:t.cue,balls:t.balls},win:{clear:true}})

test('there is a library, ordered from two balls up, with unique ids and names',()=>{
 assert.ok(TRICKS.length>=8,`${TRICKS.length} trick shots`)
 assert.equal(new Set(TRICKS.map(t=>t.id)).size,TRICKS.length);assert.equal(new Set(TRICKS.map(t=>t.name)).size,TRICKS.length)
 const sizes=TRICKS.map(t=>t.balls.length);assert.deepEqual(sizes,[...sizes].sort((a,b)=>a-b),'easiest first')
 assert.ok(sizes.every(n=>n>=2&&n<=4));assert.ok(TRICK_DRILLS.every(d=>d.win.clear&&d.trick&&d.hint))
 assert.equal(trickById(TRICKS[0].id).name,TRICKS[0].name);assert.equal(trickById('nope'),null)
 assert.equal(isTrick(TRICKS[0].id),true);assert.equal(isTrick('straight-in'),false);assert.equal(isTrick('daily-4'),false)
 assert.equal(nextTrick(TRICKS[0].id).id,TRICKS[1].id);assert.equal(nextTrick(TRICKS.at(-1).id),null)
})

test('every layout is sane: on the cloth, off the pockets, no two balls touching',()=>{
 for(const t of TRICKS){
  const all=[['c',...t.cue],...t.balls.map(b=>[b[0],b[1],b[2]])]
  for(const [,x,y] of all){assert.ok(x>=45&&x<=655&&y>=45&&y<=335,`${t.id} on the cloth`);for(const k of POCKETS)assert.ok(Math.hypot(x-k[0],y-k[1])>PR+R,`${t.id} clear of the pockets`)}
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)assert.ok(Math.hypot(all[i][1]-all[j][1],all[i][2]-all[j][2])>2*R+1,`${t.id} nothing touching`)
 }
})

test('the shown shot really clears every ball, for every trick shot, in the real physics',()=>{
 for(const t of TRICKS){
  const r=attempt(drillOf(t),t.hint)
  assert.equal(r.ok,true,`${t.id} ${t.name}: ${r.reason}`)
  assert.equal(r.result.scratch,false)
  assert.deepEqual([...r.result.potted].sort((a,b)=>a-b),t.balls.map(b=>b[0]).sort((a,b)=>a-b),`${t.id}: exactly its balls dropped`)
 }
})

test('a slightly different shot does not always work, so the trick is a trick (and the window is honest)',()=>{
 for(const t of TRICKS.slice(0,6)){
  const off=d=>attempt(drillOf(t),{...t.hint,angle:t.hint.angle+d*Math.PI/180}).ok
  assert.equal(off(-8)&&off(8),false,`${t.id}: not clearable 8 degrees either side`)
 }
})

test('the clear rule: every ball, one shot, and a scratch or a leftover fails',()=>{
 const d={layout:{cue:[100,190],balls:[[1,300,190],[2,400,190]]},win:{clear:true}}
 const base={scratch:false,first:1,cueRailFirst:false,potted:[1,2],pockets:{},railBalls:[],cue:{x:0,y:0,on:true}}
 assert.deepEqual(evaluate(d,base),{ok:true})
 assert.deepEqual(evaluate(d,{...base,potted:[1]}),{ok:false,reason:'left',left:1})
 assert.deepEqual(evaluate(d,{...base,potted:[]}),{ok:false,reason:'left',left:2})
 assert.equal(evaluate(d,{...base,scratch:true}).reason,'scratch')
 assert.ok(REASONS.left&&/single shot|one shot/.test(REASONS.left))
 assert.equal(evaluate({...d,win:{pot:1}},{...base,potted:[1]}).ok,true,'other drills are unaffected')
})

test('progress counts',()=>{
 assert.equal(tricksDone({}),0)
 assert.equal(tricksDone({[TRICKS[0].id]:{done:true},[TRICKS[1].id]:{done:false},'straight-in':{done:true}}),1)
})

// ---- in the game: Show me sets the shot up, taking it clears the table ----
function game(drill){
 const g=Object.create(PoolGame.prototype),outcomes=[]
 Object.assign(g,{mode:'8ball',turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:false,ready:true,me:'a',host:true,
  shots:{a:0,b:0},acc:0,flash(){},setSpin(a,b){this.spin={a,b}},send(){},onSave(){},onFinish(){},onShot(){},onReplay(){},onDrill:e=>outcomes.push(e),score:{a:0,b:0},breaker:'a',
  power:{value:50},powerOut:{textContent:''},spin:{a:0,b:0},aiming:true,angle:0,house:{race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false},drill})
 g.resetRack();return {g,outcomes}
}
test('Show me plays the proven shot and the game judges the table cleared',()=>{
 for(const d of TRICK_DRILLS){
  const {g,outcomes}=game(d)
  assert.equal(g.balls.length,d.layout.balls.length+1)
  assert.equal(g.applyHint(),true,'the hint is applied');assert.equal(g.hinted,true)
  g.takeShot();g.phase='roll';g.simAt=0;let now=0;for(let i=0;i<20*120&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
  const last=outcomes.at(-1)
  assert.ok(last&&last.ok,`${d.id} ${d.name}: ${last?.reason}, left ${g.balls.filter(b=>b.on&&b.k!=='cue').length}`)
 }
})
