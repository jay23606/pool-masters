import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike,shotSpeed} from '../src/physics.js'
import {rack} from '../src/rules.js'
import {chooseShot} from '../src/ai.js'
import {DRILLS} from '../src/drills.js'

// A host and a guest joined by their real send/receive. The host simulates and
// judges; the guest only ever sees snapshots. Both are asked what each shot was,
// and they have to say the same thing.
function pair(mode='8ball'){
 const common={mode,turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:true,calledPocket:null,ballInHand:false,placed:false,practice:false,ready:true,
  shots:{a:0,b:0},acc:0,flash(){},setSpin(){}}
 const host=Object.create(PoolGame.prototype),guest=Object.create(PoolGame.prototype),balls=rack(mode)
 Object.assign(host,common,{balls,me:'a',host:true,send:m=>guest.receive(m),onFinish(){},shots:{a:0,b:0}})
 Object.assign(guest,common,{balls:balls.map(b=>({...b})),me:'b',host:false,send(){},onFinish(){},onRack(){},predictor:null,predicted:null})
 host.seen=[];guest.seen=[]
 host.onShot=e=>host.seen.push(e);guest.onShot=e=>guest.seen.push(e)
 host.sync()
 return {host,guest}
}
// One clock for the whole game, as in the real thing: the host only syncs once its
// clock is 40ms past the last sync, so a clock that restarted at zero for every
// shot would send a guest no in-flight snapshots at all for a short shot.
function play(host,vx,vy){
 host.startShot();strike(host.balls[0],vx,vy)
 let now=host.clock||0
 for(let i=0;i<9000&&host.phase==='roll';i++){now+=1000/120;host.advance(now)}
 host.clock=now
}

test('a host and a guest report every shot of whole racks identically, in both games',()=>{
 for(const mode of ['8ball','9ball']){
  let total=0
  for(let r=0;r<4;r++){
   const {host,guest}=pair(mode)
   let n=0
   while(!host.over&&n<120){
    const plan=chooseShot(host.balls,host.group(host.turn),host.ballInHand,'league',mode)
    if(!plan)break
    if(plan.place){host.balls[0].x=plan.place.x;host.balls[0].y=plan.place.y;host.ballInHand=false}
    if(mode==='8ball'&&plan.pocket!=null)host.calledPocket=plan.pocket
    const s=shotSpeed(plan.power);play(host,Math.cos(plan.angle)*s,Math.sin(plan.angle)*s);n++
   }
   assert.deepEqual(guest.seen,host.seen,`${mode} rack ${r}: the two sides disagree about what happened`)
   assert.equal(host.seen.length,n,'and every shot was reported once')
   total+=n
  }
  assert.ok(total>20,`${mode}: enough shots to mean something`)
 }
})

test('a shot is described by who took it, what dropped, and whether it was a foul',()=>{
 const {host,guest}=pair()
 host.breakShot=false
 // a straight pot with everything else out of the way
 host.balls.forEach((b,i)=>{if(i>1)b.on=false})
 Object.assign(host.balls[0],{x:350,y:300});Object.assign(host.balls[1],{x:350,y:120})
 host.sync()
 host.seen.length=0;guest.seen.length=0
 play(host,0,-1100)
 for(const side of [host,guest]){
  assert.equal(side.seen.length,1)
  const e=side.seen[0]
  assert.equal(e.by,'a');assert.deepEqual(e.potted,[host.balls[1].n]);assert.equal(e.foul,false)
 }
})

test('a foul is reported as one, by both sides',()=>{
 const {host,guest}=pair('9ball')
 host.breakShot=false
 Object.assign(host.balls[0],{x:200,y:190})
 // hit the 5 with the 1 still on the table
 host.balls.forEach(b=>{if(b.n>1&&b.n!==5)b.on=false})
 Object.assign(host.balls[host.balls.findIndex(b=>b.n===5)],{x:330,y:190})
 Object.assign(host.balls[host.balls.findIndex(b=>b.n===1)],{x:560,y:60})
 host.sync();host.seen.length=0;guest.seen.length=0
 play(host,900,0)
 for(const side of [host,guest]){assert.equal(side.seen[0].foul,true,'wrong ball first')}
 assert.deepEqual(guest.seen,host.seen)
})

test('the break is marked as the break, and only the break',()=>{
 const {host,guest}=pair()
 play(host,2800,60)
 assert.equal(host.seen[0].brk,true);assert.equal(guest.seen[0].brk,true)
 host.turn='a';host.balls[0].on=true
 play(host,1500,-80)
 assert.equal(host.seen[1]?.brk,false,'the second shot is not a break')
})

test('a ball dropped in the first instant of a shot is still counted by a guest',()=>{
 // The cue ball is a few units from a ball that is itself right beside a pocket,
 // and the host has only just synced, so its next snapshot is 40ms away. The
 // ball is hit and gone well before that: the guest's first snapshot of the shot
 // no longer has it, and only the state from before the shot can show it dropped.
 const {host,guest}=pair()
 host.breakShot=false
 host.balls.forEach((b,i)=>{if(i>1)b.on=false})
 Object.assign(host.balls[0],{x:350,y:110});Object.assign(host.balls[1],{x:350,y:58})
 host.sync();host.seen.length=0;guest.seen.length=0
 host.clock=1000;host.sent=1000               // just synced
 play(host,0,-3000)
 assert.deepEqual(host.seen[0].potted,[host.balls[1].n],'the host saw it')
 assert.deepEqual(guest.seen[0].potted,[host.balls[1].n],'and so did the guest, from the state before the shot')
})

test('the winning shot carries the winner, on both sides',()=>{
 const {host,guest}=pair('9ball')
 host.breakShot=false
 host.balls.forEach((b,i)=>{if(i>0&&b.n!==9)b.on=false})
 Object.assign(host.balls[0],{x:350,y:300});Object.assign(host.balls[host.balls.findIndex(b=>b.n===9)],{x:350,y:130})
 host.sync();host.seen.length=0;guest.seen.length=0
 play(host,0,-1100)
 assert.equal(host.over,true)
 assert.equal(host.seen[0].winner,'a');assert.equal(guest.seen[0].winner,'a')
})

test('drill shots produce no shot events: they are not games',()=>{
 const d=DRILLS[0]
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{drill:d,mode:'8ball',turn:'a',me:'a',host:true,phase:'aim',over:false,result:'',finished:false,round:1,
  groups:{a:null,b:null},assignment:null,calledPocket:null,ballInHand:false,placed:false,practice:false,ready:true,
  shots:{a:0,b:0},acc:0,flash(){},sync(){},setSpin(){},onFinish(){},power:{value:50},powerOut:{},spin:{a:0,b:0}})
 g.resetRack();g.seen=[];g.onShot=e=>g.seen.push(e)
 g.angle=d.hint.angle;g.power.value=d.hint.power;g.aiming=true;g.takeShot()
 let now=0;for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 clearTimeout(g.retryTimer)
 assert.equal(g.seen.length,0)
})

test('a shot that ends before the host sends a single roll snapshot is still reported by a guest',()=>{
 const {host,guest}=pair('9ball')
 // the cue ball scratches at once: the host goes from aim to aim, turn passed, ball in hand
 host.balls[0].on=false;host.turn='b';host.ballInHand=true
 host.sync()
 assert.equal(guest.seen.length,1)
 assert.deepEqual(guest.seen[0],{by:'a',potted:[],foul:true,brk:true,mode:'9ball',winner:null})
})
