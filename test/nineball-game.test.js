import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike} from '../src/physics.js'
import {freshRackState} from '../src/game-state.js'
import {R} from '../src/table.js'

// These run whole shots through the real simulation loop and the real
// resolve(), with only the DOM and the network stubbed. The rules have their
// own tests; this is about the wiring between them and the game.
const ball=(n,x,y)=>({id:n,n,x,y,on:true,k:n===0?'cue':n===8?'eight':n<8?'solid':'stripe',vx:0,vy:0,wx:0,wy:0,wz:0})
function game(balls,extra={}){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{mode:'9ball',balls,turn:'a',me:'a',host:true,phase:'aim',over:false,result:'',
  finished:false,round:1,groups:{a:null,b:null},assignment:null,breakShot:false,calledPocket:null,
  ballInHand:false,placed:false,practice:false,ready:true,shots:{a:0,b:0},acc:0,
  flash(){},sync(){},setSpin(){},onFinish(){},...extra})
 return g
}
function play(g,vx,vy){
 g.startShot()
 strike(g.balls[0],vx,vy)
 let now=0
 for(let i=0;i<6000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 assert.equal(g.phase,'aim','the shot should settle')
 return g
}

test('pocketing the 9 straight away, with nothing else on the table, wins the rack',()=>{
 const g=game([ball(0,350,300),ball(9,350,120)])
 play(g,0,-1100)
 assert.equal(g.over,true);assert.equal(g.result,'a')
})

test('hitting the wrong ball first is a foul: ball in hand, turn passes, the cue ball comes back',()=>{
 const g=game([ball(0,200,190),ball(1,500,60),ball(5,330,190)])
 play(g,900,0)
 assert.equal(g.firstHit.n,5)
 assert.equal(g.turn,'b');assert.equal(g.ballInHand,true)
 assert.equal(g.balls[0].on,true);assert.equal(g.over,false)
})

test('a legal hit that sends a ball to a cushion passes the turn with no foul',()=>{
 const g=game([ball(0,200,190),ball(1,450,190),ball(9,560,80)])
 play(g,900,0)
 assert.equal(g.firstHit.n,1)
 assert.equal(g.railHit,true,'the balls reached the end cushion')
 assert.equal(g.ballInHand,false,'no foul, so no ball in hand')
 assert.equal(g.turn,'b')
})

test('a gentle hit that never reaches a cushion and pockets nothing is a foul',()=>{
 const g=game([ball(0,300,190),ball(1,340,190),ball(9,560,80)])
 play(g,130,0)
 assert.equal(g.firstHit?.n,1)
 assert.equal(g.railHit,false)
 assert.equal(g.ballInHand,true,'the cushion rule gave the opponent ball in hand')
 assert.equal(g.turn,'b')
})

test('potting a ball on a legal shot keeps the turn, and the ball stays down',()=>{
 const g=game([ball(0,350,300),ball(1,350,120),ball(9,560,80)])
 play(g,0,-1100)
 assert.equal(g.balls.find(b=>b.n===1).on,false)
 assert.equal(g.turn,'a');assert.equal(g.ballInHand,false)
})

test('the 9 pocketed on a foul is put back on the table and the rack goes on',()=>{
 // the 1 is still up, so driving the 9 into a pocket first is a foul
 const g=game([ball(0,350,300),ball(1,120,80),ball(9,350,120)])
 play(g,0,-1100)
 const nine=g.balls.find(b=>b.n===9)
 assert.equal(g.over,false,'a 9 potted on a foul must not end the rack')
 assert.equal(nine.on,true,'the 9 is back on the table')
 assert.deepEqual([nine.x,nine.y],[420,190],'on the foot spot')
 assert.equal(g.turn,'b');assert.equal(g.ballInHand,true)
})

test('the lowest ball is recorded when the shot is taken, so potting it mid-shot cannot excuse a wrong first hit',()=>{
 const g=game([ball(0,350,300),ball(2,350,120),ball(3,600,60)])
 g.startShot()
 assert.equal(g.lowest,2)
 g.balls.find(b=>b.n===2).on=false
 assert.equal(g.lowest,2,'still the ball that had to be hit')
})

test('a new nine-ball rack is ten balls and stays nine-ball',()=>{
 const g=game([ball(0,100,190)])
 g.resetRack()
 assert.equal(g.balls.length,10);assert.equal(g.mode,'9ball')
 g.over=true;g.newRack=PoolGame.prototype.newRack;g.newRack()
 assert.equal(g.balls.length,10);assert.equal(g.round,2)
})

test('an eight-ball game is still sixteen balls',()=>{
 const g=game([ball(0,100,190)],{mode:'8ball'})
 g.resetRack()
 assert.equal(g.balls.length,16);assert.equal(g.mode,'8ball')
})

test('in nine-ball the 8 is an ordinary ball: aiming at it is not refused and shooting goes ahead',()=>{
 const balls=[ball(0,200,190),ball(8,400,190)]
 const g=game(balls,{power:{value:50},spin:{a:0,b:0},angle:0,aiming:true})
 // the 8 is the lowest ball here, so this is a perfectly legal shot
 g.takeShot()
 assert.equal(g.phase,'roll')
})

test('in eight-ball the same aim at the 8 is refused until the group is cleared',()=>{
 const balls=[ball(0,200,190),ball(8,400,190),ball(3,500,60)]
 const g=game(balls,{mode:'8ball',groups:{a:'solid',b:'stripe'},power:{value:50},spin:{a:0,b:0},angle:0,aiming:true})
 g.takeShot()
 assert.equal(g.phase,'aim')
})

test('the nine-ball HUD names the lowest ball and needs no groups',()=>{
 const el=()=>({textContent:'',className:'',hidden:false,disabled:false})
 const g=game([ball(0,200,190),ball(4,400,190),ball(9,500,60)],{groupStatus:el(),status:el(),shoot:el(),moveCue:el(),changePocket:el(),aiming:true})
 g.updateHud()
 assert.match(g.groupStatus.textContent,/LOWEST ON TABLE: 4/)
 assert.match(g.status.textContent,/hit the 4 first/)
 assert.equal(g.changePocket.hidden,true,'there are no called pockets')
 g.ballInHand=true;g.updateHud()
 assert.match(g.status.textContent,/Ball in hand/)
 g.over=true;g.result='a';g.updateHud()
 assert.equal(g.status.textContent,'You won the rack')
})

test('a fresh nine-ball state has no groups and starts on the break',()=>{
 const s=freshRackState('9ball')
 assert.equal(s.breakShot,true);assert.deepEqual(s.groups,{a:null,b:null})
 assert.ok(s.balls.every(b=>b.on))
})

// ---- whole racks ----

import {chooseShot} from '../src/ai.js'
import {shotSpeed} from '../src/physics.js'
import {rack} from '../src/rules.js'

// Two AI players on the real game loop, judged by the real rules. Nothing here
// is scripted: whatever the AI does, the game has to stay consistent and reach
// a winner.
function selfPlay(seed){
 const g=game(rack('9ball'),{breakShot:true,practice:false})
 let shots=0,fouls=0
 const hist=[];g.onShotResult=r=>{if(r.foul)fouls++;hist.push(r.foul?r.reason:r.potted.length?'pot'+r.potted.join('+'):'safe')}
 const problems=[]
 while(!g.over&&shots<400){
  const plan=chooseShot(g.balls,null,g.ballInHand,'league','9ball')
  if(!plan){problems.push('the AI found nothing to play');break}
  if(plan.place){g.balls[0].x=plan.place.x;g.balls[0].y=plan.place.y;g.ballInHand=false}
  g.startShot()
  const s=shotSpeed(plan.power)
  strike(g.balls[0],Math.cos(plan.angle)*s,Math.sin(plan.angle)*s)
  let now=0
  for(let i=0;i<8000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
  shots++
  if(g.phase!=='aim'){problems.push('a shot never settled');break}
  if(g.balls.length!==10)problems.push('ball count changed to '+g.balls.length)
  // with ball in hand the cue waits at its default spot until it is placed, so
  // it may legitimately sit inside a ball for a moment
  const on=g.balls.filter(b=>b.on&&!(b.n===0&&g.ballInHand))
  for(let i=0;i<on.length;i++)for(let j=i+1;j<on.length;j++)
   if(Math.hypot(on[i].x-on[j].x,on[i].y-on[j].y)<2*R-1)problems.push(`balls ${on[i].n} and ${on[j].n} overlap after a shot`)
  if(!g.over&&!g.balls[0].on)problems.push('the cue ball is missing with the game still on')
  if(!g.over&&!g.balls.find(b=>b.n===9).on)problems.push('the 9 is off the table with the game still on')
  g.breakShot=false
 }
 return {over:g.over,winner:g.result,shots,fouls,problems,seed,hist,table:g.balls.filter(b=>b.on).map(b=>b.n+'@'+Math.round(b.x)+','+Math.round(b.y)).join(' '),turn:g.turn,ballInHand:g.ballInHand}
}

test('full AI-versus-AI nine-ball racks always finish with a winner and a consistent table',{timeout:120000},()=>{
 let finished=0,fouls=0,shots=0;const results=[]
 for(let n=0;n<12;n++){
  const r=selfPlay(n)
  assert.deepEqual(r.problems,[],`rack ${n}: ${r.problems.join('; ')}`)
  if(r.over){finished++;assert.ok(r.winner==='a'||r.winner==='b')}
  results.push([r.over,r.shots]);fouls+=r.fouls;shots+=r.shots
 }
 assert.equal(finished,12,'every rack should reach a winner within 400 shots; results: '+JSON.stringify(results))
 assert.ok(shots>12,'racks should take more than one shot')
 assert.ok(fouls>0,'twelve racks of AI play should include fouls, or the foul path is not being exercised')
})
