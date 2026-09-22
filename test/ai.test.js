import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {bestShot,safetyTarget,escapeShot,simulateFirstHit,aimFor,pathClear,chooseShot} from '../src/ai.js'
import {integrate,ballCollide,railBounce,substeps,atRest,strike,shotSpeed} from '../src/physics.js'
import {R,PR,POCKETS,MINX,MAXX,MINY,MAXY} from '../src/table.js'

// The planner is a plain function over a ball array now, so most of this needs
// no game object at all.
const ball=(x,y,k,n=1)=>({x,y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k,n})

function settle(balls){
 const dt=1/60
 for(let t=0;t<20;t+=dt){
  const n=substeps(balls,dt)
  for(let s=0;s<n;s++){
   for(const b of balls){
    if(!b.on)continue
    integrate(b,dt/n)
    for(const q of POCKETS)if(Math.hypot(b.x-q[0],b.y-q[1])<PR){b.on=false;break}
    if(b.on)railBounce(b)
   }
   for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
    const a=balls[i],b=balls[j]
    if(a.on&&b.on)ballCollide(a,b)
   }
  }
  if(balls.every(b=>!b.on||atRest(b)))break
 }
 return balls
}
const fire=(balls,plan)=>{
 const s=shotSpeed(plan.power)
 strike(balls[0],Math.cos(plan.angle)*s,Math.sin(plan.angle)*s)
 return settle(balls)
}

test('the planner finds a pottable ball and lines up on the ghost ball',()=>{
 const balls=[ball(350,300,'cue',0),ball(350,120,'solid',1)]
 const shot=bestShot(balls,'solid')
 assert.ok(shot,'expected a shot to be found')
 assert.equal(shot.pocket,1,'should choose the top middle pocket')
 assert.ok(shot.cut>.98,`should see this as a near-straight shot, cut=${shot.cut}`)
 assert.ok(Math.abs(shot.angle+Math.PI/2)<.02,'should aim straight up the table')
})

test('the AI actually pots the ball it aimed at, most of the time',()=>{
 let made=0
 for(let i=0;i<25;i++){
  const balls=[ball(350,300,'cue',0),ball(350,120,'solid',1)]
  fire(balls,chooseShot(balls,'solid',false))
  if(!balls[1].on)made++
 }
 assert.ok(made>=15,`only potted ${made}/25 straight shots`)
})

test('the planner refuses a shot blocked by another ball',()=>{
 const balls=[ball(350,300,'cue',0),ball(350,120,'solid',1),ball(350,210,'stripe',9)]
 const shot=bestShot(balls,'solid')
 assert.ok(!shot||shot.target!==balls[1],'should not fire straight through the stripe')
 assert.equal(pathClear(balls,balls[0],350,120,[]),false)
})

test('the planner will not cut a ball backwards into a pocket behind it',()=>{
 const shot=bestShot([ball(350,300,'cue',0),ball(350,60,'solid',1)],'solid')
 if(shot)assert.notEqual(shot.pocket,4,'the bottom middle pocket is behind the cue ball')
})

test('the planner allows for throw, so a perfectly aimed cut still drops',()=>{
 // Without a throw correction this exact shot misses: ball-on-ball friction
 // pushes the object a few degrees off the line of centres.
 const balls=[ball(230,250,'cue',0),ball(350,120,'solid',1)]
 const shot=bestShot(balls,'solid')
 assert.ok(shot,'expected a shot')
 fire(balls,{angle:shot.angle,power:shot.power})
 assert.ok(!balls[1].on,'a cut aimed with no jitter should be potted')
})

test('the throw correction moves the aim off the naive ghost ball on a cut',()=>{
 const t=ball(350,120,'solid',1),naive={x:t.x,y:t.y+2*R}     // pocket 1 is straight above
 const cut=aimFor(ball(230,250,'cue',0),t,0,-1)
 assert.ok(Math.hypot(cut.gx-naive.x,cut.gy-naive.y)>.4,'expected a visible correction')
 const straight=aimFor(ball(350,300,'cue',0),t,0,-1)
 assert.ok(Math.hypot(straight.gx-naive.x,straight.gy-naive.y)<.05,'a straight shot needs no correction')
})

