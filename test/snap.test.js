import test from 'node:test';import assert from 'node:assert/strict'
import {snapAim,firstBall,REACH,MAX_TURN} from '../src/snap.js'
import {bindGameInput} from '../src/game-input.js'
import {R,PR,POCKETS} from '../src/table.js'

const ball=(n,x,y,on=true)=>({n,x,y,on,k:n===0?'cue':'solid',vx:0,vy:0})
const deg=r=>r*180/Math.PI
// where the ball that `angle` would hit goes afterwards, and how far off the pocket's centre it passes
function lateralMiss(balls,angle,pocket){
 const c=balls[0],h=firstBall(balls,angle),b=h.ball
 const cx=c.x+Math.cos(angle)*h.t,cy=c.y+Math.sin(angle)*h.t
 const ux=(b.x-cx)/(2*R),uy=(b.y-cy)/(2*R),[px,py]=POCKETS[pocket]
 return Math.abs((px-b.x)*uy-(py-b.y)*ux)
}
// a cue ball and an object ball lined up on the top-middle pocket (index 1), aimed a little off
const table=(tx=350,ty=150)=>[ball(0,350,300),ball(1,tx,ty)]

test('an aim that would send the ball near a pocket is moved to send it through the middle',()=>{
 const balls=table(),straight=Math.atan2(150-300,0)
 const off=straight+0.5*Math.PI/180
 const s=snapAim(balls,off)
 assert.equal(s.pocket,1)
 assert.ok(lateralMiss(balls,off,1)>1,'the unsnapped aim was not already on centre')
 assert.ok(lateralMiss(balls,s.angle,1)<1e-6,'the snapped aim runs through the pocket centre')
 assert.ok(Math.abs(deg(s.angle-off))<=MAX_TURN)
})

test('an aim far from any pocket is left alone',()=>{
 const balls=table(200,200),a=Math.atan2(200-300,200-350)
 assert.deepEqual(snapAim(balls,a),{angle:a,pocket:null})
})

test('a shot that would hit nothing is left alone',()=>{
 assert.deepEqual(snapAim(table(),0),{angle:0,pocket:null})
})

test('it never turns the aim further than the limit, and never onto another ball',()=>{
 const balls=table(),straight=Math.atan2(-150,0)
 for(let d=-6;d<=6;d+=.1){
  const a=straight+d*Math.PI/180,s=snapAim(balls,a)
  assert.ok(Math.abs(deg(s.angle-a))<=MAX_TURN+1e-9,`turned ${deg(s.angle-a)} at ${d}`)
  if(s.pocket!==null)assert.equal(firstBall(balls,s.angle)?.ball.n,1)
 }
})

test('a snapped aim stays put when snapped again',()=>{
 const balls=table(),a=Math.atan2(-150,0)+.4*Math.PI/180
 const s=snapAim(balls,a),again=snapAim(balls,s.angle)
 assert.ok(Math.abs(again.angle-s.angle)<1e-9);assert.equal(again.pocket,s.pocket)
})

test('with a ball in the way, the snap is for the ball that would really be hit, never the one behind it',()=>{
 // the 2 sits between the cue ball and the 1: the cue ball hits the 2, so the 2 is the one that is snapped
 const balls=[...table(),ball(2,350,225)]
 for(let d=-4;d<=4;d+=.1){
  const a=Math.atan2(-150,0)+d*Math.PI/180,first=firstBall(balls,a),s=snapAim(balls,a)
  if(s.pocket!==null)assert.equal(firstBall(balls,s.angle).ball.n,first.ball.n,`at ${d}: the snap changed which ball is hit`)
 }
 // and a ball that is not on the line at all is never snapped for
 assert.equal(snapAim([ball(0,350,300),ball(1,100,300)],0).pocket,null)
})

