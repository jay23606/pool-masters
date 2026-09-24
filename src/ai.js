import {R,PR,MINX,MAXX,MINY,MAXY,POCKETS} from './table.js'
import {integrate,railBounce,substeps,atRest,strike,shotSpeed} from './physics.js'
import {remaining,validCueSpot,nearestPocket,normalizeGroup} from './rules.js'

// The practice opponent, as pure functions over a ball array. It never touches
// the game object, so it can be run, measured and tested on its own -- which is
// how the throw correction and the escape rollout below were tuned.

// Measured from the collision model: throw rises with the cut angle and then
// saturates once ball-on-ball friction is fully mobilised, at about 3.4 degrees.
const THROW_MAX=.06,THROW_K=.155

export const AI_LEVELS={
 beginner:{label:'Beginner',aimError:.13,powerError:12,safetyCut:.72},
 league:{label:'League',aimError:.03,powerError:4,safetyCut:.34},
 pro:{label:'Pro',aimError:.008,powerError:1,safetyCut:.16},
}
export const difficultyFor=level=>AI_LEVELS[level]||AI_LEVELS.league

// which balls this player is allowed to hit first
export function legalTargets(balls,group){
 return balls.filter(b=>b.on&&b.k!=='cue'&&
  (group?b.k===(remaining(balls,group)?group:'eight'):b.k!=='eight'))
}

// Is the straight line from `from` to (tx,ty) free of other balls?
export function pathClear(balls,from,tx,ty,skip=[]){
 const dx=tx-from.x,dy=ty-from.y,len=Math.hypot(dx,dy)
 if(!len)return false
 const ux=dx/len,uy=dy/len
 for(const b of balls){
  if(!b.on||b===from||skip.includes(b))continue
  const t=(b.x-from.x)*ux+(b.y-from.y)*uy
  if(t<=0||t>=len)continue
  if(Math.abs((b.x-from.x)*-uy+(b.y-from.y)*ux)<2*R-.5)return false
 }
 return true
}

// Where the cue ball has to be at contact to send `t` along (dx,dy).
// A plain ghost ball is not enough: friction between the two balls throws the
// object ball a few degrees off the line of centres on any cut, so the line of
// centres has to be rotated back by the same amount. Real players make the
// same allowance, and one pass is enough because the throw angle barely moves
// once the cut is roughly known.
export function aimFor(cue,t,dx,dy){
 let nx=dx,ny=dy,out=null
 for(let pass=0;pass<2;pass++){
  const gx=t.x-nx*2*R,gy=t.y-ny*2*R
  const cx=gx-cue.x,cy=gy-cue.y,cd=Math.hypot(cx,cy)
  if(cd<1)return null
  const ux=cx/cd,uy=cy/cd
  out={gx,gy,cd,cut:ux*dx+uy*dy,angle:Math.atan2(cy,cx)}
  if(pass)break
  const cross=ux*ny-uy*nx
  const throwAngle=Math.sign(cross)*Math.min(THROW_MAX,THROW_K*Math.abs(cross))
  const c=Math.cos(throwAngle),s=Math.sin(throwAngle)
  nx=dx*c-dy*s;ny=dx*s+dy*c
 }
 return out
}

// For every legal ball and every pocket, work out where the cue ball has to
// be at contact, reject blocked or near-90-degree cuts, and take the best.
export function bestShot(balls,group){
 const cue=balls[0]
 let best=null
 for(const t of legalTargets(balls,group))for(let pi=0;pi<POCKETS.length;pi++){
  const[px,py]=POCKETS[pi]
  const ax=px-t.x,ay=py-t.y,ad=Math.hypot(ax,ay)
  if(!ad)continue
  const aim=aimFor(cue,t,ax/ad,ay/ad)
  if(!aim||aim.cut<=.15)continue
  if(!pathClear(balls,cue,aim.gx,aim.gy,[t])||!pathClear(balls,t,px,py,[cue]))continue
  const score=aim.cut*1.7-aim.cd/900-ad/700
  if(!best||score>best.score)
   best={score,cut:aim.cut,angle:aim.angle,pocket:pi,target:t,power:Math.min(92,32+aim.cd/16+ad/20)}
 }
 return best
}

