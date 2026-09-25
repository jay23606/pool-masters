import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike,shotSpeed} from '../src/physics.js'
import {rack,MODES,isScoreMode,isRotation,MONEY,targetFor,judgeShot,judgeScoreGame,judgeNineBall,nineRespot,trianglePositions,SCORE_TARGET} from '../src/rules.js'
import {chooseShot,legalTargets} from '../src/ai.js'
import {snapshotOf,applySnapshot} from '../src/game-state.js'
import {isGameMessage} from '../src/protocol.js'
import {createRecorder,pack,unpack} from '../src/replay.js'
import {R} from '../src/table.js'

const ball=(n,on=true)=>({n,on,k:n===0?'cue':n===8?'eight':n<8?'solid':'stripe'})

// ---- ten-ball ----
test('ten-ball is nine-ball with one more ball: a triangle of ten with the 1 at the apex and the 10 in the middle',()=>{
 assert.equal(MODES['10ball'].balls,11);assert.equal(isRotation('10ball'),true);assert.equal(isRotation('8ball'),false)
 assert.equal(MONEY['10ball'],10)
 for(let i=0;i<20;i++){
  const r=rack('10ball')
  assert.equal(r.length,11);assert.deepEqual(r.map(b=>b.n).sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8,9,10])
  const apex=trianglePositions(4)[0],mid=trianglePositions(4)[4]
  assert.equal(r.find(b=>b.n===1).x,apex[0]);assert.equal(r.find(b=>b.n===10).x,mid[0]);assert.equal(r.find(b=>b.n===10).y,mid[1])
 }
})

test('ten-ball is judged like nine-ball, with the 10 as the money ball',()=>{
 const shot=o=>({mode:'10ball',turn:'a',potted:[],scratch:false,firstHit:{n:1},lowest:1,railHit:false,...o})
 assert.equal(judgeShot(shot({potted:[ball(10)]})).winner,'a')
 assert.equal(judgeShot(shot({potted:[ball(9)]})).winner,null,'the 9 is just a ball in ten-ball')
 assert.equal(judgeShot(shot({potted:[ball(9)]})).nextTurn,'a')
 const foul=judgeShot(shot({potted:[ball(10)],scratch:true}))
 assert.equal(foul.foul,true);assert.equal(foul.respotNine,true);assert.equal(foul.respotBall,10,'the 10 goes back, not the 9')
 assert.equal(judgeShot(shot({firstHit:{n:2}})).reason,'wrong-first')
 assert.equal(judgeShot(shot()).reason,'no-rail')
 // nine-ball itself is unchanged
 assert.equal(judgeNineBall({mode:'9ball',turn:'a',potted:[ball(9)],scratch:true,firstHit:{n:1},lowest:1,railHit:false}).respotBall,9)
})

test('the money ball goes back to the foot spot, or the next free one, whichever ball it is',()=>{
 const balls=[{n:0,on:true,x:100,y:100},{n:10,on:false,x:0,y:0},{n:1,on:true,x:420,y:190}]
 const p=nineRespot(balls,10);assert.ok(Math.hypot(p.x-420,p.y-190)>=2*R,'not inside the ball on the spot')
})

test('the AI rule of hitting the lowest ball first applies to ten-ball too',()=>{
 const balls=rack('10ball')
 assert.deepEqual(legalTargets(balls,null,'10ball').map(b=>b.n),[1])
})

// ---- straight pool ----
test('straight pool is a scored game: fifteen balls, thirty to win, every ball counts',()=>{
 assert.equal(isScoreMode('straight'),true);assert.equal(MODES.straight.balls,16)
 assert.equal(targetFor('straight'),30);assert.equal(targetFor('bank'),SCORE_TARGET);assert.equal(targetFor('onepocket'),8)
 assert.equal(rack('straight').length,16)
})

const table=(...on)=>[ball(0),...[...Array(15)].map((_,i)=>ball(i+1,on.includes(i+1)))]
const sp=o=>({mode:'straight',turn:'a',score:{a:0,b:0},potted:[],pockets:{},railBalls:[],scratch:false,firstHit:{n:3},balls:table(1,2,3,4,5),...o})

test('straight pool: every ball scores for the shooter, in any pocket, banked or not, and the turn stays',()=>{
 const v=judgeScoreGame(sp({potted:[ball(3),ball(4)],pockets:{3:0,4:5}}))
 assert.deepEqual(v.score,{a:2,b:0});assert.equal(v.nextTurn,'a');assert.equal(v.foul,false)
})

test('straight pool: a miss passes the turn; a foul costs a point and scores nothing',()=>{
 assert.equal(judgeScoreGame(sp()).nextTurn,'b')
 const f=judgeScoreGame(sp({scratch:true,potted:[ball(3)],score:{a:5,b:0}}))
 assert.deepEqual(f.score,{a:4,b:0});assert.equal(f.foul,true);assert.equal(f.nextTurn,'b');assert.deepEqual(f.wasted,[3])
 assert.deepEqual(judgeScoreGame(sp({firstHit:null})).score,{a:-1,b:0},'a score can go below nothing')
})

