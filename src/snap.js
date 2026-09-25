import {rollout} from './ai.js'
import {R,PR,POCKETS,MINX,MAXX,MINY,MAXY} from './table.js'

// Aim snapping. While a player aims, the line the object ball will take (the one drawn from the
// ball being hit) is checked against every pocket; if it would pass within reach of a pocket's
// mouth, the aim is nudged so that line runs through the pocket's centre.
//
// It only ever moves the aim a little, and only toward a shot that is a real one: the cue ball
// must still hit the same ball first, with nothing in the way. Pure, so it can be tested.

export const REACH=.85            // how far off the pocket's centre the line may pass, in pocket radii
export const MAX_TURN=3           // the most the aim will move, in degrees
export const BANK_REACH=.6        // and how far off centre a one-cushion bank may pass, in pocket radii (it is a longer shot)
export const BANK_PENALTY=1.6     // a bank has to be this much closer than a direct line to win over it

// The first ball a ray from the cue ball meets: {ball,t} with t the distance to the moment of contact.
// The same test the aim line uses.
export function firstBall(balls,angle){
 const c=balls[0],dx=Math.cos(angle),dy=Math.sin(angle)
 let best=null
 for(let i=1;i<balls.length;i++){
  const b=balls[i]
  if(!b.on)continue
  const ox=b.x-c.x,oy=b.y-c.y,p=ox*dx+oy*dy,s=ox*ox+oy*oy-p*p
  if(p>R&&s<=4*R*R){const t=p-Math.sqrt(4*R*R-s);if(!best||t<best.t)best={ball:b,t}}
 }
 return best
}

const turnBetween=(a,b)=>{let d=(a-b)%(2*Math.PI);if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;return Math.abs(d)}

// The four cushion lines the object ball's centre bounces off. A bank to a pocket is found by
// mirroring the pocket across one: the ball then heads for the mirror image in a straight line.
const RAILS=()=>[{axis:'x',v:MINX},{axis:'x',v:MAXX},{axis:'y',v:MINY},{axis:'y',v:MAXY}]

// The aim to show for `angle`: either it, or the nearest aim that sends the ball it would hit
// through the middle of a pocket. Returns {angle,pocket}, with pocket null when nothing snapped.
export function snapAim(balls,angle,{reach=REACH*PR,maxTurn=MAX_TURN,bankReach=BANK_REACH*PR,banks=true}={}){
 const none={angle,pocket:null,bank:null}
 const c=balls[0]
 if(!c||!c.on)return none
 const hit=firstBall(balls,angle)
 if(!hit)return none
 const b=hit.ball
 // where the cue ball is at contact, and so which way the ball being hit will go
 const cx=c.x+Math.cos(angle)*hit.t,cy=c.y+Math.sin(angle)*hit.t
 const ux=(b.x-cx)/(2*R),uy=(b.y-cy)/(2*R)
 let best=null
 for(let i=0;i<POCKETS.length;i++){
  const[qx,qy]=POCKETS[i]
  if(Math.hypot(qx-b.x,qy-b.y)<=PR)continue                // already on the pocket: nothing to aim at
  const targets=[{x:qx,y:qy,bank:null,reach,weight:1}]
  if(banks)RAILS().forEach((L,ri)=>{
   const mx=L.axis==='x'?2*L.v-qx:qx,my=L.axis==='y'?2*L.v-qy:qy
   // the bounce has to happen on the table, between the ball and its mirror pocket
   const u=L.axis==='x'?(L.v-b.x)/(mx-b.x):(L.v-b.y)/(my-b.y)
   if(!(u>0&&u<1))return
   const bx=b.x+(mx-b.x)*u,by=b.y+(my-b.y)*u
   if(L.axis==='x'?(by<MINY||by>MAXY):(bx<MINX||bx>MAXX))return
   targets.push({x:mx,y:my,bank:ri,reach:bankReach,weight:BANK_PENALTY})
  })
  for(const T of targets){
  const dx=T.x-b.x,dy=T.y-b.y,dist=Math.hypot(dx,dy)
  if(!dist)continue
  const along=dx*ux+dy*uy
  if(along<=0)continue                                    // the target is behind the line
  const lateral=Math.abs(dx*uy-dy*ux)
  if(lateral>T.reach)continue
  // the cue ball position that sends the ball straight at the pocket's centre
  const gx=b.x-dx/dist*2*R,gy=b.y-dy/dist*2*R
  const aim=Math.atan2(gy-c.y,gx-c.x)
  const turn=turnBetween(aim,angle)*180/Math.PI
  if(turn>maxTurn)continue
  // it has to be a real shot: still that ball first, and nothing else in the way
  if(firstBall(balls,aim)?.ball!==b)continue
  const score=lateral*T.weight
  if(!best||score<best.score)best={aim,pocket:i,bank:T.bank,score}
  }
 }
 return best?{angle:best.aim,pocket:best.pocket,bank:best.bank}:none
}

// The geometric aim sends the ball at the pocket's centre, but a real cut shot throws the ball a little off that line,
// so the geometric aim misses about a third of the time. This asks the physics: it tries every aim within `range` degrees
// of `angle` at this power and spin, finds the runs of aims that really pot the ball, and returns the middle of the widest
// run, the aim with the most room for error on both sides. When no nearby aim pots it, the geometric aim is kept.
export function refineAim(balls,angle,{target,power,spin=[0,0],range=2.5,step=.25}={}){
 if(target==null||!(power>0))return angle
 const n=Math.round(range/step),ok=[]
 for(let i=-n;i<=n;i++){
  const a=angle+i*step*Math.PI/180
  const r=rollout(balls,a,power,2.5,spin)
  ok.push(!r.scratch&&r.potted.includes(target)&&(r.firstHit?r.firstHit.n===target:true))
 }
 let best=null
 for(let i=0;i<ok.length;){
  if(!ok[i]){i++;continue}
  let j=i;while(j+1<ok.length&&ok[j+1])j++
  const mid=(i+j)/2-n,len=j-i+1
  if(!best||len>best.len||(len===best.len&&Math.abs(mid)<Math.abs(best.mid)))best={len,mid}
  i=j+1
 }
 return best?angle+best.mid*step*Math.PI/180:angle
}