test('a pocket behind the ball, or one it is already sitting in, is not snapped to',()=>{
 // the object ball is between the cue ball and a pocket only if the pocket is ahead: aim away from every pocket
 const balls=[ball(0,350,100),ball(1,350,230)]     // struck downward: the nearest pocket ahead is bottom-middle
 const s=snapAim(balls,Math.PI/2+.2*Math.PI/180)
 assert.ok(s.pocket===null||s.pocket===4,'only the pocket ahead can be chosen')
 const onPocket=[ball(0,350,300),ball(1,POCKETS[1][0],POCKETS[1][1]+PR*.9)]
 assert.equal(snapAim(onPocket,Math.atan2(onPocket[1].y-300,0)).pocket,null)
})

test('a smaller reach snaps less often',()=>{
 const balls=table()
 let wide=0,narrow=0
 for(let d=-4;d<=4;d+=.05){const a=Math.atan2(-150,0)+d*Math.PI/180;if(snapAim(balls,a).pocket!==null)wide++;if(snapAim(balls,a,{reach:PR*.3}).pocket!==null)narrow++}
 assert.ok(wide>narrow&&narrow>0,`${wide} vs ${narrow}`)
 assert.ok(REACH>0&&REACH<1.2)
})

// ---- the drag: the shown aim can snap, and the hand can still leave the snap ----
function harness(prefs){
 const bare={addEventListener(){},removeEventListener(){}}
 globalThis.document={addEventListener(){},removeEventListener(){},querySelector:()=>null}
 const balls=table()
 const game={balls,prefs,power:{...bare,value:45},powerOut:{},surface:{...bare,setPointerCapture(){},releasePointerCapture(){}},shoot:bare,
  moveCue:null,changePocket:null,spinPad:null,aimStep:(a,p,c)=>a+(c-p)*.3,point:e=>e,drag:true,aiming:true,angle:Math.atan2(-150,0)}
 game.pointerAngle=0
 const off=bindGameInput(game)
 return {game,move:pt=>game.handlers.move(pt),off}
}
const towards=(cue,angle)=>({x:cue.x+Math.cos(angle)*100,y:cue.y+Math.sin(angle)*100})

test('dragging: the aim snaps near a pocket and the hand can leave it again',()=>{
 const {game,move,off}=harness({snap:true})
 const cue=game.balls[0],base=Math.atan2(-150,0)
 game.pointerAngle=base
 // small wobbles around the line: the shown aim holds the snapped angle
 let snapped=null
 for(const d of [.6,.4,.5,.3]){move(towards(cue,base+d*Math.PI/180/.3*1));if(game.snapPocket===1)snapped=game.angle}
 assert.notEqual(snapped,null,'it snapped')
 // a long, steady turn away: eventually the snap lets go
 let left=false
 for(let i=1;i<=60;i++){move(towards(cue,base+i*.5*Math.PI/180));if(game.snapPocket!==1){left=true;break}}
 assert.equal(left,true,'a drag away from the pocket leaves the snap rather than sticking forever')
 off()
})

test('with snapping off the aim is exactly what the hand makes it',()=>{
 const {game,move,off}=harness({snap:false})
 const cue=game.balls[0],base=Math.atan2(-150,0);game.pointerAngle=base
 for(const d of [.6,.4,.5,.3])move(towards(cue,base+d*Math.PI/180/.3))
 assert.equal(game.snapPocket??null,null)
 assert.ok(Math.abs(game.angle-base)>1e-6,'the angle moved by the hand and was not pulled to the pocket')
 off()
})

test('an aim set by something else (a hint) is where the hand starts from',()=>{
 const {game,move,off}=harness({snap:true})
 const cue=game.balls[0];game.pointerAngle=0
 move(towards(cue,0.01))
 game.angle=1.2      // set from outside: raw must not drag it back
 game.pointerAngle=0;move(towards(cue,0))
 assert.ok(Math.abs(game.angle-1.2)<.05,`stayed near the outside setting, got ${game.angle}`)
 off()
})
