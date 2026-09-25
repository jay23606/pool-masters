import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike} from '../src/physics.js'
import {rack} from '../src/rules.js'
import {ballsAt,duration,pack,unpack} from '../src/replay.js'

// Two real PoolGame objects, joined by their real send/receive, with only the
// DOM stubbed. The host simulates; the guest only ever sees snapshots.
function pair(mode='8ball'){
 const common={mode,turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:false,ready:true,
  shots:{a:0,b:0},acc:0,flash(){},setSpin(){},onFinish(){}}
 const host=Object.create(PoolGame.prototype),guest=Object.create(PoolGame.prototype)
 const balls=rack(mode)
 Object.assign(host,common,{balls,me:'a',host:true,send:m=>guest.receive(m),events:[]})
 Object.assign(guest,common,{balls:balls.map(b=>({...b})),me:'b',host:false,send(){},events:[],
  predictor:null,predicted:null})
 host.onReplay=r=>host.events.push(r?'replay':'cleared')
 guest.onReplay=r=>guest.events.push(r?'replay':'cleared')
 return {host,guest}
}
function shoot(host,vx,vy,step=1000/120){
 host.startShot();strike(host.balls[0],vx,vy)
 let now=0;for(let i=0;i<9000&&host.phase==='roll';i++){now+=step;host.advance(now)}
 return now
}
const at=(rec,i)=>rec.frames[i].b

test('the host records a shot from the pre-strike layout to the final resting one',()=>{
 const {host}=pair()
 const start=host.balls.map(b=>[Math.round(b.x),Math.round(b.y)])
 shoot(host,2600,140)
 const r=host.lastReplay
 assert.ok(r,'the shot should have been recorded')
 assert.deepEqual(at(r,0),start,'the first frame is the table before the cue ball moved')
 const end=host.balls.map(b=>b.on?[Math.round(b.x),Math.round(b.y)]:null)
 assert.deepEqual(at(r,r.frames.length-1),end,'the last frame is where everything came to rest')
 assert.ok(r.frames.length>20)
})

test('recording is on the simulation clock: frames are 40ms apart even when the host could only step in coarse chunks',()=>{
 for(const chunk of [1000/120,250,500]){
  const {host}=pair()
  host.startShot();strike(host.balls[0],2600,140)
  let now=0;for(let i=0;i<3000&&host.phase==='roll';i++){now+=chunk;host.advance(now)}
  const gaps=host.lastReplay.frames.slice(1,-1).map((f,i)=>f.t-host.lastReplay.frames[i].t)
  const median=gaps.sort((a,b)=>a-b)[Math.floor(gaps.length/2)]
  assert.ok(median>=39&&median<=50,`with ${chunk}ms of wall time per step the median gap was ${median}ms`)
 }
})

test('a guest records the same shot from snapshots alone',()=>{
 const {host,guest}=pair()
 host.sync()                                  // put the guest on the host's rack
 shoot(host,2600,140)
 assert.ok(guest.lastReplay,'the guest should have recorded it too')
 const final=host.balls.map(b=>b.on?[Math.round(b.x),Math.round(b.y)]:null)
 assert.deepEqual(at(guest.lastReplay,guest.lastReplay.frames.length-1),final)
 assert.deepEqual(guest.lastReplay.ids,host.lastReplay.ids)
})

test('listeners hear about a replay when a shot ends, and the last one stays until the next one ends',()=>{
 const {host}=pair()
 shoot(host,1800,0)
 assert.deepEqual(host.events,['replay'])
 const first=host.lastReplay
 host.turn='a';host.startShot();strike(host.balls[0],1500,60)   // a second shot is now rolling
 assert.equal(host.lastReplay,first,'the previous shot is still there while the next one plays')
 host.resetRack();host.events.length=0
 assert.equal(host.lastReplay,null)
})

test('a replay refuses to start over a shot that is still rolling',()=>{
 const {host}=pair()
 shoot(host,1800,0)
 const rec=host.lastReplay
 host.turn='a';host.startShot();strike(host.balls[0],1500,60)
 assert.equal(host.startReplay(rec),false)
 assert.ok(!host.replay,'nothing should be playing')
})

test('nothing is recorded, and no replay appears, for a shot that has not been taken',()=>{
 const {host}=pair()
 host.sync()
 assert.ok(!host.lastReplay);assert.ok(!host.rec)
})