test('straight pool: thirty wins, and the table is racked again when one ball is left',()=>{
 assert.equal(judgeScoreGame(sp({score:{a:29,b:3},potted:[ball(3)],pockets:{3:0}})).winner,'a')
 assert.equal(judgeScoreGame(sp({score:{a:28,b:3},potted:[ball(3)],pockets:{3:0}})).winner,null)
 const one=judgeScoreGame(sp({balls:table(5),potted:[ball(3)],pockets:{3:0}}));assert.equal(one.rerack,true)
 assert.equal(judgeScoreGame(sp({balls:table(4,5)})).rerack,false,'two left is still a game')
 assert.equal(judgeScoreGame(sp({balls:table(),potted:[ball(3)],pockets:{3:0}})).rerack,true,'none left racks all fifteen')
 assert.equal(judgeScoreGame(sp({balls:table(5),score:{a:29,b:0},potted:[ball(3)],pockets:{3:0}})).rerack,false,'the winning shot does not re-rack')
 assert.equal(judgeScoreGame(sp({mode:'bank',balls:table(5),potted:[ball(3)],railBalls:[3]})).rerack,false,'only straight pool re-racks')
})

// a host game to play the re-rack through the real game object
function host(mode){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{mode,turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:true,hotSeat:true,names:{a:'A',b:'B'},
  ready:true,shots:{a:0,b:0},acc:0,flash(){},setSpin(){},balls:rack(mode),me:'a',host:true,send(){},onSave(){},onFinish(){},onShot(){},score:{a:0,b:0}})
 g.sync();return g
}
function play(g,angle,power){
 g.startShot();strike(g.balls[0],Math.cos(angle)*shotSpeed(power),Math.sin(angle)*shotSpeed(power))
 let now=g.clock||0
 for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 g.clock=now
}

test('re-racking: the fourteen go back in a triangle around the ball that was left, and the count is right',()=>{
 const g=host('straight')
 g.balls.forEach((b,i)=>{if(i&&b.n!==5)b.on=false});g.balls.find(b=>b.n===5).x=250;g.balls.find(b=>b.n===5).y=120
 g.reRack()
 const on=g.balls.filter(b=>b.on&&b.k!=='cue')
 assert.equal(on.length,15,'all fifteen are on the table again')
 const left=g.balls.find(b=>b.n===5);assert.deepEqual([left.x,left.y],[250,120],'the ball that was left stays where it was')
 for(let i=0;i<on.length;i++)for(let j=i+1;j<on.length;j++)assert.ok(Math.hypot(on[i].x-on[j].x,on[i].y-on[j].y)>2*R-.01,'no two balls overlap')
 const apex=trianglePositions(5)[0]
 assert.ok(!on.some(b=>b.n!==5&&Math.hypot(b.x-apex[0],b.y-apex[1])<1),'the apex is left open')
})

test('re-racking: a ball left in the way of the rack goes on the apex',()=>{
 const g=host('straight')
 g.balls.forEach((b,i)=>{if(i&&b.n!==5)b.on=false});const five=g.balls.find(b=>b.n===5);five.x=480;five.y=200
 g.reRack()
 const apex=trianglePositions(5)[0];assert.deepEqual([five.x,five.y],apex)
 const on=g.balls.filter(b=>b.on&&b.k!=='cue')
 for(let i=0;i<on.length;i++)for(let j=i+1;j<on.length;j++)assert.ok(Math.hypot(on[i].x-on[j].x,on[i].y-on[j].y)>2*R-.01)
})

test('re-racking never leaves the cue ball inside the rack',()=>{
 const g=host('straight');g.balls.forEach((b,i)=>{if(i)b.on=false});g.balls[0].x=430;g.balls[0].y=190
 g.reRack()
 assert.ok(g.balls.filter(b=>b.k!=='cue'&&b.on).every(b=>Math.hypot(b.x-g.balls[0].x,b.y-g.balls[0].y)>=2*R))
})

// ---- the games, played through ----
for(const [mode,cap] of [['10ball',300],['straight',700]]){
 test(`${mode}: two AIs play a whole game to a winner`,()=>{
  const g=host(mode);let n=0
  for(;n<cap&&!g.over;n++){
   const plan=chooseShot(g.balls,null,g.ballInHand,'league',mode,{player:g.turn})
   if(!plan)break
   if(plan.place){g.balls[0].x=plan.place.x;g.balls[0].y=plan.place.y;g.ballInHand=false}
   play(g,plan.angle,plan.power)
   if(mode==='straight'&&!g.over){
    assert.ok(g.balls.filter(b=>b.on&&b.k!=='cue').length>=2,'the table never sits at one ball: it is re-racked')
    assert.ok(Math.abs(g.score.a)<=60&&Math.abs(g.score.b)<=60)
   }
  }
  assert.ok(g.over,`${mode} did not finish in ${cap} shots`)
  assert.ok(g.result==='a'||g.result==='b')
  if(mode==='straight')assert.ok(g.score[g.result]>=30)
 })
}

test('ten-ball and straight pool cross the network and replay validation',async()=>{
 for(const mode of ['10ball','straight']){
  const g=host(mode);g.score={a:3,b:-2}
  const snap=JSON.parse(JSON.stringify(snapshotOf(g)))
  assert.ok(isGameMessage(snap),mode);assert.equal(snap.mode,mode)
  const guest=host(mode);applySnapshot(guest,snap);assert.deepEqual(guest.score,{a:3,b:-2})
  const rec=createRecorder(mode,7);rec.frame(0,g.balls);rec.frame(40,g.balls)
  const back=await unpack(await pack(rec.finish()));assert.equal(back.mode,mode);assert.equal(back.ids.length,MODES[mode].balls)
 }
 const bad=JSON.parse(JSON.stringify(snapshotOf(host('10ball'))));bad.b[1][4]=11
 assert.equal(isGameMessage(bad),false,'an 11 cannot be on a ten-ball table')
 const nine=JSON.parse(JSON.stringify(snapshotOf(host('9ball'))));assert.ok(isGameMessage(nine))
 nine.b[1][4]=10;assert.equal(isGameMessage(nine),false,'nine-ball still stops at 9')
})