test('a safety picks a ball it can actually reach, not just the nearest one',()=>{
 // nearest legal ball is screened by the eight; a farther one is wide open
 const balls=[ball(350,300,'cue',0),ball(350,150,'solid',1),ball(350,225,'eight',8),ball(120,300,'solid',2)]
 const pick=safetyTarget(balls,'solid')
 assert.ok(pick,'expected a safety target')
 assert.equal(pick.t.n,2,'should pass over the screened ball')
 assert.equal(pick.clear,1)
})

test('when snookered the AI finds an angle that legally makes contact',()=>{
 const balls=[ball(60,190,'cue',0)]
 for(let i=0;i<5;i++)balls.push(ball(60+2*R+1,190-40+i*20,'solid',i+1))   // a wall of the other group
 balls.push(ball(600,100,'stripe',9),ball(620,300,'stripe',10),ball(400,190,'eight',8))
 assert.equal(safetyTarget(balls,'stripe').clear,0,'this position really is snookered')
 const esc=escapeShot(balls,'stripe')
 assert.ok(esc,'expected an escape to be found')
 const hit=simulateFirstHit(balls,esc.angle,esc.power)
 assert.ok(hit,'the escape should make contact')
 assert.equal(hit.k,'stripe','and it should be a legal ball')
})

test('a legal shot is still played when nothing is pottable',()=>{
 const balls=[ball(350,300,'cue',0),ball(60,190,'solid',1),
              ball(60,190+2*R+1,'stripe',9),ball(60,190-2*R-1,'stripe',10)]
 const plan=chooseShot(balls,'solid',false)
 assert.ok(plan,'the AI should always play something')
 assert.equal(typeof plan.angle,'number')
})

test('the AI calls a pocket before shooting at the eight',()=>{
 const balls=[ball(350,300,'cue',0),ball(350,120,'eight',8)]
 const plan=chooseShot(balls,'solid',false)
 assert.equal(typeof plan.pocket,'number','the eight needs a called pocket')
 assert.equal(plan.pocket,1)
})

test('ball in hand is used, and the cue lands somewhere legal',()=>{
 const balls=[ball(154,190,'cue',0),ball(500,120,'solid',1),ball(300,300,'solid',2)]
 const plan=chooseShot(balls,'solid',true)
 assert.ok(plan.place,'the AI should place the cue ball rather than ignore it')
 const cue=balls[0]
 assert.ok(cue.x>=MINX&&cue.x<=MAXX&&cue.y>=MINY&&cue.y<=MAXY,'placed on the table')
 assert.ok(!balls.slice(1).some(b=>b.on&&Math.hypot(b.x-cue.x,b.y-cue.y)<2*R),'not inside another ball')
})

// These two are about the glue rather than the planner, so they do need a game.
function game(balls,group){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{balls,groups:{a:group,b:group==='solid'?'stripe':'solid'},turn:'a',me:'a',
  phase:'aim',over:false,ready:true,calledPocket:null,ballInHand:false,placed:false,practice:true})
 g.flash=()=>{}
 return g
}

test('the AI clears ball in hand rather than leaving it for the next player',()=>{
 const g=game([ball(154,190,'cue',0),ball(500,120,'stripe',9),ball(300,300,'stripe',10)],'solid')
 Object.assign(g,{turn:'b',ballInHand:true})
 g.startShot=function(){this.phase='roll';this.potted=[];this.scratch=false;this.firstHit=null;this.before=null}
 g.aiShot()
 assert.equal(g.ballInHand,false,'ball in hand must not leak to the opponent')
 assert.equal(g.phase,'roll','and it should actually take the shot')
})

test('the eight is refused while you still have balls, and the game says why',()=>{
 const g=game([ball(120,190,'cue',0),ball(400,60,'stripe',9),ball(430,330,'stripe',10),
               ball(500,260,'eight',8)],'stripe')
 assert.equal(g.canCallEight(),false,'two stripes are still up')
 assert.equal(g.eightBlocked(),2,'and the game should know it is two')
 g.aiming=true
 g.angle=Math.atan2(260-190,500-120)
 assert.equal(g.guide().hit.k,'eight','this aim really is at the eight')
 assert.equal(g.aimingAtEight(),true,'which the HUD needs to notice')
})

test('once the group is cleared the eight is callable again',()=>{
 const g=game([ball(120,190,'cue',0),ball(600,120,'solid',3),ball(500,260,'eight',8)],'stripe')
 assert.equal(g.eightBlocked(),0)
 assert.equal(g.canCallEight(),true)
})
