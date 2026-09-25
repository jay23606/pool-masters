import {R,PR,POCKETS} from './table.js'

// Aim snapping. While a player aims, the line the object ball will take (the one drawn from the
// ball being hit) is checked against every pocket; if it would pass within reach of a pocket's
// mouth, the aim is nudged so that line runs through the pocket's centre.
//
// It only ever moves the aim a little, and only toward a shot that is a real one: the cue ball
// must still hit the same ball first, with nothing in the way. Pure, so it can be tested.

export const REACH=.85            // how far off the pocket's centre the line may pass, in pocket radii
export const MAX_TURN=3           // the most the aim will move, in degrees

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

// The aim to show for `angle`: either it, or the nearest aim that sends the ball it would hit
// through the middle of a pocket. Returns {angle,pocket}, with pocket null when nothing snapped.
export function snapAim(balls,angle,{reach=REACH*PR,maxTurn=MAX_TURN}={}){
 const none={angle,pocket:null}
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
  const[px,py]=POCKETS[i]
  const dx=px-b.x,dy=py-b.y,dist=Math.hypot(dx,dy)
  if(dist<=PR)continue                                    // already on the pocket: nothing to aim at
  const along=dx*ux+dy*uy
  if(along<=0)continue                                    // the pocket is behind the line
  const lateral=Math.abs(dx*uy-dy*ux)
  if(lateral>reach)continue
  // the cue ball position that sends the ball straight at the pocket's centre
  const gx=b.x-dx/dist*2*R,gy=b.y-dy/dist*2*R
  const aim=Math.atan2(gy-c.y,gx-c.x)
  const turn=turnBetween(aim,angle)*180/Math.PI
  if(turn>maxTurn)continue
  // it has to be a real shot: still that ball first, and nothing else in the way
  if(firstBall(balls,aim)?.ball!==b)continue
  if(!best||lateral<best.lateral)best={aim,pocket:i,lateral}
 }
 return best?{angle:best.aim,pocket:best.pocket}:none
}
