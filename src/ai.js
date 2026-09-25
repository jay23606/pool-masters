import {R,PR,MINX,MAXX,MINY,MAXY,POCKETS} from './table.js'
import {integrate,railBounce,ballCollide,substeps,atRest,strike,shotSpeed} from './physics.js'
import {STEP} from './predict.js'
import {remaining,validCueSpot,nearestPocket,normalizeGroup,lowestBall,isScoreMode,isRotation,ONE_POCKET} from './rules.js'

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
 // the extra rungs the career ladder needs between and beyond the three a player can pick
 novice:{label:'Novice',aimError:.2,powerError:16,safetyCut:.85},
 club:{label:'Club',aimError:.07,powerError:8,safetyCut:.5},
 ace:{label:'Ace',aimError:.015,powerError:2,safetyCut:.24},
 legend:{label:'Legend',aimError:.004,powerError:.5,safetyCut:.12},
}
// The coach plays the best shot it can see, every time: no aim or power error, and the same
// answer for the same table. It is not a level a player can pick.
const COACH={label:'Coach',aimError:0,powerError:0,safetyCut:.16}
export const difficultyFor=level=>level==='coach'?COACH:AI_LEVELS[level]||AI_LEVELS.league

// which balls this player is allowed to hit first. In nine-ball that is exactly
// one ball -- the lowest on the table -- whoever is shooting.
export function legalTargets(balls,group,mode='8ball'){
 if(isScoreMode(mode))return balls.filter(b=>b.on&&b.k!=='cue')     // bank pool and one-pocket: any ball
 if(isRotation(mode)){const low=lowestBall(balls);return balls.filter(b=>b.on&&b.n===low)}
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
// `opts.pockets` limits which pockets count (one-pocket: only your own).
export function bestShot(balls,group,mode='8ball',opts={}){
 const cue=balls[0]
 let best=null
 for(const t of legalTargets(balls,group,mode))for(let pi=0;pi<POCKETS.length;pi++){
  if(opts.pockets&&!opts.pockets.includes(pi))continue
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

// The pockets a player may score in: all of them, except in one-pocket where it is their own.
const pocketsFor=(mode,ctx)=>mode==='onepocket'?{pockets:[ONE_POCKET[ctx?.player||'b']]}:{}

// Bank shots. Mirror each pocket across each cushion line and aim the object ball at the mirror
// image: the ball then meets the cushion and rebounds to the real pocket. This cushion sheds speed,
// so the geometry is only a guide -- every candidate is played out on a copy of the table, and
// only one that really banks the ball into a pocket is returned. `budgetMs` bounds the search so
// a turn never stalls; the coach passes Infinity so that its answer does not depend on the clock.
export function bankShot(balls,budgetMs=350){
 const cue=balls[0],cands=[]
 const lines=[{axis:'x',v:MINX},{axis:'x',v:MAXX},{axis:'y',v:MINY},{axis:'y',v:MAXY}]
 for(const t of balls){
  if(!t.on||t.k==='cue')continue
  for(let pi=0;pi<POCKETS.length;pi++)for(const L of lines){
   const[px,py]=POCKETS[pi]
   const vx=L.axis==='x'?2*L.v-px:px,vy=L.axis==='y'?2*L.v-py:py
   const ax=vx-t.x,ay=vy-t.y,ad=Math.hypot(ax,ay)
   if(!ad)continue
   // the rebound has to happen on the table: where the line to the mirror pocket crosses the cushion
   const u=L.axis==='x'?(L.v-t.x)/ax:(L.v-t.y)/ay
   if(!(u>0&&u<1))continue
   const cx=t.x+ax*u,cy=t.y+ay*u
   if(L.axis==='x'?(cy<MINY||cy>MAXY):(cx<MINX||cx>MAXX))continue
   const aim=aimFor(cue,t,ax/ad,ay/ad)
   if(!aim||aim.cut<=.2||!pathClear(balls,cue,aim.gx,aim.gy,[t]))continue
   cands.push({angle:aim.angle,target:t,pocket:pi,cut:aim.cut,score:aim.cut*1.5-aim.cd/900-ad/900})
  }
 }
 cands.sort((a,b)=>b.score-a.score)
 const start=Date.now()
 for(const c of cands.slice(0,40)){
  if(Date.now()-start>budgetMs)break
  for(const power of [48,68]){
   const r=rollout(balls,c.angle,power)
   if(!r.scratch&&r.firstHit&&r.potted.includes(c.target.n)&&r.railBalls.includes(c.target.n))
    return {angle:c.angle,power,cut:1,pocket:c.pocket,target:c.target,score:c.score,banked:true}
  }
 }
 return null
}

// No pot on: prefer a ball there is actually a clear path to, rather than just
// the closest one -- shoving the cue at the nearest ball regardless of what
// stood in the way is how this used to crash into the eight.
export function safetyTarget(balls,group,mode='8ball'){
 const cue=balls[0]
 return legalTargets(balls,group,mode).map(t=>{
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

// Play a shot out to the end on a copy of the table, stepping exactly as the
// real game does, and report what it did. The AI uses this to see its own
// scratches and illegal contacts before it shoots -- without it, a ball sitting
// beside a pocket had the cue ball follow it in on every attempt, forever.
export function rollout(balls,angle,power,maxSeconds=8,spin=[0,0],onFrame=null){
 const bs=balls.map(b=>({...b}))
 const s=shotSpeed(power)
 strike(bs[0],Math.cos(angle)*s,Math.sin(angle)*s,spin[0],spin[1])
 let firstHit=null,railHit=false,scratch=false,cueRailFirst=false
 const potted=[],pockets={},railBalls=new Set()
 for(let t=0;t<maxSeconds;t+=STEP){
  const n=substeps(bs,STEP),h=STEP/n
  for(let k=0;k<n;k++){
   for(const b of bs){
    if(!b.on)continue
    integrate(b,h)
    const p=POCKETS.findIndex(q=>Math.hypot(b.x-q[0],b.y-q[1])<PR)
    if(p>=0){b.on=false;if(b.k==='cue')scratch=true;else{potted.push(b.n);pockets[b.n]=p};continue}
    if(railBounce(b)){
     railBalls.add(b.n)
     if(firstHit)railHit=true
     if(b.k==='cue'&&!firstHit)cueRailFirst=true
    }
   }
   for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){
    const a=bs[i],b=bs[j]
    if(!a.on||!b.on)continue
    if(ballCollide(a,b)&&!firstHit){if(a.k==='cue')firstHit=b;else if(b.k==='cue')firstHit=a}
   }
  }
  onFrame?.(bs,t)
  if(bs.every(b=>!b.on||atRest(b)))break
 }
 return {scratch,firstHit:firstHit&&{n:firstHit.n,k:firstHit.k},railHit,potted,pockets,railBalls:[...railBalls],cueRailFirst,
  cue:{x:bs[0].x,y:bs[0].y,on:bs[0].on}}
}

// Snookered: no legal ball has a clear straight path. Approximating a bank off
// the mirror line would be wrong for this cushion model, which sheds normal
// speed while keeping tangential, so try real shots instead and keep the first
// angle that makes a legal contact.
export function escapeShot(balls,want,mode='8ball'){
 const start=Math.random()*Math.PI*2
 const low=isRotation(mode)?lowestBall(balls):null
 for(const power of [52,74])for(let i=0;i<40;i++){
  const angle=start+i*Math.PI*2/40
  const hit=simulateFirstHit(balls,angle,power)
  if(!hit)continue
  if(isRotation(mode)?hit.n===low:(isScoreMode(mode)||(want?hit.k===want:hit.k!=='eight')))return{angle,power}
 }
 return null
}

// Ball in hand: the spot that opens up the best shot. Spots are ranked by the
// pot they give, then walked best-first until one whose shot does not foul --
// the best-looking pot is often a straight-in shot at a ball beside a pocket,
// from where the cue ball follows it in.
export function bestCueSpot(balls,group,mode='8ball',ctx){
 const cue=balls[0],origin={x:cue.x,y:cue.y}
 const spots=[]
 for(let i=1;i<8;i++)for(let j=1;j<5;j++){
  const p={x:MINX+(MAXX-MINX)*i/8,y:MINY+(MAXY-MINY)*j/5}
  if(!validCueSpot(balls,p))continue
  cue.x=p.x;cue.y=p.y
  const plan=bestShot(balls,group,mode,pocketsFor(mode,ctx))
  spots.push({x:p.x,y:p.y,score:plan?plan.score:-1})
 }
 spots.sort((p,q)=>q.score-p.score)
 let pick=spots[0]||{x:origin.x,y:origin.y}
 for(const sp of spots.slice(0,10)){
  cue.x=sp.x;cue.y=sp.y
  const plan=planOnce(balls,group,'pro',mode,null,ctx)
  if(plan&&!fouls(balls,plan,group,mode)){pick=sp;break}
 }
 cue.x=origin.x;cue.y=origin.y
 return {x:pick.x,y:pick.y}
}

// Would this plan foul? Play it out and see, the way a player checks that the
// cue ball is not about to follow the object ball into the pocket. Only fouls
// are screened: a shot that simply misses its pot is still a legitimate shot,
// so the difficulty levels keep their aim errors.
export function fouls(balls,plan,group,mode){
 return Boolean(foulReason(balls,rollout(balls,plan.angle,plan.power),group,mode))
}

// Why a played-out shot (rollout()'s result, from these balls) is a foul, or null if it is
// legal: 'scratch', 'no-contact', 'wrong-first', 'no-rail' or 'early-8'.
export function foulReason(balls,r,group,mode){
 if(r.scratch)return 'scratch'
 if(!r.firstHit)return 'no-contact'
 if(isRotation(mode)){
  if(r.firstHit.n!==lowestBall(balls))return 'wrong-first'
  return !r.potted.length&&!r.railHit?'no-rail':null     // the cushion rule
 }
 const legal=legalTargets(balls,group,mode)
 if(!legal.some(t=>t.n===r.firstHit.n))return 'wrong-first'
 // pocketing the 8 before it is yours loses the game outright
 return r.potted.includes(8)&&!legal.some(t=>t.k==='eight')?'early-8':null
}

// The whole turn in one call: where to put the cue ball if it is in hand, which
// pocket to call, and the shot itself. Returns null only if there is nothing
// legal left to hit at all.
//
// A plan is drawn, played out on a copy of the table, and redrawn if it would
// foul -- each redraw gets fresh aim noise and alternately a little less or a
// little more power.
export function chooseShot(balls,group,ballInHand,level='league',mode='8ball',ctx={player:'b'}){
 group=normalizeGroup(group)
 const place=ballInHand?bestCueSpot(balls,group,mode,ctx):null
 if(place){balls[0].x=place.x;balls[0].y=place.y}
 let first=null
 for(let attempt=0;attempt<10;attempt++){
  const plan=planOnce(balls,group,level,mode,place,ctx)
  if(!plan)return null
  // softer helps a cue ball that follows its target in; harder helps a shot
  // that dies before reaching a cushion
  const step=Math.ceil(attempt/2)
  plan.power=Math.min(100,Math.max(18,plan.power*(attempt%2?1-.07*step:1+.09*step)))
  first??=plan
  if(!fouls(balls,plan,group,mode))return plan
 }
 return first     // every draw fouled: take the first, at least it was the AI's best idea
}

// One draw of the plan, with this attempt's aim noise.
function planOnce(balls,group,level,mode,place,ctx){
 const difficulty=difficultyFor(level)
 // nine-ball has no called pockets, so nothing here ever names one
 const calls=t=>!isRotation(mode)&&t.k==='eight'
 const cue=balls[0]
 // bank pool wants a bank; one-pocket only your own pocket; the others, any pot
 const shot=mode==='bank'?bankShot(balls,level==='coach'?Infinity:350):bestShot(balls,group,mode,pocketsFor(mode,ctx))
 if(shot&&shot.cut>=difficulty.safetyCut){
  return {place,angle:shot.angle+(Math.random()-.5)*difficulty.aimError/Math.max(.45,shot.cut),
          power:shot.power+(Math.random()-.5)*difficulty.powerError,pocket:calls(shot.target)?shot.pocket:null}
 }
 const pick=safetyTarget(balls,group,mode)
 if(!pick)return null
 const t=pick.t,pocket=calls(t)?nearestPocket(t):null
 if(pick.clear)return {place,pocket,
  angle:Math.atan2(t.y-cue.y,t.x-cue.x)+(Math.random()-.5)*difficulty.aimError,power:26+Math.random()*14}
 const want=group?(remaining(balls,group)?group:'eight'):null
 const esc=escapeShot(balls,want,mode)
 return esc?{place,pocket,angle:esc.angle,power:esc.power}
           :{place,pocket,angle:Math.atan2(t.y-cue.y,t.x-cue.x),power:30}
}
