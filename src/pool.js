import {R,PR,MINX,MAXX,MINY,MAXY,POCKETS} from './table.js'
import {integrate,railBounce,ballCollide,substeps,atRest,clearMotion,strike} from './physics.js'
export const shotSpeed=v=>120+Math.pow(Math.max(1,Math.min(100,v))/100,1.45)*3080
export const aimStep=(aim,previous,current)=>aim+Math.atan2(Math.sin(current-previous),Math.cos(current-previous))*.5
export function rayToRail(x,y,dx,dy){const tx=dx>0?(MAXX-x)/dx:dx<0?(MINX-x)/dx:Infinity,ty=dy>0?(MAXY-y)/dy:dy<0?(MINY-y)/dy:Infinity;return Math.max(0,Math.min(tx>=0?tx:Infinity,ty>=0?ty:Infinity))}
export function bankPath(x,y,dx,dy,bounces=2){const points=[];for(let i=0;i<bounces;i++){const d=rayToRail(x,y,dx,dy),p={x:x+dx*d,y:y+dy*d};points.push(p);if(Math.abs(p.x-MINX)<.1||Math.abs(p.x-MAXX)<.1)dx=-dx;if(Math.abs(p.y-MINY)<.1||Math.abs(p.y-MAXY)<.1)dy=-dy;x=p.x+dx*.05;y=p.y+dy*.05}return points}
// Measured from the collision model: throw rises with the cut angle and then
// saturates once ball-on-ball friction is fully mobilised, at about 3.4 degrees.
const THROW_MAX=.06,THROW_K=.155
const STEP=1/120       // fixed simulation step, so frame pacing cannot change a shot
const CATCHUP=3        // never make up more than this much time in one go
const kind=n=>n===8?'eight':n<8?'solid':'stripe',other=t=>t==='a'?'b':'a',shuffle=a=>a.sort(()=>Math.random()-.5)
function rack(){const nums=shuffle([...Array(7)].map((_,i)=>i+1).concat([...Array(7)].map((_,i)=>i+9))),a=[{x:154,y:190,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:'cue',n:0}];nums.splice(4,0,8);let q=0;for(let row=0;row<5;row++)for(let i=0;i<=row;i++){const n=nums[q++];a.push({x:420+row*15.66,y:190+(i-row/2)*18,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:kind(n),n})}return a}
export class PoolGame{
 constructor(o){Object.assign(this,o);this.surface=o.surface||o.renderer.el;this.me=this.host?'a':'b';this.round=1;this.ready=this.practice;this.power.value=45;this.bind();this.resetRack();this.simAt=this.drawnAt=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t));if(this.host)this.background=setInterval(()=>{if(typeof document!=='undefined'&&document.hidden)this.advance(performance.now())},250);if(this.practice)this.sync()}
 resetRack(){this.balls=rack();this.turn='a';this.phase='aim';this.over=false;this.result='';this.finished=false;this.aiming=false;this.groups={a:null,b:null};this.breakShot=true;this.calledPocket=null;this.ballInHand=false;this.placed=false;this.setSpin(0,0)}
 bind(){this.handlers={power:()=>this.powerOut.textContent=this.power.value+'%',down:e=>{if(!this.canControl())return;const p=this.point(e);if(!p)return;const cue=this.balls[0];if(this.ballInHand){if(!this.validCueSpot(p))return;cue.x=p.x;cue.y=p.y;this.ballInHand=false;this.placed=true;this.pendingPlace=[p.x,p.y];this.flash('Ball in hand placed · tap again to aim');return}if(this.canCallEight()&&this.calledPocket==null){this.calledPocket=this.nearestPocket(p);this.flash('8-ball pocket marked · tap again to aim');return}const pa=Math.atan2(p.y-cue.y,p.x-cue.x);if(!this.aiming)this.angle=pa;this.aiming=true;this.drag=true;this.pointerAngle=pa;this.surface.setPointerCapture?.(e.pointerId)},move:e=>{if(!this.drag)return;const p=this.point(e);if(!p)return;const cue=this.balls[0];if(Math.hypot(p.x-cue.x,p.y-cue.y)<5)return;const a=Math.atan2(p.y-cue.y,p.x-cue.x);this.angle=aimStep(this.angle,this.pointerAngle,a);this.pointerAngle=a},up:e=>{this.handlers.move(e);this.drag=false;this.surface.releasePointerCapture?.(e.pointerId)},shoot:()=>this.takeShot(),
   // Both of these are one tap away from being set wrong by accident, so
   // neither is final until the shot is actually taken.
   moveCue:()=>{if(!this.canControl()||this.ballInHand||!this.placed)return;this.ballInHand=true;this.placed=false;this.aiming=false;this.drag=false;this.flash('Tap the table to place the cue ball')},
   changePocket:()=>{if(!this.canControl()||this.ballInHand||!this.canCallEight()||this.calledPocket==null)return;this.calledPocket=null;this.aiming=false;this.drag=false;this.flash('Tap a pocket to mark the 8-ball')}};this.power.addEventListener('input',this.handlers.power);this.surface.addEventListener('pointerdown',this.handlers.down);this.surface.addEventListener('pointermove',this.handlers.move);this.surface.addEventListener('pointerup',this.handlers.up);this.shoot.addEventListener('click',this.handlers.shoot)
  this.moveCue?.addEventListener('click',this.handlers.moveCue)
  this.changePocket?.addEventListener('click',this.handlers.changePocket)
  if(this.spinPad){
   this.spinDot=this.spinPad.firstElementChild
   Object.assign(this.handlers,{
    spinDown:e=>{this.spinDragging=true;this.spinFrom(e);this.spinPad.setPointerCapture?.(e.pointerId)},
    spinMove:e=>{if(this.spinDragging)this.spinFrom(e)},
    spinUp:()=>{this.spinDragging=false},
    spinReset:()=>this.setSpin(0,0)
   })
   this.spinPad.addEventListener('pointerdown',this.handlers.spinDown)
   this.spinPad.addEventListener('pointermove',this.handlers.spinMove)
   this.spinPad.addEventListener('pointerup',this.handlers.spinUp)
   this.spinPad.addEventListener('dblclick',this.handlers.spinReset)
   this.setSpin(0,0)
  }}
 point(e){return this.renderer.point(e)}
 setRenderer(r){this.renderer=r}
 // Tip contact point, in ball radii. Sideways is English, vertical is
 // draw/follow; both are clamped inside the miscue limit by strike().
 setSpin(a,b){this.spin={a,b};if(this.spinDot)this.spinDot.style.transform=`translate(${a*32}px,${-b*32}px)`}
 spinFrom(e){const r=this.spinPad.getBoundingClientRect();let dx=(e.clientX-r.left)/r.width*2-1,dy=(e.clientY-r.top)/r.height*2-1;const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m}this.setSpin(dx*.5,-dy*.5)}
 nearestPocket(p){return POCKETS.reduce((best,x,i)=>Math.hypot(p.x-x[0],p.y-x[1])<best.d?{i,d:Math.hypot(p.x-x[0],p.y-x[1])}:best,{i:0,d:Infinity}).i}
 validCueSpot(p){return p.x>=MINX&&p.x<=MAXX&&p.y>=MINY&&p.y<=MAXY&&!this.balls.some(b=>b.k!=='cue'&&b.on&&Math.hypot(b.x-p.x,b.y-p.y)<2*R)}
 setReady(v){this.ready=v;this.draw()}
 newRack(){if(!this.over)return;this.round++;this.resetRack();this.sync()}
 group(player=this.turn){return this.groups[player]}
 remaining(group){return this.balls.filter(b=>b.on&&b.k===group).length}
 // The eight is only legal once your own group is gone. Nothing used to say so:
 // a tap meant to call a pocket was simply swallowed.
 eightBlocked(){const g=this.group(this.me);return g?this.remaining(g):null}
 aimingAtEight(){return this.aiming&&this.canAim()&&this.guide().hit?.k==='eight'}
 canCallEight(){return this.group()&&this.remaining(this.group())===0&&this.phase==='aim'&&!this.over}
 canControl(){return this.ready&&this.phase==='aim'&&this.turn===this.me&&!this.over&&this.balls[0]?.on}
 canAim(){return this.canControl()&&!this.ballInHand}
 takeShot(){if(!this.canAim()||!this.aiming)return;const s=shotSpeed(+this.power.value),vx=Math.cos(this.angle)*s,vy=Math.sin(this.angle)*s,spin=[this.spin.a,this.spin.b];this.aiming=false;this.sfx?.cue(+this.power.value/100);this.startShot();if(this.host)strike(this.balls[0],vx,vy,spin[0],spin[1]);else this.send({t:'shot',vx,vy,spin,place:this.pendingPlace,called:this.calledPocket});this.pendingPlace=null}
 startShot(){this.placed=false;this.potted=[];this.scratch=false;this.firstHit=null;this.before=this.group()?this.remaining(this.group()):null;this.phase='roll'}
 receive(m){if(m.t==='state'&&!this.host){this.balls=m.b.map(x=>({x:x[0],y:x[1],on:x[2],k:x[3],n:x[4],vx:0,vy:0,wx:0,wy:0,wz:0}));this.turn=m.turn;this.phase=m.phase;this.over=m.over;this.round=m.round;this.groups=m.groups||this.groups;this.breakShot=!!m.breakShot;this.ballInHand=!!m.ballInHand;if(this.ballInHand)this.placed=false;this.calledPocket=m.calledPocket;if(m.result&&!this.finished){this.finished=true;this.onFinish({winner:m.result,round:m.round})}}else if(m.t==='shot'&&this.host&&this.turn==='b'&&this.phase==='aim'){if(m.place&&this.validCueSpot({x:m.place[0],y:m.place[1]})){this.balls[0].x=m.place[0];this.balls[0].y=m.place[1];this.ballInHand=false}this.calledPocket=m.called??null;this.startShot();strike(this.balls[0],m.vx,m.vy,m.spin?.[0]||0,m.spin?.[1]||0)}}
 sync(){if(this.host)this.send({t:'state',b:this.balls.map(b=>[Math.round(b.x),Math.round(b.y),b.on,b.k,b.n]),turn:this.turn,phase:this.phase,over:this.over,result:this.result||'',round:this.round,groups:this.groups,breakShot:this.breakShot,ballInHand:this.ballInHand,calledPocket:this.calledPocket})}
 sub(dt){
  for(const b of this.balls){
   if(!b.on)continue
   integrate(b,dt)
   for(const[p,q]of POCKETS.entries())if(Math.hypot(b.x-q[0],b.y-q[1])<PR){b.on=false;if(b.k==='cue')this.scratch=true;else this.potted.push(b);if(b.k==='eight')this.eightPocket=p;this.flash(b.k==='cue'?'Scratch!':b.k==='eight'?'8-ball potted!':`${b.k==='solid'?'Solid':'Stripe'} ${b.n} potted!`);break}
   if(!b.on)continue
   railBounce(b)
  }
  for(let i=0;i<this.balls.length;i++)for(let j=i+1;j<this.balls.length;j++){
   const a=this.balls[i],b=this.balls[j]
   if(!a.on||!b.on)continue
   if(ballCollide(a,b)&&!this.firstHit){if(a.k==='cue')this.firstHit=b;else if(b.k==='cue')this.firstHit=a}
  }}
 foul(){const cue=this.balls[0];cue.on=true;clearMotion(cue);cue.x=154;cue.y=190;this.setSpin(0,0);this.ballInHand=true;this.placed=false;this.turn=other(this.turn);this.calledPocket=null;this.flash('Foul · ball in hand')}
 finish(winner){this.over=true;this.result=winner;this.finished=true;this.onFinish({winner,round:this.round});this.flash(winner===this.me?'You win!':'You lose')}
 resolve(){const shooter=this.turn,group=this.group(),black=this.potted.some(b=>b.k==='eight'),open=!group,wrongFirst=this.firstHit&&(open?this.firstHit.k==='eight':this.firstHit.k!==(this.before===0?'eight':group));if(black){const legal=this.breakShot?!this.scratch:group&&this.before===0&&!this.scratch&&this.calledPocket===this.eightPocket;this.finish(legal?shooter:other(shooter));this.phase='aim';this.sync();return}if(this.scratch||wrongFirst)this.foul();else{let assigned=false;if(open){const made=this.potted.filter(b=>b.k==='solid'||b.k==='stripe'),groups=[...new Set(made.map(b=>b.k))];if((!this.breakShot&&made[0])||(this.breakShot&&groups.length===1)){const g=this.breakShot?groups[0]:made[0].k;this.groups[shooter]=g;this.groups[other(shooter)]=g==='solid'?'stripe':'solid';assigned=true;this.flash(`${g==='solid'?'Solids':'Stripes'} are yours`)}}const madeOwn=group?this.potted.some(b=>b.k===group):assigned;if(!madeOwn){this.turn=other(shooter);this.calledPocket=null}}this.breakShot=false;this.balls.forEach(clearMotion);this.phase='aim';this.sync();if(this.practice&&!this.over&&this.turn==='b')setTimeout(()=>this.aiShot(),650)}
 // Is the straight line from `from` to (tx,ty) free of other balls?
 pathClear(from,tx,ty,skip){
  const dx=tx-from.x,dy=ty-from.y,len=Math.hypot(dx,dy)
  if(!len)return false
  const ux=dx/len,uy=dy/len
  for(const b of this.balls){
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
 // same allowance, and the correction is solved in one pass because the throw
 // angle barely moves once the cut is roughly known.
 aimFor(cue,t,dx,dy){
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
 // Ghost-ball planner: for every legal ball and every pocket, work out where
 // the cue ball has to be at contact, reject blocked or near-90-degree cuts,
 // and take the best remaining shot.
 bestShot(){
  const cue=this.balls[0],g=this.group('b')
  const legal=this.balls.filter(b=>b.on&&b.k!=='cue'&&(g?(this.remaining(g)?b.k===g:b.k==='eight'):b.k!=='eight'))
  let best=null
  for(const t of legal)for(let pi=0;pi<POCKETS.length;pi++){
   const[px,py]=POCKETS[pi]
   const ax=px-t.x,ay=py-t.y,ad=Math.hypot(ax,ay)
   if(!ad)continue
   const aim=this.aimFor(cue,t,ax/ad,ay/ad)
   if(!aim)continue
   if(aim.cut<=.15)continue
   if(!this.pathClear(cue,aim.gx,aim.gy,[t])||!this.pathClear(t,px,py,[cue]))continue
   const score=aim.cut*1.7-aim.cd/900-ad/700
   if(!best||score>best.score)best={score,cut:aim.cut,angle:aim.angle,pocket:pi,target:t,power:Math.min(92,32+aim.cd/16+ad/20)}
  }
  return best
 }
 // Ball in hand was being ignored entirely: the AI shot from wherever the foul
 // left the cue and never cleared the flag, so the human inherited a ball in
 // hand they had not earned. Use it instead, on the spot that opens up the
 // best shot.
 placeCueBall(){
  const cue=this.balls[0]
  let best={score:-Infinity,x:cue.x,y:cue.y}
  for(let i=1;i<8;i++)for(let j=1;j<5;j++){
   const p={x:MINX+(MAXX-MINX)*i/8,y:MINY+(MAXY-MINY)*j/5}
   if(!this.validCueSpot(p))continue
   cue.x=p.x;cue.y=p.y
   const plan=this.bestShot()
   const score=plan?plan.score:-1
   if(score>best.score)best={score,x:p.x,y:p.y}
  }
  cue.x=best.x;cue.y=best.y
  this.ballInHand=false;this.placed=false
 }
 // When no pot is on, the old fallback shoved the cue at the nearest legal
 // ball's centre with no regard for what was in the way -- which is how it
 // ended up crashing into the eight. Prefer a ball it can actually reach.
 // Snookered: no legal ball has a clear straight path. Rather than approximate
 // a bank off the mirror line -- which this cushion model would not obey, since
 // it sheds normal speed and keeps tangential -- roll the cue ball forward
 // through the real physics and keep the first angle that makes a legal hit.
 // Only the cue moves before first contact, so each trial is cheap.
 simulateFirstHit(angle,power){
  const cue={...this.balls[0]},others=this.balls.filter((b,i)=>i>0&&b.on)
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
 escapeShot(want){
  const start=Math.random()*Math.PI*2
  for(const power of [52,74]){
   for(let i=0;i<40;i++){
    const angle=start+i*Math.PI*2/40
    const hit=this.simulateFirstHit(angle,power)
    if(hit&&(want?hit.k===want:hit.k!=='eight'))return{angle,power}
   }
  }
  return null
 }
 safetyTarget(){
  const cue=this.balls[0],g=this.group('b')
  const legal=this.balls.filter(b=>b.on&&b.k!=='cue'&&(g?b.k===(this.remaining(g)?g:'eight'):b.k!=='eight'))
  return legal.map(t=>{
   const d=Math.hypot(t.x-cue.x,t.y-cue.y)||1
   const cx=t.x-(t.x-cue.x)/d*2*R,cy=t.y-(t.y-cue.y)/d*2*R
   return{t,d,clear:this.pathClear(cue,cx,cy,[t])?1:0}
  }).sort((a,b)=>b.clear-a.clear||a.d-b.d)[0]
 }
 aiShot(){
  if(this.phase!=='aim'||this.over)return
  if(this.ballInHand)this.placeCueBall()
  const cue=this.balls[0],shot=this.bestShot()
  let angle,power
  if(shot){
   angle=shot.angle+(Math.random()-.5)*.03/Math.max(.45,shot.cut)
   power=shot.power
   if(shot.target.k==='eight')this.calledPocket=shot.pocket
  }else{
   // nothing on: roll safe at a legal ball it has a clear path to
   const pick=this.safetyTarget()
   if(!pick)return
   const t=pick.t
   if(t.k==='eight')this.calledPocket=this.nearestPocket(t)
   if(pick.clear){
    angle=Math.atan2(t.y-cue.y,t.x-cue.x)+(Math.random()-.5)*.05
    power=26+Math.random()*14
   }else{
    const g=this.group('b')
    const esc=this.escapeShot(g?(this.remaining(g)?g:'eight'):null)
    if(esc){angle=esc.angle;power=esc.power}
    else{angle=Math.atan2(t.y-cue.y,t.x-cue.x);power=30}
   }
  }
  this.startShot()
  strike(cue,Math.cos(angle)*shotSpeed(power),Math.sin(angle)*shotSpeed(power))
 }
 guide(){const c=this.balls[0],dx=Math.cos(this.angle),dy=Math.sin(this.angle),rail=rayToRail(c.x,c.y,dx,dy);let hit=null,t=rail;for(let i=1;i<this.balls.length;i++){const b=this.balls[i];if(!b.on)continue;const ox=b.x-c.x,oy=b.y-c.y,p=ox*dx+oy*dy,s=ox*ox+oy*oy-p*p;if(p>R&&s<=4*R*R){const z=p-Math.sqrt(4*R*R-s);if(z<t){t=z;hit=b}}}return{c,dx,dy,t,hit,banks:!hit?bankPath(c.x,c.y,dx,dy,2):[]}}
 draw(dt=.016){this.renderer.draw(this,dt);this.updateHud()}
 updateHud(){const mine=this.group(this.me),their=this.group(other(this.me)),label=x=>x?x==='solid'?'Solids':'Stripes':'Open table';const count=p=>{const g=this.group(p);return g?(this.remaining(g)||'ON 8'):''}
  const tag=(x,p)=>{const c=count(p);return label(x).toUpperCase()+(c?` · ${c}`:'')}
  if(this.groupStatus){const text=!mine&&!their?'TABLE OPEN':`YOU: ${tag(mine,this.me)} · THEM: ${tag(their,other(this.me))}`;if(this.groupStatus.textContent!==text){this.groupStatus.textContent=text;this.groupStatus.className=mine||''}}this.shoot.disabled=!this.canAim()||!this.aiming
  const live=this.canControl()&&!this.ballInHand
  if(this.moveCue)this.moveCue.hidden=!(live&&this.placed)
  if(this.changePocket)this.changePocket.hidden=!(live&&this.canCallEight()&&this.calledPocket!=null);this.status.textContent=!this.ready?'Waiting for another player…':this.over?(this.result===this.me?'You won the rack':'Opponent won the rack'):this.turn===this.me?(this.ballInHand?'Ball in hand · tap table to place cue':this.aimingAtEight()&&this.eightBlocked()?`The 8 is not yours yet · ${this.eightBlocked()} ${label(mine).toLowerCase()} still to pot`:this.canCallEight()&&this.calledPocket==null?'Mark an 8-ball pocket, then aim':`${label(mine)} · your shot`):this.practice?'AI is lining up…':`${label(their)} · opponent’s turn`}
 // The simulation is no longer paced by the animation frame. Browsers stop or
 // heavily throttle requestAnimationFrame in a hidden tab, and since the host
 // simulates for both players, a host who switched tabs froze the game for
 // their opponent as well. The physics now advances in fixed steps against the
 // wall clock, and a timer keeps it moving while hidden -- coarsely, because
 // timers are throttled too, but moving. Fixed steps also mean a shot plays out
 // identically however the frames happen to fall.
 advance(now){
  let dt=(now-(this.simAt??now))/1000
  this.simAt=now
  if(!(dt>0))return 0
  dt=Math.min(dt,CATCHUP)
  if(!(this.host&&this.phase==='roll')){this.acc=0;return 0}
  this.acc=(this.acc||0)+dt
  let stepped=0
  while(this.acc>=STEP&&this.phase==='roll'){
   const n=substeps(this.balls,STEP)
   for(let i=0;i<n;i++)this.sub(STEP/n)
   this.acc-=STEP;stepped+=STEP
   if(this.balls.every(b=>!b.on||atRest(b))){this.resolve();break}
  }
  if(stepped&&now-(this.sent||0)>40){this.sent=now;this.sync()}
  return stepped
 }
 loop(t){
  const now=performance.now()
  const frameDt=Math.min(.05,(now-(this.drawnAt??now))/1000)
  this.drawnAt=now
  const stepped=this.advance(now)
  // after a long catch-up the balls jump, and a jump reads as a collision
  if(stepped<.1)this.sfx?.update(this.balls)
  this.draw(frameDt)
  this.raf=requestAnimationFrame(x=>this.loop(x))
 }
 flash(s){this.callout.textContent=s;this.callout.classList.add('show');clearTimeout(this.ft);this.ft=setTimeout(()=>this.callout.classList.remove('show'),1000)}
 destroy(){cancelAnimationFrame(this.raf);clearInterval(this.background);clearTimeout(this.ft);this.power.removeEventListener('input',this.handlers.power);this.surface.removeEventListener('pointerdown',this.handlers.down);this.surface.removeEventListener('pointermove',this.handlers.move);this.surface.removeEventListener('pointerup',this.handlers.up);this.shoot.removeEventListener('click',this.handlers.shoot)
  this.moveCue?.removeEventListener('click',this.handlers.moveCue)
  this.changePocket?.removeEventListener('click',this.handlers.changePocket)
  if(this.spinPad){this.spinPad.removeEventListener('pointerdown',this.handlers.spinDown);this.spinPad.removeEventListener('pointermove',this.handlers.spinMove);this.spinPad.removeEventListener('pointerup',this.handlers.spinUp);this.spinPad.removeEventListener('dblclick',this.handlers.spinReset)}}
}
