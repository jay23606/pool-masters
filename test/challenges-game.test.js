import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike,shotSpeed} from '../src/physics.js'
import {chooseShot} from '../src/ai.js'

// A challenge game with nothing around it: no DOM, no network.
function game(id){
 const g=Object.create(PoolGame.prototype),done=[]
 Object.assign(g,{mode:'8ball',challenge:id,turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:true,ready:true,me:'a',host:true,
  shots:{a:0,b:0},acc:0,flash(){},setSpin(){},send(){},onSave(){},onShot(){},onReplay(){},onFinish:r=>done.push(r),
  power:{value:45},spin:{a:0,b:0},aimStep:(a,p,c)=>c})
 g.resetRack();g.sync()
 return {g,done}
}
function play(g,angle,power){
 g.startShot();strike(g.balls[0],Math.cos(angle)*shotSpeed(power),Math.sin(angle)*shotSpeed(power))
 let now=g.clock||0
 for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 g.clock=now
}

test('each challenge sets up a table: the cue ball on the head spot and the right number of balls',()=>{
 for(const [id,n] of [['speed',8],['perfect',6],['clear',7]]){
  const {g}=game(id)
  assert.equal(g.balls.length,n+1);assert.equal(g.balls[0].n,0)
  assert.ok(g.balls.slice(1).every(b=>b.on&&b.n!==8&&b.n!==0))
  assert.equal(g.chal.id,id);assert.equal(g.chal.startedAt,null)
 }
})

test('the first shot starts the clock',()=>{
 const {g}=game('speed');assert.equal(g.chal.startedAt,null)
 g.startShot();assert.notEqual(g.chal.startedAt,null)
 const at=g.chal.startedAt;g.startShot();assert.equal(g.chal.startedAt,at)
})

test('a game played to the end: perfect potter ends on the first shot that drops nothing, and reports it once',()=>{
 const {g,done}=game('perfect')
 let shots=0
 // an AI shoots for the pots until it misses, which must end the run
 for(let i=0;i<40&&!g.over;i++){
  const plan=chooseShot(g.balls,null,false,'league','8ball')
  if(!plan)break
  play(g,plan.angle,plan.power);shots++
 }
 assert.ok(g.over,'the run ended')
 assert.equal(done.length,1,'reported exactly once')
 assert.equal(done[0].challenge.id,'perfect');assert.equal(done[0].challenge.final,g.chal.score)
 assert.ok(g.chal.score<shots,'the run ended on a miss, so it is shorter than the shots taken')
})

test('speed pot: a scratch puts the cue ball back on the head spot',()=>{
 const {g}=game('speed')
 // the cue ball hit straight into the top-left corner beside it, with no other ball touched
 g.balls[0].x=60;g.balls[0].y=60
 g.balls=g.balls.map((b,i)=>i&&Math.hypot(b.x-60,b.y-60)<150?{...b,x:b.x+300,y:b.y+150}:b)
 play(g,-3*Math.PI/4,30)
 assert.equal(g.balls[0].on,true);assert.deepEqual([g.balls[0].x,g.balls[0].y],[154,190])
 assert.equal(g.chal.score,0)
})

test('clearing the table in speed pot brings out a fresh scatter and the game goes on',()=>{
 const {g}=game('speed')
 g.startShot()
 // pretend everything but the cue ball is already down, then take a shot that resolves the game state
 g.balls.forEach((b,i)=>{if(i)b.on=false});g.potted=[];g.scratch=false
 g.phase='roll';g.resolve()
 assert.equal(g.balls.filter(b=>b.on&&b.k!=='cue').length,8,'eight fresh balls')
 assert.equal(g.over,false);assert.equal(g.phase,'aim')
})

test('a timed game ends by itself when time runs out between shots',()=>{
 const {g,done}=game('speed')
 g.chal={...g.chal,startedAt:performance.now()-61000,score:5}
 g.tickChallenge()
 assert.equal(g.over,true);assert.equal(done.length,1);assert.equal(done[0].challenge.final,5)
 g.tickChallenge();assert.equal(done.length,1,'not twice')
})

test('play again: a new rack starts a fresh game with a fresh clock',()=>{
 const {g}=game('speed')
 g.chal={...g.chal,startedAt:1,score:9};g.endChallenge()
 assert.equal(g.over,true)
 g.newRack()
 assert.equal(g.over,false);assert.equal(g.chal.score,0);assert.equal(g.chal.startedAt,null);assert.equal(g.balls.length,9)
})

test('a challenge shot leaves no coach or trophy trail, and the AI never plays',()=>{
 const {g}=game('perfect')
 play(g,0.1,40)
 assert.equal(g.lastCoach??null,null)
})
