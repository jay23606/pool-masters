import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike,shotSpeed} from '../src/physics.js'
import {rack,ONE_POCKET} from '../src/rules.js'
import {chooseShot,bankShot,legalTargets,bestShot} from '../src/ai.js'
import {snapshotOf,applySnapshot} from '../src/game-state.js'
import {isGameMessage} from '../src/protocol.js'

function host(mode){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{mode,turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:true,calledPocket:null,ballInHand:false,placed:false,practice:true,hotSeat:true,names:{a:'A',b:'B'},
  ready:true,shots:{a:0,b:0},acc:0,flash(){},setSpin(){},balls:rack(mode),me:'a',host:true,send(){},onSave(){},onFinish(){},onShot(){},
  score:{a:0,b:0}})
 g.sync()
 return g
}
function play(g,angle,power){
 g.startShot();strike(g.balls[0],Math.cos(angle)*shotSpeed(power),Math.sin(angle)*shotSpeed(power))
 let now=g.clock||0
 for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 g.clock=now
}

// Two AIs play whole games to a finish: no shot may crash, the score may only go up, a game must end
// with a winner, and every point must be one the rules allow.
for(const mode of ['bank','onepocket']){
 test(`${mode}: two AIs play whole games to a winner`,()=>{
  let banked=0,shots=0
  for(let n=0;n<3;n++){
   const g=host(mode)
   let last={a:0,b:0}
   for(let i=0;i<220&&!g.over;i++){
    const plan=chooseShot(g.balls,null,g.ballInHand,'league',mode,{player:g.turn})
    if(!plan)break
    if(plan.place){g.balls[0].x=plan.place.x;g.balls[0].y=plan.place.y;g.ballInHand=false}
    const before=g.score.a+g.score.b
    play(g,plan.angle,plan.power);shots++
    for(const p of ['a','b'])assert.ok(g.score[p]>=last[p],'scores never go down')
    last={...g.score}
    if(g.score.a+g.score.b>before)banked++
    assert.ok(g.score.a+g.score.b<=15,'no more points than balls')
   }
   assert.ok(g.over,`${mode} game ${n} did not finish`)
   assert.ok(g.result==='a'||g.result==='b')
   assert.ok(g.score[g.result]>=g.score[g.result==='a'?'b':'a'],'the winner has the most points')
  }
  assert.ok(banked>=3,`${mode}: the AIs only scored on ${banked} of ${shots} shots`)
 })
}

test('the score travels in a snapshot, and an old snapshot without one is a nil-nil game',()=>{
 const g=host('bank');g.score={a:3,b:5}
 const snap=JSON.parse(JSON.stringify(snapshotOf(g)))
 assert.ok(isGameMessage(snap));assert.deepEqual(snap.score,{a:3,b:5});assert.equal(snap.mode,'bank')
 const guest=host('bank');applySnapshot(guest,snap);assert.deepEqual(guest.score,{a:3,b:5})
 const old={...snap};delete old.score;applySnapshot(guest,old);assert.deepEqual(guest.score,{a:0,b:0})
 assert.ok(isGameMessage(old),'a snapshot from before these modes still validates')
})

test('a hostile snapshot cannot smuggle in a bad score or an unknown game',()=>{
 const snap=JSON.parse(JSON.stringify(snapshotOf(host('onepocket'))))
 assert.ok(isGameMessage(snap))
 for(const bad of [{a:-1,b:0},{a:99,b:0},{a:1.5,b:0},{a:'x',b:0},{a:1},null,7])assert.equal(isGameMessage({...snap,score:bad}),false,JSON.stringify(bad))
 assert.equal(isGameMessage({...snap,mode:'12ball'}),false)
 assert.equal(isGameMessage({...snap,b:snap.b.slice(1)}),false,'wrong ball count for the game')
})

test('one-pocket marks the shooter\'s own pocket, and other games mark only a called one',()=>{
 const g=host('onepocket')
 assert.equal(g.markedPocket(),ONE_POCKET.a);g.turn='b';assert.equal(g.markedPocket(),ONE_POCKET.b)
 const e=host('8ball');e.calledPocket=3;assert.equal(e.markedPocket(),3)
})

test('the AI plays for its own pocket in one-pocket, and only from the balls on the table in bank pool',()=>{
 const g=host('onepocket');g.balls.forEach((b,i)=>{if(i>3)b.on=false})
 const plan=bestShot(g.balls,null,'onepocket',{pockets:[ONE_POCKET.b]})
 if(plan)assert.equal(plan.pocket,ONE_POCKET.b)
 assert.equal(legalTargets(g.balls,null,'bank').length,g.balls.filter(b=>b.on&&b.n!==0).length)
})

test('a bank shot the AI chooses really does bank the ball',()=>{
 let found=0
 for(let seed=0;seed<6&&found<2;seed++){
  const balls=rack('bank');balls.forEach((b,i)=>{if(i>1&&(i+seed)%3)b.on=false})
  const s=bankShot(balls,Infinity)
  if(!s)continue
  found++
  assert.equal(s.banked,true)
  const g=host('bank');g.balls=balls.map(b=>({...b}));g.score={a:0,b:0}
  play(g,s.angle,s.power)
  assert.ok(g.score.a>=1,'the shot it chose scored a bank')
 }
 assert.ok(found>=1,'the search found at least one bank on these tables')
})