test('playing a replay draws recorded balls but leaves the game itself alone',()=>{
 const {host}=pair()
 shoot(host,2600,140)
 const before=JSON.stringify(host.balls),phase=host.phase,turn=host.turn
 const primed=[];host.sfx={prime:b=>primed.push(b.length),update(){}}
 host.startReplay(host.lastReplay)
 const shown=host.replayBalls(performance.now()+200)
 assert.equal(shown.length,16)
 assert.notEqual(JSON.stringify(shown.map(b=>[b.x,b.y])),JSON.stringify(host.balls.map(b=>[b.x,b.y])),'mid-replay the table is not the final one')
 assert.equal(JSON.stringify(host.balls),before,'the real balls are untouched')
 assert.equal(host.phase,phase);assert.equal(host.turn,turn)
 assert.equal(primed.length,1,'sound is told about the teleport, so it makes no noise for it')
})

test('input is blocked while a replay is showing and comes back when it ends',()=>{
 const {host}=pair()
 shoot(host,2200,0)
 host.turn='a'
 assert.equal(host.canControl(),true)
 host.startReplay(host.lastReplay)
 assert.equal(host.canControl(),false,'cannot aim over a replay')
 const end=duration(host.lastReplay)
 assert.ok(host.replayBalls(performance.now()+end/2),'still playing halfway through')
 assert.equal(host.replayBalls(performance.now()+end+2000),null,'and over after the end')
 assert.equal(host.replay,null)
 assert.equal(host.canControl(),true)
})

test('a slower replay takes proportionally longer',()=>{
 const {host}=pair()
 shoot(host,2200,0)
 const end=duration(host.lastReplay)
 host.startReplay(host.lastReplay,.25)
 assert.ok(host.replayBalls(performance.now()+end*.5),'a quarter-speed replay is still going at half the real duration')
 assert.ok(host.replayBalls(performance.now()+end*3),'and at three times it')
 // the 700ms hold at the end is in replay time, so at quarter speed it lasts 2.8s of wall time
 assert.equal(host.replayBalls(performance.now()+end*4+3500),null)
})

test('a new shot cancels a replay that is playing',()=>{
 const {host}=pair()
 shoot(host,2200,0)
 host.startReplay(host.lastReplay)
 host.turn='a';host.phase='aim'
 host.startShot()
 assert.equal(host.replay,null)
})

test('a fresh rack forgets the last shot',()=>{
 const {host}=pair()
 shoot(host,2200,0)
 assert.ok(host.lastReplay)
 host.resetRack()
 assert.equal(host.lastReplay,null);assert.equal(host.replay,null)
})

test('a shared shot holds its last frame instead of returning to a game',()=>{
 const {host}=pair()
 shoot(host,2200,0)
 const rec=host.lastReplay
 const viewer=Object.create(PoolGame.prototype)
 Object.assign(viewer,{replayOnly:true,balls:rack('8ball')})
 viewer.startReplay(rec)
 const end=duration(rec)
 const held=viewer.replayBalls(performance.now()+end+5000)
 assert.ok(held,'still has something to show long after the end')
 assert.deepEqual(held.map(b=>[b.x,b.y,b.on]),ballsAt(rec,end).map(b=>[b.x,b.y,b.on]))
 assert.equal(viewer.replay.finished,true,'and knows it has finished, so the page can say so')
 viewer.startReplay(rec)
 assert.ok(!viewer.replay.finished,'watching it again starts afresh')
})

test('a shot recorded in a game round-trips through a link and plays back the same',async()=>{
 const {host}=pair('9ball')
 shoot(host,2800,-120)
 const back=await unpack(await pack(host.lastReplay))
 assert.deepEqual(back,host.lastReplay)
 assert.equal(back.mode,'9ball');assert.equal(ballsAt(back,0).length,10)
})

// ---- a guest is told who won ----

test('a guest who wins a rack is told so, and one who loses is told that',()=>{
 for(const [winner,expected] of [['b','You won the rack'],['a','Opponent won the rack']]){
  const {host,guest}=pair()
  const el=()=>({textContent:'',className:'',hidden:false,disabled:false})
  Object.assign(guest,{groupStatus:el(),status:el(),shoot:el(),moveCue:el(),changePocket:el()})
  guest.onFinish=()=>{}
  host.sync()
  host.finish(winner);host.phase='aim';host.sync()
  guest.updateHud()
  assert.equal(guest.result,winner,'the guest has the result')
  assert.equal(guest.status.textContent,expected)
 }
})

test('the result clears when the next rack starts, so it cannot leak into it',()=>{
 const {host,guest}=pair()
 guest.onFinish=()=>{};guest.onRack=()=>{}
 host.sync();host.finish('a');host.phase='aim';host.sync()
 assert.equal(guest.result,'a')
 host.round=2;host.resetRack();host.sync()
 assert.equal(guest.result,'','a fresh rack has no result')
})
