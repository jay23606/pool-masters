import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {integrate,ballCollide,railBounce,substeps,atRest,strike} from '../src/physics.js'
import {R,PR,POCKETS,MINX,MAXX,MINY,MAXY} from '../src/table.js'
const shotSpeed=v=>120+Math.pow(Math.max(1,Math.min(100,v))/100,1.45)*3080

// The AI methods only touch ball state, so they can be exercised on a bare
// object borrowing the prototype — no DOM, no network, no renderer.
function table(balls,group='solid'){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{balls,turn:'b',phase:'aim',over:false,groups:{a:'stripe',b:group},calledPocket:null,practice:true})
 g.flash=()=>{}
 return g
}
const ball=(x,y,k,n=1)=>({x,y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k,n})

function settle(g){
 const dt=1/60
 for(let t=0;t<20;t+=dt){
  const n=substeps(g.balls,dt)
  for(let s=0;s<n;s++){
   for(const b of g.balls){
    if(!b.on)continue
    integrate(b,dt/n)
    for(const q of POCKETS)if(Math.hypot(b.x-q[0],b.y-q[1])<PR){b.on=false;break}
    if(b.on)railBounce(b)
   }
   for(let i=0;i<g.balls.length;i++)for(let j=i+1;j<g.balls.length;j++){
    const a=g.balls[i],b=g.balls[j]
    if(a.on&&b.on)ballCollide(a,b)
   }
  }
  if(g.balls.every(b=>!b.on||atRest(b)))break
 }
}

test('the planner finds a pottable ball and lines up on the ghost ball',()=>{
 // solid 1 sits straight in front of the top middle pocket, cue straight below
 const g=table([ball(350,300,'cue',0),ball(350,120,'solid',1)])
 const shot=g.bestShot()
 assert.ok(shot,'expected a shot to be found')
 assert.equal(shot.pocket,1,'should choose the top middle pocket')
 assert.ok(shot.cut>.98,`should see this as a near-straight shot, cut=${shot.cut}`)
 assert.ok(Math.abs(shot.angle+Math.PI/2)<.02,'should aim straight up the table')
})

test('the AI actually pots the ball it aimed at, most of the time',()=>{
 let made=0
 for(let i=0;i<25;i++){
  const g=table([ball(350,300,'cue',0),ball(350,120,'solid',1)])
  g.aiShot()
  settle(g)
  if(!g.balls[1].on)made++
 }
 assert.ok(made>=15,`only potted ${made}/25 straight shots`)
})

test('the planner refuses a shot blocked by another ball',()=>{
 const g=table([
  ball(350,300,'cue',0),
  ball(350,120,'solid',1),
  ball(350,210,'stripe',9)      // sitting squarely in the cue ball's way
 ])
 const shot=g.bestShot()
 assert.ok(!shot||shot.target!==g.balls[1],'should not fire straight through the stripe')
 assert.equal(g.pathClear(g.balls[0],350,120,[]),false)
})

test('the planner will not cut a ball backwards into a pocket behind it',()=>{
 // ball sits just past the top middle pocket, so potting it means reversing
 const g=table([ball(350,300,'cue',0),ball(350,60,'solid',1)])
 const shot=g.bestShot()
 if(shot)assert.notEqual(shot.pocket,4,'the bottom middle pocket is behind the cue ball')
})

test('a legal shot is still taken when nothing is pottable',()=>{
 // every ball walled off from every pocket by its own blocker
 const g=table([ball(350,300,'cue',0),ball(60,190,'solid',1)])
 g.balls.push(ball(60,190+2*R+1,'stripe',9),ball(60,190-2*R-1,'stripe',10))
 g.aiShot()
 assert.equal(g.phase,'roll','the AI should always play something')
 assert.ok(Math.hypot(g.balls[0].vx,g.balls[0].vy)>0,'and it should hit the cue ball')
})

test('the AI calls a pocket before shooting at the eight',()=>{
 const g=table([ball(350,300,'cue',0),ball(350,120,'eight',8)],'solid')
 g.aiShot()
 assert.equal(typeof g.calledPocket,'number','the eight needs a called pocket')
 assert.equal(g.calledPocket,1)
})

test('the planner allows for throw, so a perfectly aimed cut still drops',()=>{
 // Without a throw correction this exact shot misses: ball-on-ball friction
 // pushes the object a few degrees off the line of centres.
 const g=table([ball(230,250,'cue',0),ball(350,120,'solid',1)])
 const shot=g.bestShot()
 assert.ok(shot,'expected a shot')
 g.startShot()
 strike(g.balls[0],Math.cos(shot.angle)*shotSpeed(shot.power),Math.sin(shot.angle)*shotSpeed(shot.power))
 settle(g)
 assert.ok(!g.balls[1].on,'a cut aimed with no jitter should be potted')
})

test('the throw correction moves the aim off the naive ghost ball on a cut',()=>{
 const g=table([ball(230,250,'cue',0),ball(350,120,'solid',1)])
 const t=g.balls[1],naive={x:t.x-0*2*R,y:t.y+1*2*R}   // pocket 1 is straight above
 const aim=g.aimFor(g.balls[0],t,0,-1)
 assert.ok(Math.hypot(aim.gx-naive.x,aim.gy-naive.y)>.4,'expected a visible correction')
 const straight=table([ball(350,300,'cue',0),ball(350,120,'solid',1)])
 const none=straight.aimFor(straight.balls[0],straight.balls[1],0,-1)
 assert.ok(Math.hypot(none.gx-naive.x,none.gy-naive.y)<.05,'a straight shot needs no correction')
})

test('the AI uses ball in hand instead of leaving it set for the next player',()=>{
 const g=table([ball(154,190,'cue',0),ball(500,120,'solid',1),ball(300,300,'solid',2)])
 g.ballInHand=true
 g.aiShot()
 assert.equal(g.ballInHand,false,'ball in hand must not leak to the opponent')
 const cue=g.balls[0]
 assert.ok(cue.x>=MINX&&cue.x<=MAXX&&cue.y>=MINY&&cue.y<=MAXY,'cue placed on the table')
 assert.ok(!g.balls.slice(1).some(b=>b.on&&Math.hypot(b.x-cue.x,b.y-cue.y)<2*R),'cue not placed inside a ball')
})

test('a safety picks a ball it can actually reach, not just the nearest one',()=>{
 // nearest legal ball is screened by the eight; a farther one is wide open
 const g=table([
  ball(350,300,'cue',0),
  ball(350,150,'solid',1),          // nearest, but blocked
  ball(350,225,'eight',8),          // the screen
  ball(120,300,'solid',2)           // farther, clear
 ])
 const pick=g.safetyTarget()
 assert.ok(pick,'expected a safety target')
 assert.equal(pick.t.n,2,'should pass over the screened ball')
 assert.equal(pick.clear,1)
})

test('when snookered the AI finds an angle that legally makes contact',()=>{
 const balls=[ball(60,190,'cue',0)]
 for(let i=0;i<5;i++)balls.push(ball(60+2*R+1,190-40+i*20,'solid',i+1))   // a wall of the other group
 balls.push(ball(600,100,'stripe',9),ball(620,300,'stripe',10),ball(400,190,'eight',8))
 const g=table(balls,'stripe')
 assert.equal(g.safetyTarget().clear,0,'this position really is snookered')
 const esc=g.escapeShot('stripe')
 assert.ok(esc,'expected an escape to be found')
 const hit=g.simulateFirstHit(esc.angle,esc.power)
 assert.ok(hit,'the escape should make contact')
 assert.equal(hit.k,'stripe','and it should be a legal ball')
})
