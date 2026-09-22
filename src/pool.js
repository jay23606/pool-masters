import {R,PR,MINX,MAXX,MINY,MAXY,POCKETS} from './table.js'
import {integrate,railBounce,ballCollide,substeps,atRest,clearMotion,strike} from './physics.js'
export const shotSpeed=v=>120+Math.pow(Math.max(1,Math.min(100,v))/100,1.45)*3080
export const aimStep=(aim,previous,current)=>aim+Math.atan2(Math.sin(current-previous),Math.cos(current-previous))*.5
export function rayToRail(x,y,dx,dy){const tx=dx>0?(MAXX-x)/dx:dx<0?(MINX-x)/dx:Infinity,ty=dy>0?(MAXY-y)/dy:dy<0?(MINY-y)/dy:Infinity;return Math.max(0,Math.min(tx>=0?tx:Infinity,ty>=0?ty:Infinity))}
export function bankPath(x,y,dx,dy,bounces=2){const points=[];for(let i=0;i<bounces;i++){const d=rayToRail(x,y,dx,dy),p={x:x+dx*d,y:y+dy*d};points.push(p);if(Math.abs(p.x-MINX)<.1||Math.abs(p.x-MAXX)<.1)dx=-dx;if(Math.abs(p.y-MINY)<.1||Math.abs(p.y-MAXY)<.1)dy=-dy;x=p.x+dx*.05;y=p.y+dy*.05}return points}
// Measured from the collision model: throw rises with the cut angle and then
// saturates once ball-on-ball friction is fully mobilised, at about 3.4 degrees.
const THROW_MAX=.06,THROW_K=.155
const kind=n=>n===8?'eight':n<8?'solid':'stripe',other=t=>t==='a'?'b':'a',shuffle=a=>a.sort(()=>Math.random()-.5)
function rack(){const nums=shuffle([...Array(7)].map((_,i)=>i+1).concat([...Array(7)].map((_,i)=>i+9))),a=[{x:154,y:190,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:'cue',n:0}];nums.splice(4,0,8);let q=0;for(let row=0;row<5;row++)for(let i=0;i<=row;i++){const n=nums[q++];a.push({x:420+row*15.66,y:190+(i-row/2)*18,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:kind(n),n})}return a}
export class PoolGame{
 constructor(o){Object.assign(this,o);this.surface=o.surface||o.renderer.el;this.me=this.host?'a':'b';this.round=1;this.ready=this.practice;this.power.value=45;this.bind();this.resetRack();this.last=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t));if(this.practice)this.sync()}
 resetRack(){this.balls=rack();this.turn='a';this.phase='aim';this.over=false;this.result='';this.finished=false;this.aiming=false;this.groups={a:null,b:null};this.breakShot=true;this.calledPocket=null;this.ballInHand=false;this.setSpin(0,0)}
 bind(){this.handlers={power:()=>this.powerOut.textContent=this.power.value+'%',down:e=>{if(!this.canControl())return;const p=this.point(e);if(!p)return;const cue=this.balls[0];if(this.ballInHand){if(!this.validCueSpot(p))return;cue.x=p.x;cue.y=p.y;this.ballInHand=false;this.pendingPlace=[p.x,p.y];this.flash('Ball in hand placed')}if(this.canCallEight()&&!this.calledPocket){this.calledPocket=this.nearestPocket(p);this.flash('8-ball pocket marked');return}const pa=Math.atan2(p.y-cue.y,p.x-cue.x);if(!this.aiming)this.angle=pa;this.aiming=true;this.drag=true;this.pointerAngle=pa;this.surface.setPointerCapture?.(e.pointerId)},move:e=>{if(!this.drag)return;const p=this.point(e);if(!p)return;const cue=this.balls[0];if(Math.hypot(p.x-cue.x,p.y-cue.y)<5)return;const a=Math.atan2(p.y-cue.y,p.x-cue.x);this.angle=aimStep(this.angle,this.pointerAngle,a);this.pointerAngle=a},up:e=>{this.handlers.move(e);this.drag=false;this.surface.releasePointerCapture?.(e.pointerId)},shoot:()=>this.takeShot()};this.power.addEventListener('input',this.handlers.power);this.surface.addEventListener('pointerdown',this.handlers.down);this.surface.addEventListener('pointermove',this.handlers.move);this.surface.addEventListener('pointerup',this.handlers.up);this.shoot.addEventListener('click',this.handlers.shoot)
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
 canCallEight(){return this.group()&&this.remaining(this.group())===0&&this.phase==='aim'&&!this.over}
 canControl(){return this.ready&&this.phase==='aim'&&this.turn===this.me&&!this.over&&this.balls[0]?.on}
 canAim(){return this.canControl()&&!this.ballInHand}
 takeShot(){if(!this.canAim()||!this.aiming)return;const s=shotSpeed(+this.power.value),vx=Math.cos(this.angle)*s,vy=Math.sin(this.angle)*s,spin=[this.spin.a,this.spin.b];this.aiming=false;this.startShot();if(this.host)strike(this.balls[0],vx,vy,spin[0],spin[1]);else this.send({t:'shot',vx,vy,spin,place:this.pendingPlace,called:this.calledPocket});this.pendingPlace=null}
 startShot(){this.potted=[];this.scratch=false;this.firstHit=null;this.before=this.group()?this.remaining(this.group()):null;this.phase='roll'}
 receive(m){if(m.t==='state'&&!this.host){this.balls=m.b.map(x=>({x:x[0],y:x[1],on:x[2],k:x[3],n:x[4],vx:0,vy:0,wx:0,wy:0,wz:0}));this.turn=m.turn;this.phase=m.phase;this.over=m.over;this.round=m.round;this.groups=m.groups||this.groups;this.breakShot=!!m.breakShot;this.ballInHand=!!m.ballInHand;this.calledPocket=m.calledPocket;if(m.result&&!this.finished){this.finished=true;this.onFinish({winner:m.result,round:m.round})}}else if(m.t==='shot'&&this.host&&this.turn==='b'&&this.phase==='aim'){if(m.place&&this.validCueSpot({x:m.place[0],y:m.place[1]})){this.balls[0].x=m.place[0];this.balls[0].y=m.place[1];this.ballInHand=false}this.calledPocket=m.called??null;this.startShot();strike(this.balls[0],m.vx,m.vy,m.spin?.[0]||0,m.spin?.[1]||0)}}
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
 foul(){const cue=this.balls[0];cue.on=true;clearMotion(cue);cue.x=154;cue.y=190;this.setSpin(0,0);this.ballInHand=true;this.turn=other(this.turn);this.calledPocket=null;this.flash('Foul · ball in hand')}
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
 aiShot(){
  if(this.phase!=='aim'||this.over)return
  const cue=this.balls[0],shot=this.bestShot()
  let angle,power
  if(shot){
   angle=shot.angle+(Math.random()-.5)*.03/Math.max(.45,shot.cut)
   power=shot.power
   if(shot.target.k==='eight')this.calledPocket=shot.pocket
  }else{
   // nothing on: roll safe at the nearest legal ball so it is still a fair hit
   const g=this.group('b')
   const targets=this.balls.filter(b=>b.on&&b.k!=='cue'&&(g?b.k===(this.remaining(g)?g:'eight'):b.k!=='eight'))
   const t=targets.sort((a,b)=>Math.hypot(a.x-cue.x,a.y-cue.y)-Math.hypot(b.x-cue.x,b.y-cue.y))[0]
   if(!t)return
   if(t.k==='eight')this.calledPocket=this.nearestPocket(t)
   angle=Math.atan2(t.y-cue.y,t.x-cue.x)+(Math.random()-.5)*.1
   power=28+Math.random()*18
  }
  this.startShot()
  strike(cue,Math.cos(angle)*shotSpeed(power),Math.sin(angle)*shotSpeed(power))
 }
 guide(){const c=this.balls[0],dx=Math.cos(this.angle),dy=Math.sin(this.angle),rail=rayToRail(c.x,c.y,dx,dy);let hit=null,t=rail;for(let i=1;i<this.balls.length;i++){const b=this.balls[i];if(!b.on)continue;const ox=b.x-c.x,oy=b.y-c.y,p=ox*dx+oy*dy,s=ox*ox+oy*oy-p*p;if(p>R&&s<=4*R*R){const z=p-Math.sqrt(4*R*R-s);if(z<t){t=z;hit=b}}}return{c,dx,dy,t,hit,banks:!hit?bankPath(c.x,c.y,dx,dy,2):[]}}
 draw(dt=.016){this.renderer.draw(this,dt);this.updateHud()}
 updateHud(){const mine=this.group(this.me),their=this.group(other(this.me)),label=x=>x?x==='solid'?'Solids':'Stripes':'Open table';if(this.groupStatus){const text=`YOU: ${label(mine).toUpperCase()} · OPPONENT: ${label(their).toUpperCase()}`;if(this.groupStatus.textContent!==text){this.groupStatus.textContent=text;this.groupStatus.className=mine||''}}this.shoot.disabled=!this.canAim()||!this.aiming;this.status.textContent=!this.ready?'Waiting for another player…':this.over?(this.result===this.me?'You won the rack':'Opponent won the rack'):this.turn===this.me?(this.ballInHand?'Ball in hand · tap table to place cue':this.canCallEight()&&!this.calledPocket?'Mark an 8-ball pocket, then aim':`${label(mine)} · your shot`):this.practice?'AI is lining up…':`${label(their)} · opponent’s turn`}
 loop(t){const dt=Math.min(.033,(t-this.last)/1000||0);this.last=t
  if(this.host&&this.phase==='roll'){
   const n=substeps(this.balls,dt)
   for(let i=0;i<n;i++)this.sub(dt/n)
   if(t-(this.sent||0)>40){this.sent=t;this.sync()}
   if(this.balls.every(b=>!b.on||atRest(b)))this.resolve()
  }
  this.draw(dt);this.raf=requestAnimationFrame(x=>this.loop(x))}
 flash(s){this.callout.textContent=s;this.callout.classList.add('show');clearTimeout(this.ft);this.ft=setTimeout(()=>this.callout.classList.remove('show'),1000)}
 destroy(){cancelAnimationFrame(this.raf);clearTimeout(this.ft);this.power.removeEventListener('input',this.handlers.power);this.surface.removeEventListener('pointerdown',this.handlers.down);this.surface.removeEventListener('pointermove',this.handlers.move);this.surface.removeEventListener('pointerup',this.handlers.up);this.shoot.removeEventListener('click',this.handlers.shoot)
  if(this.spinPad){this.spinPad.removeEventListener('pointerdown',this.handlers.spinDown);this.spinPad.removeEventListener('pointermove',this.handlers.spinMove);this.spinPad.removeEventListener('pointerup',this.handlers.spinUp);this.spinPad.removeEventListener('dblclick',this.handlers.spinReset)}}
}