// No pot on: prefer a ball there is actually a clear path to, rather than just
// the closest one -- shoving the cue at the nearest ball regardless of what
// stood in the way is how this used to crash into the eight.
export function safetyTarget(balls,group){
 const cue=balls[0]
 return legalTargets(balls,group).map(t=>{
  const d=Math.hypot(t.x-cue.x,t.y-cue.y)||1
  const cx=t.x-(t.x-cue.x)/d*2*R,cy=t.y-(t.y-cue.y)/d*2*R
  return{t,d,clear:pathClear(balls,cue,cx,cy,[t])?1:0}
 }).sort((a,b)=>b.clear-a.clear||a.d-b.d)[0]
}

// Roll the cue ball forward through the real physics and report what it hits
// first. Only the cue moves before that contact, so this is cheap.
export function simulateFirstHit(balls,angle,power){
 const cue={...balls[0]},others=balls.filter((b,i)=>i>0&&b.on)
 strike(cue,Math.cos(angle)*shotSpeed(power),Math.sin(angle)*shotSpeed(power))
 const dt=1/60
 for(let t=0;t<3.5;t+=dt){
  const n=substeps([cue],dt)
  for(let k=0;k<n;k++){
   integrate(cue,dt/n)
   for(const q of POCKETS)if(Math.hypot(cue.x-q[0],cue.y-q[1])<PR)return null   // scratch
   railBounce(cue)
   for(const o of others)if(Math.hypot(o.x-cue.x,o.y-cue.y)<2*R)return o
  }
  if(atRest(cue))return null
 }
 return null
}

// Snookered: no legal ball has a clear straight path. Approximating a bank off
// the mirror line would be wrong for this cushion model, which sheds normal
// speed while keeping tangential, so try real shots instead and keep the first
// angle that makes a legal contact.
export function escapeShot(balls,want){
 const start=Math.random()*Math.PI*2
 for(const power of [52,74])for(let i=0;i<40;i++){
  const angle=start+i*Math.PI*2/40
  const hit=simulateFirstHit(balls,angle,power)
  if(hit&&(want?hit.k===want:hit.k!=='eight'))return{angle,power}
 }
 return null
}

// Ball in hand: the spot that opens up the best shot.
export function bestCueSpot(balls,group){
 const cue=balls[0],origin={x:cue.x,y:cue.y}
 let best={score:-Infinity,x:origin.x,y:origin.y}
 for(let i=1;i<8;i++)for(let j=1;j<5;j++){
  const p={x:MINX+(MAXX-MINX)*i/8,y:MINY+(MAXY-MINY)*j/5}
  if(!validCueSpot(balls,p))continue
  cue.x=p.x;cue.y=p.y
  const plan=bestShot(balls,group)
  const score=plan?plan.score:-1
  if(score>best.score)best={score,x:p.x,y:p.y}
 }
 cue.x=origin.x;cue.y=origin.y
 return {x:best.x,y:best.y}
}

// The whole turn in one call: where to put the cue ball if it is in hand, which
// pocket to call, and the shot itself. Returns null only if there is nothing
// legal left to hit at all.
export function chooseShot(balls,group,ballInHand,level='league'){
 const difficulty=difficultyFor(level)
 group=normalizeGroup(group)
 const place=ballInHand?bestCueSpot(balls,group):null
 if(place){balls[0].x=place.x;balls[0].y=place.y}
 const cue=balls[0]
 const shot=bestShot(balls,group)
 if(shot&&shot.cut>=difficulty.safetyCut){
  return {place,angle:shot.angle+(Math.random()-.5)*difficulty.aimError/Math.max(.45,shot.cut),
          power:shot.power+(Math.random()-.5)*difficulty.powerError,pocket:shot.target.k==='eight'?shot.pocket:null}
 }
 const pick=safetyTarget(balls,group)
 if(!pick)return null
 const t=pick.t,pocket=t.k==='eight'?nearestPocket(t):null
 if(pick.clear)return {place,pocket,
  angle:Math.atan2(t.y-cue.y,t.x-cue.x)+(Math.random()-.5)*difficulty.aimError,power:26+Math.random()*14}
 const want=group?(remaining(balls,group)?group:'eight'):null
 const esc=escapeShot(balls,want)
 return esc?{place,pocket,angle:esc.angle,power:esc.power}
           :{place,pocket,angle:Math.atan2(t.y-cue.y,t.x-cue.x),power:30}
}
