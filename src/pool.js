import {R,PR,MINX,MAXX,MINY,MAXY,POCKETS} from './table.js'
import {integrate,railBounce,ballCollide,substeps,atRest,clearMotion,strike,shotSpeed} from './physics.js'
import {other,remaining as countLeft,nearestPocket,validCueSpot,judgeShot,opposite,normalizeGroup} from './rules.js'
import {chooseShot} from './ai.js'
import {freshRackState,snapshotOf,applySnapshot} from './game-state.js'
import {isGameMessage} from './protocol.js'
export {shotSpeed}
export const aimStep=(aim,previous,current)=>aim+Math.atan2(Math.sin(current-previous),Math.cos(current-previous))*.5
export function rayToRail(x,y,dx,dy){const tx=dx>0?(MAXX-x)/dx:dx<0?(MINX-x)/dx:Infinity,ty=dy>0?(MAXY-y)/dy:dy<0?(MINY-y)/dy:Infinity;return Math.max(0,Math.min(tx>=0?tx:Infinity,ty>=0?ty:Infinity))}
export function bankPath(x,y,dx,dy,bounces=2){const points=[];for(let i=0;i<bounces;i++){const d=rayToRail(x,y,dx,dy),p={x:x+dx*d,y:y+dy*d};points.push(p);if(Math.abs(p.x-MINX)<.1||Math.abs(p.x-MAXX)<.1)dx=-dx;if(Math.abs(p.y-MINY)<.1||Math.abs(p.y-MAXY)<.1)dy=-dy;x=p.x+dx*.05;y=p.y+dy*.05}return points}
const STEP=1/120       // fixed simulation step, so frame pacing cannot change a shot
const CATCHUP=3        // never make up more than this much time in one go
export class PoolGame{
 constructor(o){Object.assign(this,o);this.surface=o.surface||o.renderer.el;this.me=this.host?'a':'b';this.round=1;this.ready=this.practice;this.power.value=45;this.bind();this.resetRack();this.simAt=this.drawnAt=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t));if(this.host)this.background=setInterval(()=>{if(typeof document!=='undefined'&&document.hidden)this.advance(performance.now())},250);if(this.practice)this.sync()}
 resetRack(){Object.assign(this,freshRackState());this.setSpin(0,0)}
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
 nearestPocket(p){return nearestPocket(p)}
 validCueSpot(p){return validCueSpot(this.balls,p)}
 setReady(v){this.ready=v;this.draw()}
 newRack(){if(!this.over)return;this.round++;this.resetRack();this.ready=true;this.sync()}
 requestRack(){if(!this.over)return;if(this.host)this.newRack();else this.send({t:'next-rack'})}
 group(player=this.turn){return normalizeGroup(this.groups[player])}
 remaining(group){return countLeft(this.balls,group)}
 // The eight is only legal once your own group is gone. Nothing used to say so:
 // a tap meant to call a pocket was simply swallowed.
 eightBlocked(){const g=this.group(this.me);return g?this.remaining(g):null}
 aimingAtEight(){return this.aiming&&this.canAim()&&this.guide().hit?.k==='eight'}
 canCallEight(){return this.group()&&this.remaining(this.group())===0&&this.phase==='aim'&&!this.over}
 canControl(){return this.ready&&this.phase==='aim'&&this.turn===this.me&&!this.over&&this.balls[0]?.on}
 canAim(){return this.canControl()&&!this.ballInHand}
 takeShot(){if(!this.canAim()||!this.aiming)return;if(this.guide().hit?.k==='eight'&&!this.canCallEight()){this.calledPocket=null;this.aiming=false;this.flash(`The 8 is not yours yet · ${this.eightBlocked()} ${this.group(this.me)} still to pot`);return}const s=shotSpeed(+this.power.value),vx=Math.cos(this.angle)*s,vy=Math.sin(this.angle)*s,spin=[this.spin.a,this.spin.b];this.aiming=false;this.sfx?.cue(+this.power.value/100);this.startShot();if(this.host)strike(this.balls[0],vx,vy,spin[0],spin[1]);else this.send({t:'shot',vx,vy,spin,place:this.pendingPlace,called:this.canCallEight()?this.calledPocket:null});this.pendingPlace=null}
 startShot(){this.placed=false;this.potted=[];this.firstObjectPotted=null;this.scratch=false;this.firstHit=null;this.before=this.group()?this.remaining(this.group()):null;this.phase='roll'}
 receive(m){
  if(!isGameMessage(m))return
  if(m.t==='table'&&!this.host)return this.onTable?.(m)
  if(m.t==='next-rack'&&this.host)return this.newRack()
  if(m.t==='state'&&!this.host)return this.receiveState(m)
  if(m.t==='shot'&&this.host&&this.turn==='b'&&this.phase==='aim')this.receiveShot(m)
 }
 receiveState(m){
  const freshRound=m.round>this.round
  applySnapshot(this,m)
  if(freshRound){this.ready=true;this.finished=false;this.onRack?.()}
  if(this.ballInHand)this.placed=false
  if(!this.canCallEight())this.calledPocket=null
  if(m.result&&!this.finished){this.finished=true;this.onFinish({winner:m.result,round:m.round})}
 }
 receiveShot(m){
  if(m.place&&this.validCueSpot({x:m.place[0],y:m.place[1]})){this.balls[0].x=m.place[0];this.balls[0].y=m.place[1];this.ballInHand=false}
  this.calledPocket=this.canCallEight()?(m.called??null):null
  this.startShot();strike(this.balls[0],m.vx,m.vy,m.spin?.[0]||0,m.spin?.[1]||0)
 }
 sync(){if(this.host)this.send(snapshotOf(this))}
 sub(dt){
  for(const b of this.balls){
   if(!b.on)continue
   integrate(b,dt)
   for(const[p,q]of POCKETS.entries())if(Math.hypot(b.x-q[0],b.y-q[1])<PR){b.on=false;if(b.k==='cue')this.scratch=true;else{this.potted.push(b);if(!this.firstObjectPotted&&(b.k==='solid'||b.k==='stripe'))this.firstObjectPotted=b}if(b.k==='eight')this.eightPocket=p;this.flash(b.k==='cue'?'Scratch!':b.k==='eight'?'8-ball potted!':`${b.k==='solid'?'Solid':'Stripe'} ${b.n} potted!`);break}
   if(!b.on)continue
   railBounce(b)
  }
  for(let i=0;i<this.balls.length;i++)for(let j=i+1;j<this.balls.length;j++){
   const a=this.balls[i],b=this.balls[j]
   if(!a.on||!b.on)continue
   if(ballCollide(a,b)&&!this.firstHit){if(a.k==='cue')this.firstHit=b;else if(b.k==='cue')this.firstHit=a}
  }}
 foul(reason){const cue=this.balls[0],hit=this.firstHit?.k;cue.on=true;clearMotion(cue);cue.x=154;cue.y=190;this.setSpin(0,0);this.ballInHand=true;this.placed=false;this.turn=other(this.turn);this.calledPocket=null;this.flash(reason==='scratch'?'Scratch · ball in hand':reason==='wrong-first'?`Foul · hit ${hit==='solid'?'a solid':hit==='stripe'?'a stripe':'the 8-ball'} first · ball in hand`:reason==='no-contact'?'Foul · no object ball contacted · ball in hand':'Foul · ball in hand')}
 finish(winner){this.over=true;this.result=winner;this.finished=true;this.onFinish({winner,round:this.round});this.flash(winner===this.me?'You win!':'You lose')}
 resolve(){
  const shooter=this.turn
  const v=judgeShot(this)
  if(v.winner){this.finish(v.winner);this.phase='aim';this.sync();return}
  if(v.assign){
   this.groups[shooter]=v.assign;this.groups[other(shooter)]=opposite(v.assign)
   this.assignment={player:shooter,ball:this.firstObjectPotted?.n||null,group:v.assign}
   const claimed=v.assign==='solid'?'Solids':'Stripes',mine=this.groups[this.me]==='solid'?'Solids':'Stripes'
   const actor=shooter===this.me?'You':this.practice?'AI Coach':'Opponent'
   this.flash(`${actor} claimed ${claimed} · You: ${mine}`)
  }
  if(v.foul)this.foul(v.reason)
  else if(v.nextTurn!==shooter){this.turn=v.nextTurn;this.calledPocket=null}
  this.breakShot=false;this.balls.forEach(clearMotion);this.phase='aim';this.sync()
  if(this.practice&&!this.over&&this.turn==='b')setTimeout(()=>this.aiShot(),650)
 }
 aiShot(){
  if(this.phase!=='aim'||this.over)return
 const plan=chooseShot(this.balls,this.group('b'),this.ballInHand)
 if(!plan)return
 if(plan.place){this.ballInHand=false;this.placed=false}
  // The planner may receive old room state; never show an 8-ball call unless
  // the live game state confirms the AI has cleared its own group.
  if(plan.pocket!=null&&this.remaining(this.group('b'))===0)this.calledPocket=plan.pocket
  this.startShot()
  const s=shotSpeed(plan.power)
  strike(this.balls[0],Math.cos(plan.angle)*s,Math.sin(plan.angle)*s)
 }
 guide(){const c=this.balls[0],dx=Math.cos(this.angle),dy=Math.sin(this.angle),rail=rayToRail(c.x,c.y,dx,dy);let hit=null,t=rail;for(let i=1;i<this.balls.length;i++){const b=this.balls[i];if(!b.on)continue;const ox=b.x-c.x,oy=b.y-c.y,p=ox*dx+oy*dy,s=ox*ox+oy*oy-p*p;if(p>R&&s<=4*R*R){const z=p-Math.sqrt(4*R*R-s);if(z<t){t=z;hit=b}}}return{c,dx,dy,t,hit,banks:!hit?bankPath(c.x,c.y,dx,dy,2):[]}}
 draw(dt=.016){this.renderer.draw(this,dt);this.updateHud()}
 clearInvalidCall(){if(this.calledPocket!=null&&this.phase==='aim'&&!this.canCallEight())this.calledPocket=null}
 updateHud(){// A called pocket remains part of a shot after aiming ends; only
  // discard it while setting up an illegal call, never while balls are rolling.
  this.clearInvalidCall();const mine=this.group(this.me),their=this.group(other(this.me)),label=x=>x?x==='solid'?'Solids':'Stripes':'Open table';const count=p=>{const g=this.group(p);return g?(this.remaining(g)||'ON 8'):''}
  const tag=(x,p)=>{const c=count(p);return label(x).toUpperCase()+(c?` · ${c}`:'')}
  if(this.groupStatus){const totals=`ON TABLE: SOLIDS ${this.remaining('solid')} · STRIPES ${this.remaining('stripe')}`;const band=x=>x==='solid'?'1–7':x==='stripe'?'9–15':'';const shown=(x,p)=>`${tag(x,p)}${x?` (${band(x)})`:''}`;const set=this.assignment?` · SET BY ${this.assignment.player===this.me?'YOU':'THEM'}: #${this.assignment.ball} ${this.assignment.group.toUpperCase()}`:'';const text=!mine&&!their?`OPEN TABLE · ${totals}`:`YOU: ${shown(mine,this.me)} · THEM: ${shown(their,other(this.me))}${set} · ${totals}`;if(this.groupStatus.textContent!==text){this.groupStatus.textContent=text;this.groupStatus.className=mine||''}}this.shoot.disabled=!this.canAim()||!this.aiming
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
