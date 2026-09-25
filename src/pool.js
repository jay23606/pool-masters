import {R,PR,MINX,MAXX,MINY,MAXY,POCKETS,tableSize} from './table.js'
import {integrate,railBounce,ballCollide,substeps,atRest,clearMotion,strike,shotSpeed} from './physics.js'
import {normalizeHouse,nextBreaker,placementLimit} from './house.js'
import {airborne} from './physics.js'
import {newRun as newRogueRun,judge as judgeRogue,choose as chooseRogue,advance as advanceRogue,offer as offerRogue,POCKET_BOOST} from './rogue.js'
import {other,remaining as countLeft,nearestPocket,validCueSpot,judgeShot,opposite,normalizeGroup,modeOf,lowestBall,nineRespot,MODES,isScoreMode,ONE_POCKET,targetFor,isRotation,MONEY,trianglePositions,kind} from './rules.js'
import {chooseShot} from './ai.js'
import {freshRackState,snapshotOf,applySnapshot} from './game-state.js'
import {isGameMessage} from './protocol.js'
import {bindGameInput} from './game-input.js'
import {createPredictor,STEP,CATCHUP} from './predict.js'
import {createRecorder,ballsAt,duration} from './replay.js'
import {buildBalls,evaluate,resultOf,REASONS} from './drills.js'
import {begin as beginChallenge,startClock,judge as judgeChallenge,timedOut,timeUp,scatter,byId as challengeById,timeLeft,clearTime,HEAD_SPOT} from './challenges.js'
export {shotSpeed}
export const aimStep=(aim,previous,current,sensitivity=.3)=>aim+Math.atan2(Math.sin(current-previous),Math.cos(current-previous))*sensitivity
export const openingAim=balls=>Math.atan2(balls[1].y-balls[0].y,balls[1].x-balls[0].x)
export function rayToRail(x,y,dx,dy){const tx=dx>0?(MAXX-x)/dx:dx<0?(MINX-x)/dx:Infinity,ty=dy>0?(MAXY-y)/dy:dy<0?(MINY-y)/dy:Infinity;return Math.max(0,Math.min(tx>=0?tx:Infinity,ty>=0?ty:Infinity))}
export function bankPath(x,y,dx,dy,bounces=2){const points=[];for(let i=0;i<bounces;i++){const d=rayToRail(x,y,dx,dy),p={x:x+dx*d,y:y+dy*d};points.push(p);if(Math.abs(p.x-MINX)<.1||Math.abs(p.x-MAXX)<.1)dx=-dx;if(Math.abs(p.y-MINY)<.1||Math.abs(p.y-MAXY)<.1)dy=-dy;x=p.x+dx*.05;y=p.y+dy*.05}return points}
export class PoolGame{
 constructor(o){Object.assign(this,o);this.mode=modeOf(o.mode);this.house=normalizeHouse(o.house);this.breaker='a';this.scoreTarget=this.mode==='straight'?this.house.straightTo:(this.scoreTarget||targetFor(this.mode));this.spectator=Boolean(o.spectator);this.aimSensitivity=o.aimSensitivity??.3;this.aimStep=(a,p,c)=>aimStep(a,p,c,this.aimSensitivity);this.surface=o.surface||o.renderer.el;this.me=this.host?'a':'b';this.round=1;this.ready=this.practice;this.power.value=45;this.bind();this.resetRack();this.simAt=this.drawnAt=performance.now();this.raf=requestAnimationFrame(t=>this.loop(t));this.predictor=createPredictor();this.predicted=null;if(this.host)this.background=setInterval(()=>{if(typeof document!=='undefined'&&document.hidden)this.advance(performance.now())},250);if(this.practice)this.sync()}
 // ---- Rogue Pool (see rogue.js) ----
 // the cue ball on the head spot, and the balls of this table of the run
 rogueRack(keep){
  const cue=keep||{id:0,x:154,y:190,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:'cue',n:0}
  return [cue,...this.run.layout.map(b=>({id:b.n,x:b.x,y:b.y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:kind(b.n),n:b.n}))]
 }
 // Pockets grow with the Wide pockets upgrade.
 pocketScale(){return this.run&&this.rogueSeed!=null?1+POCKET_BOOST*(this.run.upgrades.pockets||0):1}
 resolveRogue(){
  const left=this.balls.filter(b=>b.on&&b.k!=='cue').length,cue=this.balls[0]
  const v=judgeRogue(this.run,{potted:this.potted.length,scratch:this.scratch,left,jumped:Boolean(this.usedJump)})
  this.usedJump=false;this.run=v.run
  if(v.respotCue){cue.on=true;cue.x=154;cue.y=190;this.flash('Scratch · cue ball back on the spot')}
  this.balls.forEach(clearMotion)
  this.phase='aim'
  if(v.event==='cleared'){
   // the table is clear: the player picks an upgrade before the next one, unless there is nothing left to offer
   const choices=offerRogue(this.run)
   if(!choices.length){this.run=advanceRogue(this.run);this.balls=this.rogueRack(this.balls[0]);this.aiming=true;this.flash(`Table ${this.run.level} · nothing left to upgrade`);this.sync();return}
   this.rogueWait=true;this.aiming=false;this.sync()
   this.onRogue?.({type:'cleared',run:this.run,offer:choices})
   return
  }
  if(v.event==='life'){this.balls=this.rogueRack();this.flash('Out of shots · a life lost · the table again')}
  if(v.event==='over'){
   this.over=true;this.result='a';this.finished=true;this.aiming=false;this.sync()
   this.onRogue?.({type:'over',run:this.run});return
  }
  this.sync()
 }
 // The player has chosen: take the upgrade and set out the next table.
 pickUpgrade(id){
  if(!this.rogueWait)return false
  this.run=chooseRogue(this.run,id);this.rogueWait=false
  this.balls=this.rogueRack(this.balls[0]);this.aiming=true;this.phase='aim';this.sync()
  this.flash(`Table ${this.run.level}`)
  return true
 }
 updateRogueHud(){
  const r=this.run
  const text=`ROGUE POOL · TABLE ${r.level} · ${r.shotsLeft} ${r.shotsLeft===1?'SHOT':'SHOTS'} · ${'♥'.repeat(Math.max(0,r.lives))}${r.jumps?` · ${r.jumps} JUMP${r.jumps===1?'':'S'}`:''}`
  if(this.groupStatus&&this.groupStatus.textContent!==text){this.groupStatus.textContent=text;this.groupStatus.className=''}
  this.shoot.disabled=!this.canAim()||!this.aiming
  if(this.moveCue)this.moveCue.hidden=true
  if(this.changePocket)this.changePocket.hidden=true
  this.status.textContent=this.over?'Run over':this.rogueWait?'Choose an upgrade':this.phase==='roll'?'':'Your shot'
 }
 // ---- challenge games (see challenges.js) ----
 // the cue ball on the head spot and a fresh scatter of balls
 challengeRack(keep){
  const cue={id:0,x:HEAD_SPOT.x,y:HEAD_SPOT.y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:'cue',n:0}
  const balls=scatter(challengeById(this.challenge).balls,[keep||cue]).map(b=>({id:b.n,x:b.x,y:b.y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:kind(b.n),n:b.n}))
  return [keep||cue,...balls]
 }
 // After a shot: score it, put the cue ball back after a scratch, refill a cleared table, and end the game when it is over.
 resolveChallenge(){
  const now=performance.now()
  const left=this.balls.filter(b=>b.on&&b.k!=='cue').length
  const v=judgeChallenge(this.chal,{potted:this.potted.map(b=>b.n),scratch:this.scratch,left},now)
  this.chal=v.state
  const cue=this.balls[0]
  if(v.respotCue){cue.on=true;cue.x=HEAD_SPOT.x;cue.y=HEAD_SPOT.y;clearMotion(cue);this.flash('Scratch · cue ball back on the spot')}
  else if(this.chal.id==='perfect'&&!v.over)this.flash(`Streak ${this.chal.score}`)
  this.balls.forEach(clearMotion)
  if(v.refill){this.balls=this.challengeRack(cue);this.flash('Table cleared · fresh balls')}
  this.phase='aim';this.sync()
  if(v.over)this.endChallenge()
 }
 // The game is over: keep the score, and tell the app.
 endChallenge(){
  if(this.over)return
  this.chal=this.chal.over?this.chal:timeUp(this.chal)
  this.over=true;this.result='a';this.finished=true;this.aiming=false
  this.onFinish({winner:'a',round:this.round,challenge:this.chal})
 }
 // Called every frame: a timed game that runs out of time between shots ends there.
 tickChallenge(){
  if(!this.chal||this.chal.over||this.over)return
  if(this.phase==='aim'&&timedOut(this.chal,performance.now()))this.endChallenge()
 }
 resetRack(){Object.assign(this,freshRackState(this.mode));this.lastCoach=null;if(this.drill){this.balls=buildBalls(this.drill);this.breakShot=false;this.attempts=0;this.drillOutcome=null;this.hinted=false;clearTimeout(this.retryTimer)};if(this.rogueSeed!=null){this.run=newRogueRun(this.rogueSeed);this.chal={id:'rogue',over:false};this.rogueWait=false;this.breakShot=false;this.balls=this.rogueRack()};if(this.challenge){this.chal=beginChallenge(this.challenge);this.breakShot=false;this.balls=this.challengeRack()};this.rec=null;this.lastReplay=null;this.replay=null;this.onReplay?.(null);this.shots={a:0,b:0};this.angle=openingAim(this.balls);this.pointerAngle=this.angle;this.aiming=this.me==='a';this.setSpin(0,0)}
 bind(){this.unbindInput=bindGameInput(this)} point(e){return this.renderer.point(e)}
 setRenderer(r){this.renderer=r}
 // Tip contact point, in ball radii. Sideways is English, vertical is
 // draw/follow; both are clamped inside the miscue limit by strike().
 setSpin(a,b){this.spin={a,b};if(this.spinDot)this.spinDot.style.transform=`translate(${a*32}px,${-b*32}px)`}
 spinFrom(e){const r=this.spinPad.getBoundingClientRect();let dx=(e.clientX-r.left)/r.width*2-1,dy=(e.clientY-r.top)/r.height*2-1;const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m}this.setSpin(dx*.5,-dy*.5)}
 nearestPocket(p){return nearestPocket(p)}
 validCueSpot(p){return validCueSpot(this.balls,p,this.ballInHand?placementLimit(this.house):null)}
 setReady(v){this.ready=v;this.draw()}
 newRack(){
  if(!this.over)return
  const last={breaker:this.breaker||'a',winner:this.result}
  this.round++
  if(this.rogueSeed!=null)this.rogueSeed=(this.rogueSeed*48271+11)%1000003     // a new run is a new run
  this.resetRack()
  this.breaker=nextBreaker(this.house,last);this.turn=this.breaker
  this.ready=true;this.sync()
  if(this.practice&&!this.hotSeat&&this.turn==='b')setTimeout(()=>this.aiShot(),650)
 }
 requestRack(){if(!this.over||this.spectator)return;if(this.host)this.newRack();else this.send({t:'next-rack'})}
 group(player=this.turn){return normalizeGroup(this.groups[player])}
 remaining(group){return countLeft(this.balls,group)}
 // The eight is only legal once your own group is gone. Nothing used to say so:
 // a tap meant to call a pocket was simply swallowed.
 // Why the 8 cannot be played yet, in words that fit the table: an open table has no group to count.
 eightBlockedMessage(){
  const g=this.group(this.me),n=this.eightBlocked()
  return g&&n?`The 8 is not yours yet · ${n} ${g==='solid'?'solids':'stripes'} still to pot`:'The 8 has to wait · pot a solid or a stripe first'
 }
 eightBlocked(){const g=this.group(this.me);return g?this.remaining(g):null}
 aimingAtEight(){return this.eightGame()&&this.aiming&&this.canAim()&&this.guide().hit?.k==='eight'}
 // The 8 only means something in eight-ball (and a game object with no mode is one).
 eightGame(){return !isRotation(this.mode)&&!isScoreMode(this.mode)}
 // The pocket the aim has snapped to, while the player is aiming (null otherwise).
 snapMark(){return this.aiming&&this.snapPocket!=null&&this.canAim()?this.snapPocket:null}
 // The pocket to ring on the table: the one called for the 8, or in one-pocket the shooter's own.
 markedPocket(){return this.mode==='onepocket'?ONE_POCKET[this.turn]:this.calledPocket}
 // The Jump button shows only where the house allows jumps, and says whether the next shot will be one.
 paintJump(){
  const b=this.jumpBtn;if(!b)return
  b.hidden=!this.jumpAllowed()
  b.classList.toggle('on',Boolean(this.jumpOn));b.setAttribute('aria-pressed',String(Boolean(this.jumpOn)))
 }
 // Jump shots are a house rule, off unless the table was set up for them; drills and challenges never allow one.
 jumpAllowed(){
  if(this.rogueSeed!=null&&this.run)return this.run.jumps>0     // a run has its own jumps, bought as upgrades
  return Boolean(this.house&&this.house.jumps)&&!this.drill&&!this.chal
 }
 canCallEight(){return this.group()&&this.remaining(this.group())===0&&this.phase==='aim'&&!this.over}
 setSpectator(v){this.spectator=Boolean(v);this.draw()}
 canControl(){return !this.rogueWait&&!this.spectator&&!this.replay&&this.ready&&this.phase==='aim'&&this.turn===this.me&&!this.over&&this.balls[0]?.on}
 canAim(){return this.canControl()&&!this.ballInHand}
 takeShot(){if(!this.canAim()||!this.aiming)return;if(!this.drill&&this.eightGame()&&this.guide().hit?.k==='eight'&&!this.canCallEight()){this.calledPocket=null;this.aiming=false;this.flash(this.eightBlockedMessage());return}const s=shotSpeed(+this.power.value),vx=Math.cos(this.angle)*s,vy=Math.sin(this.angle)*s,spin=[this.spin.a,this.spin.b];if(!this.drill&&!this.chal&&!(this.jumpAllowed()&&this.jumpOn))this.lastCoach={before:this.balls.map(b=>({...b})),shot:{angle:this.angle,power:+this.power.value,spin},group:this.group(this.me),mode:this.mode,player:this.me,breakShot:this.breakShot,result:null,replays:null};this.aiming=false;this.sfx?.cue(+this.power.value/100);
  // The pocket called for the 8 is read now, while the player is still aiming: startShot() begins the roll,
  // and calling is only allowed while aiming. Read after it, a guest always sent no call at all, and the host
  // judged every 8 a guest potted as a loss.
  const called=this.canCallEight()?this.calledPocket:null
  const jump=this.jumpAllowed()&&Boolean(this.jumpOn)
  this.jumpOn=false;this.usedJump=jump
  this.startShot();if(this.host)strike(this.balls[0],vx,vy,spin[0],spin[1],jump);else this.send({t:'shot',vx,vy,spin,place:this.pendingPlace,called,...(jump?{jump:true}:{})});this.pendingPlace=null}
 startShot(){if(this.chal&&this.chal.startedAt==null)this.chal=startClock(this.chal,performance.now());this.shots??={a:0,b:0};this.shots[this.turn]=(this.shots[this.turn]||0)+1;this.placed=false;this.potted=[];this.firstObjectPotted=null;this.scratch=false;this.firstHit=null;this.before=this.group()?this.remaining(this.group()):null;this.lowest=lowestBall(this.balls);this.railHit=false;this.pocketOf={};this.railBalls=new Set();this.cueRailFirst=false;this.phase='roll';this.noteRecording(true)}
 receive(m){
  if(!isGameMessage(m))return
  if(m.t==='table'&&!this.host)return this.onTable?.(m)
  if(m.t==='next-rack'&&this.host)return this.newRack()
  if(m.t==='state'&&!this.host)return this.receiveState(m)
  if(m.t==='shot'&&this.host&&this.turn==='b'&&this.phase==='aim')this.receiveShot(m)
 }
 receiveState(m){
  // the last state seen between shots is the baseline for the next one: the first
  // snapshot of a shot arrives ~40ms in, by which time a ball hit hard toward a
  // nearby pocket may already have dropped
  if(this.phase==='aim'&&this.balls&&this.gotState)this.beforeState={on:this.balls.map(b=>b.on),turn:this.turn,breakShot:this.breakShot}
  const freshRound=m.round>this.round
  // what the player has chosen and not yet played: the pocket they called, and where they put the cue ball
  const myCall=this.calledPocket,myPlace=this.pendingPlace,mine=!this.host&&this.turn===this.me
  const prior=this.phase==='aim'&&this.gotState&&!freshRound&&!this.rec?this.beforeState:null
  applySnapshot(this,m)
  this.gotState=true
  // A shot can be over before the host's first snapshot of it goes out (a cue ball
  // hit into a pocket beside it): this side then never sees a roll, only a table
  // that changed hands, and would report nothing. Turn or balls changing with no
  // roll in between is that shot.
  if(prior&&m.phase==='aim'&&prior.on.length===this.balls.length&&(prior.turn!==this.turn||prior.on.some((was,i)=>was!==this.balls[i].on))){
   this.shotStart={...prior,mode:this.mode};this.noteShot()
  }
  // The result is not part of applySnapshot, so a guest never had one: the status
  // line reads it, and told a guest who had won that the opponent had.
  this.result=m.result||''
  // A snapshot never carries velocity, only position -- so every one of
  // these is the anchor a locally predicted trajectory is rebuilt from,
  // bounding how far the cosmetic copy can ever drift from the truth to
  // one inter-snapshot gap (about 40ms), continuously re-corrected.
  this.predicted=this.balls.map(b=>({...b}));this.predictor?.reset(performance.now())
  this.noteRecording()
  if(freshRound){this.ready=true;this.finished=false;this.onRack?.()}
  if(freshRound)this.stopReplay()          // the last rack's replay has no business holding up the next one
  if(this.ballInHand)this.placed=false
  if(!this.canCallEight())this.calledPocket=null
  else if(mine&&this.turn===this.me&&this.calledPocket==null&&myCall!=null)this.calledPocket=myCall
  if(mine&&!freshRound&&this.turn===this.me&&this.ballInHand&&myPlace){this.balls[0].x=myPlace[0];this.balls[0].y=myPlace[1];this.ballInHand=false;this.placed=true}
  if(m.result&&!this.finished){this.finished=true;this.onFinish({winner:m.result,round:m.round})}
 }
 restore(m){
  if(!isGameMessage(m)||m.t!=='state')return false
  applySnapshot(this,m);this.finished=Boolean(m.result);this.setSpin(0,0);return true
 }
 receiveShot(m){
  if(m.place&&this.validCueSpot({x:m.place[0],y:m.place[1]})){this.balls[0].x=m.place[0];this.balls[0].y=m.place[1];this.ballInHand=false}
  this.calledPocket=this.canCallEight()?(m.called??null):null
  this.startShot();strike(this.balls[0],m.vx,m.vy,m.spin?.[0]||0,m.spin?.[1]||0,Boolean(m.jump)&&this.jumpAllowed())
 }
 // Hot-seat: two people share one device. Whoever's turn it is is "me" -- every rule and every
 // control already speaks of the shooter that way -- and the names are theirs, not You/AI.
 hotTurn(){
  if(!this.hotSeat)return
  this.me=this.turn
  if(this.lastTurn!==this.turn){const first=this.lastTurn==null;this.lastTurn=this.turn;if(!first&&!this.over)this.onTurn?.(this.nameOf(this.turn))}
 }
 nameOf(p){return this.names?.[p]||(p==='a'?'Player 1':'Player 2')}
 tag(p,fallback){return this.hotSeat?this.nameOf(p).toUpperCase():fallback}
 // The status lines are written for one player against an opponent; two players sharing
 // a device need them in the third person.
 hotStatus(text){
  if(this.over)return `${this.nameOf(this.result)} won the rack`
  return text.replace(/your shot/i,`${this.nameOf(this.turn)}’s shot`)
 }
 sync(){this.hotTurn();if(this.host){const state=snapshotOf(this);this.send(state);this.onSave?.(state);this.noteRecording()}}
 // Every shot is recorded as it plays, by whoever is watching: the host from its
 // own simulation, a guest or spectator from the snapshots it is sent. Both are
 // the same 25Hz stream, so a shot looks the same whoever shares it.
 //
 // The host records on its simulation clock, not the wall clock, so a shot is
 // just as smooth when its tab was hidden and it could only step in coarse
 // chunks; its frames are taken inside advance(). A guest has only the snapshots.
 noteRecording(force){
  const now=this.host?(this.simClock||0):performance.now()
  if(this.phase==='roll'){
   // the last finished shot stays available while the next one plays, and is
   // replaced only when that one finishes
   if(!this.rec){
    this.stopReplay();this.rec=createRecorder(this.mode,tableSize)
    // what the table looked like when the shot began, so that what it did can be
    // worked out from how it ended: the same on both sides of the wire
    const before=!this.host&&this.beforeState&&this.beforeState.on.length===this.balls.length?this.beforeState:null
    this.shotStart={on:before?before.on:this.balls.map(b=>b.on),turn:before?before.turn:this.turn,
     breakShot:before?before.breakShot:this.breakShot,mode:this.mode}
   }
   if(!this.host||force)this.rec.frame(now,this.balls)
  }else if(this.rec){
   this.rec.frame(now,this.balls)
   const r=this.rec.finish();this.rec=null
   if(r){this.lastReplay=r;this.onReplay?.(r)}
   this.noteShot()
  }
 }
 // A finished shot, described from its before and after. The host has resolve(),
 // but a guest never does -- it only sees snapshots -- so this is derived from
 // the two states rather than reported, and both sides get the same answer. A
 // foul always gives the opponent ball in hand, and always passes the turn.
 noteShot(){
  const s=this.shotStart;this.shotStart=null
  if(!s||this.drill||this.chal||s.on.length!==this.balls.length)return
  const potted=[]
  s.on.forEach((was,i)=>{const b=this.balls[i];if(was&&!b.on&&b.n!==0)potted.push(b.n)})
  this.onShot?.({by:s.turn,potted,foul:Boolean(this.ballInHand&&this.turn!==s.turn),
   brk:s.breakShot,mode:s.mode,winner:this.over?this.result||null:null})
 }
 // Playback swaps recorded balls in for the render only; the game underneath
 // carries on untouched, and a new shot cancels the replay.
 // Refused while a shot is live: a replay over a real shot would be confusing.
 startReplay(rec,speed=1){
  if(this.phase==='roll'&&!this.replayOnly)return false
  this.replay={rec,speed,at:performance.now()}
  this.sfx?.prime?.(ballsAt(rec,0))
  return true
 }
 stopReplay(){
  if(!this.replay)return
  this.replay=null
  this.sfx?.prime?.(this.balls)
 }
 replayBalls(now){
  const p=this.replay
  if(!p)return null
  const ms=(now-p.at)*p.speed,end=duration(p.rec)
  if(ms>end+700){
   // a shared shot holds its last frame; a replay inside a game returns to the game
   if(this.replayOnly){p.finished=true;return ballsAt(p.rec,end)}
   this.stopReplay();return null
  }
  return ballsAt(p.rec,ms)
 }
 sub(dt){
  for(const b of this.balls){
   if(!b.on)continue
   integrate(b,dt)
   for(const[p,q]of POCKETS.entries())if(!airborne(b)&&Math.hypot(b.x-q[0],b.y-q[1])<PR*this.pocketScale()){b.on=false;if(b.k==='cue')this.scratch=true;else{this.potted.push(b);(this.pocketOf??={})[b.n]=p;if(!this.firstObjectPotted&&(b.k==='solid'||b.k==='stripe'))this.firstObjectPotted=b}if(b.k==='eight')this.eightPocket=p;this.flash(this.pottedMessage(b));break}
   if(!b.on)continue
   if(railBounce(b)){
    // which balls touched a cushion, and whether the cue did so before it
    // touched anything -- what a bank shot or a kick shot is judged on
    ;(this.railBalls??=new Set()).add(b.n)
    if(this.firstHit)this.railHit=true
    else if(b.k==='cue')this.cueRailFirst=true
   }
  }
  for(let i=0;i<this.balls.length;i++)for(let j=i+1;j<this.balls.length;j++){
   const a=this.balls[i],b=this.balls[j]
   if(!a.on||!b.on)continue
   if(ballCollide(a,b)&&!this.firstHit){if(a.k==='cue')this.firstHit=b;else if(b.k==='cue')this.firstHit=a}
  }}
 pottedMessage(b){
  if(b.k==='cue')return 'Scratch!'
  if(isRotation(this.mode))return b.n===MONEY[this.mode]?`${b.n}-ball potted!`:`Ball ${b.n} potted!`
  if(isScoreMode(this.mode))return `Ball ${b.n} potted`
  return b.k==='eight'?'8-ball potted!':`${b.k==='solid'?'Solid':'Stripe'} ${b.n} potted!`
 }
 // A 9 pocketed on a foul goes back on the table rather than ending the rack.
 respotNine(money=9){
  const nine=this.balls.find(b=>b.n===money)
  if(!nine)return
  const p=nineRespot(this.balls,money)
  nine.on=true;nine.x=p.x;nine.y=p.y;clearMotion(nine)
 }
 // The cue ball after a foul. By default it goes in hand, to be placed anywhere; a house rule can keep it
 // behind the head string, or leave it where it stopped (and on the head spot if it was potted).
 foul(reason){
  const cue=this.balls[0],hit=this.firstHit?.k,bih=normalizeHouse(this.house).ballInHand
  const wasOn=cue.on
  clearMotion(cue);this.setSpin(0,0);this.placed=false;this.turn=other(this.turn);this.calledPocket=null
  if(bih==='none'){
   if(!wasOn){cue.on=true;cue.x=154;cue.y=190;for(let x=154;x>=MINX&&this.balls.some(b=>b!==cue&&b.on&&Math.hypot(b.x-x,b.y-190)<2*R);x-=R)cue.x=x-R}
   this.ballInHand=false
  }else{cue.on=true;cue.x=154;cue.y=190;this.ballInHand=true}
  const say=m=>bih==='kitchen'?m.replace('ball in hand','ball in hand behind the head string'):bih==='none'?m.replace(' · ball in hand','').replace('ball in hand','next shot'):m
  this.flash(say(this.foulMessage(reason,hit)))
 }
 foulMessage(reason,hit){return reason==='scratch'?'Scratch · ball in hand':reason==='wrong-first'?(isRotation(this.mode)?`Foul · hit the ${this.firstHit.n} first, the ${this.lowest} was lowest · ball in hand`:`Foul · hit ${hit==='solid'?'a solid':hit==='stripe'?'a stripe':'the 8-ball'} first · ball in hand`):reason==='no-contact'?'Foul · no object ball contacted · ball in hand':reason==='no-rail'?'Foul · no ball reached a cushion · ball in hand':'Foul · ball in hand'}
 finish(winner){this.over=true;this.result=winner;this.finished=true;this.onFinish({winner,round:this.round});this.flash(this.hotSeat?`${this.nameOf(winner)} wins!`:winner===this.me?'You win!':'You lose')}
 // A drill is judged by its own rule, not by the rules of the game: nobody's turn
 // changes, nothing is won, and a failed attempt puts the table back.
 resolveDrill(){
  const d=this.drill,cue=this.balls[0]
  const v=evaluate(d,resultOf({scratch:this.scratch,firstHit:this.firstHit,cueRailFirst:this.cueRailFirst,
   potted:this.potted.map(b=>b.n),pockets:this.pocketOf||{},railBalls:[...(this.railBalls||[])],
   cue:{x:cue.x,y:cue.y,on:cue.on}}))
  this.balls.forEach(clearMotion);this.phase='aim'
  this.attempts=(this.attempts||0)+1;this.drillOutcome=v
  this.sync()                       // ends the recording, so the attempt can be replayed
  this.onDrill?.({...v,attempts:this.attempts,drill:d,hinted:this.hinted})
  // a miss puts the table back by itself; a success leaves it to be looked at
  if(!v.ok)this.retryTimer=setTimeout(()=>this.retryDrill(),1500)
 }
 retryDrill(){
  clearTimeout(this.retryTimer)
  if(!this.drill)return
  this.balls=buildBalls(this.drill);this.phase='aim';this.drillOutcome=null;this.hinted=false
  this.angle=openingAim(this.balls);this.pointerAngle=this.angle;this.aiming=true;this.setSpin(0,0)
  this.stopReplay()
  this.onDrill?.(null)
 }
 // Set the aim, power and spin to a shot known to solve the drill.
 applyHint(){
  const h=this.drill?.hint
  if(!h||!this.canControl())return false
  this.angle=h.angle;this.pointerAngle=h.angle;this.aiming=true
  this.power.value=h.power;if(this.powerOut)this.powerOut.textContent=h.power+'%'
  this.setSpin(h.spin[0],h.spin[1])
  this.hinted=true          // this attempt was aimed by the game
  return true
 }
 resolve(){
  if(this.drill)return this.resolveDrill()
  if(this.rogueSeed!=null)return this.resolveRogue()
  if(this.chal)return this.resolveChallenge()
  const shooter=this.turn
  const v=judgeShot(this)
  if(v.respotNine)this.respotNine(v.respotBall||9)
  if(v.score){this.score=v.score;this.scoreMessage(v,shooter);if(v.rerack)this.reRack()}
  if(v.winner){this.onShotResult?.({shooter,potted:this.potted.map(b=>b.n),foul:false,winner:v.winner});this.finish(v.winner);this.phase='aim';this.sync();return}
  if(v.assign){
   this.groups[shooter]=v.assign;this.groups[other(shooter)]=opposite(v.assign)
   this.assignment={player:shooter,ball:this.firstObjectPotted?.n||null,group:v.assign}
   const claimed=v.assign==='solid'?'Solids':'Stripes',mine=this.groups[this.me]==='solid'?'Solids':'Stripes'
   const actor=shooter===this.me?'You':this.practice?'AI Coach':'Opponent'
   this.flash(this.hotSeat?`${this.nameOf(shooter)} claimed ${claimed}`:`${actor} claimed ${claimed} · You: ${mine}`)
  }
  this.onShotResult?.({shooter,potted:this.potted.map(b=>b.n),foul:Boolean(v.foul),reason:v.reason||null,winner:null})
  if(v.foul)this.foul(v.reason)
  else if(v.nextTurn!==shooter){this.turn=v.nextTurn;this.calledPocket=null}
  this.breakShot=false;this.balls.forEach(clearMotion);this.phase='aim';this.sync()
  if(this.practice&&!this.hotSeat&&!this.over&&this.turn==='b')setTimeout(()=>this.aiShot(),650)
 }
 aiShot(){
  if(this.phase!=='aim'||this.over)return
 const plan=chooseShot(this.balls,this.group('b'),this.ballInHand,this.aiLevel,this.mode,{player:'b',limitX:placementLimit(this.house)})
 if(!plan)return
 if(plan.place){this.ballInHand=false;this.placed=false}
  // The planner may receive old room state; never show an 8-ball call unless
  // the live game state confirms the AI has cleared its own group.
  if(this.eightGame()&&plan.pocket!=null&&this.remaining(this.group('b'))===0)this.calledPocket=plan.pocket
  this.startShot()
  const s=shotSpeed(plan.power)
  strike(this.balls[0],Math.cos(plan.angle)*s,Math.sin(plan.angle)*s)
 }
 guide(){const c=this.balls[0],dx=Math.cos(this.angle),dy=Math.sin(this.angle),rail=rayToRail(c.x,c.y,dx,dy);let hit=null,t=rail;for(let i=1;i<this.balls.length;i++){const b=this.balls[i];if(!b.on)continue;const ox=b.x-c.x,oy=b.y-c.y,p=ox*dx+oy*dy,s=ox*ox+oy*oy-p*p;if(p>R&&s<=4*R*R){const z=p-Math.sqrt(4*R*R-s);if(z<t){t=z;hit=b}}}return{c,dx,dy,t,hit,banks:!hit?bankPath(c.x,c.y,dx,dy,2):[]}}
 draw(dt=.016,replayed){
  if(replayed===undefined)replayed=this.replayBalls(performance.now())
  // While rolling, a non-host renders the locally predicted trajectory
  // rather than the authoritative array, which only moves in ~40ms jumps --
  // this.balls is swapped in only for the render call itself, since guide()
  // and canAim() (which also read this.balls) are never invoked mid-roll.
  const authoritative=this.balls
  if(replayed)this.balls=replayed
  else if(!this.host&&this.predicted&&this.phase==="roll")this.balls=this.predicted
  try{this.renderer.draw(this,dt)}
  finally{this.balls=authoritative}          // whatever the renderer did, the real balls go back
  this.updateHud()
  const playing=this.replay&&!this.replay.finished
  if(this.replayOnly&&this.groupStatus)this.groupStatus.textContent=`${MODES[this.mode].label} · SHARED SHOT`
  if(playing){this.status.textContent=this.replayOnly?'Replaying the shot…':'Replaying the last shot…';if(!this.replayOnly&&this.groupStatus)this.groupStatus.textContent='REPLAY'}
  else if(this.replayOnly)this.status.textContent='Shared shot · watch it again, or play a game'
 }
 clearInvalidCall(){if(this.calledPocket!=null&&this.phase==='aim'&&!this.canCallEight())this.calledPocket=null}
 // Nine-ball has no groups, counts or called pockets, so its HUD is its own.
 updateNineHud(){
  const low=lowestBall(this.balls)
  if(this.groupStatus){const name=MODES[this.mode].label.toUpperCase(),text=low===null?name:`${name} · LOWEST ON TABLE: ${low}`;if(this.groupStatus.textContent!==text){this.groupStatus.textContent=text;this.groupStatus.className=''}}
  this.shoot.disabled=!this.canAim()||!this.aiming
  const live=this.canControl()&&!this.ballInHand
  if(this.moveCue)this.moveCue.hidden=!(live&&this.placed)
  if(this.changePocket)this.changePocket.hidden=true
  this.status.textContent=this.spectator?'Spectating live · controls are with the players':!this.ready?'Waiting for another player…':this.over?(this.result===this.me?'You won the rack':'Opponent won the rack'):this.turn===this.me?(this.ballInHand?'Ball in hand · tap table to place cue':`Your shot · hit the ${low} first`):this.practice?'AI is lining up…':'Opponent’s turn'
  if(this.hotSeat)this.status.textContent=this.hotStatus(this.status.textContent)
 }
 // Straight pool is continuous: with one ball left, the other fourteen are racked again as a triangle
 // with its apex open. A ball that was left in the way of the rack goes on the apex instead.
 reRack(){
  const cue=this.balls[0],objects=this.balls.filter(b=>b.k!=='cue'),left=objects.find(b=>b.on)||null
  const slots=trianglePositions(5)
  let apexTaken=false
  if(left&&left.x>=400&&Math.abs(left.y-190)<80){left.x=slots[0][0];left.y=slots[0][1];clearMotion(left);apexTaken=true}
  const free=slots.slice(1).concat(apexTaken||left?[]:[slots[0]])
  const rest=objects.filter(b=>b!==left).sort(()=>Math.random()-.5)
  rest.forEach((b,i)=>{const p=free[i]||slots[0];b.on=true;b.x=p[0];b.y=p[1];clearMotion(b)})
  // the cue ball must not end up inside the rack
  if(this.balls.some(b=>b!==cue&&b.on&&Math.hypot(b.x-cue.x,b.y-cue.y)<2*R+1)){cue.x=154;cue.y=190;clearMotion(cue)}
  this.flash('Re-rack · fourteen balls back on the table')
 }
 // What happened to the score on a shot, in a sentence.
 scoreMessage(v,shooter){
  const who=p=>this.hotSeat?this.nameOf(p):p===this.me?'You':this.practice?'The AI':'Opponent'
  if(v.foul)return
  if(v.credited.length){
   const mine=v.credited.filter(c=>c.to===shooter).length,theirs=v.credited.length-mine
   this.flash(theirs&&!mine?`${who(shooter)} sank it in ${who(other(shooter))}’s pocket`:mine?`${who(shooter)} scored${mine>1?` ${mine}`:''} · ${v.score[shooter]} of ${(this.scoreTarget||targetFor(this.mode))}`:'')
  }else if(v.wasted.length)this.flash(this.mode==='bank'?`No bank · ball ${v.wasted[0]} does not count`:`Wrong pocket · ball ${v.wasted[0]} does not count`)
 }
 // Bank pool and one-pocket: a score, and what counts, instead of groups.
 updateScoreHud(){
  const a=this.score?.a||0,b=this.score?.b||0
  const nm=p=>this.hotSeat?this.nameOf(p).toUpperCase():p===this.me?'YOU':this.practice?'AI':'THEM'
  const me=this.hotSeat?this.turn:this.me,opp=other(me)
  const label=this.mode==='bank'?'BANK POOL':this.mode==='straight'?'STRAIGHT POOL':'ONE-POCKET'
  if(this.groupStatus){const text=`${label} · ${nm(me)} ${me==='a'?a:b} – ${opp==='a'?a:b} ${nm(opp)} · FIRST TO ${(this.scoreTarget||targetFor(this.mode))}`;if(this.groupStatus.textContent!==text){this.groupStatus.textContent=text;this.groupStatus.className=''}}
  this.shoot.disabled=!this.canAim()||!this.aiming
  const live=this.canControl()&&!this.ballInHand
  if(this.moveCue)this.moveCue.hidden=!(live&&this.placed)
  if(this.changePocket)this.changePocket.hidden=true
  const rule=this.mode==='bank'?'bank it off a cushion':this.mode==='straight'?'pot any ball, a foul costs a point':'sink it in the ringed pocket'
  this.status.textContent=this.spectator?'Spectating live · controls are with the players':!this.ready?'Waiting for another player…':this.over?(this.result===this.me?'You won the rack':'Opponent won the rack'):this.turn===this.me?(this.ballInHand?'Ball in hand · tap table to place cue':`Your shot · ${rule}`):this.practice?'AI is lining up…':'Opponent’s turn'
  if(this.hotSeat)this.status.textContent=this.hotStatus(this.status.textContent)
 }
 updateChallengeHud(){
  const c=this.chal,def=challengeById(c.id),now=performance.now()
  this.tickChallenge()
  const clock=def.seconds?(c.startedAt==null?`${def.seconds}s`:`${Math.ceil(timeLeft(c,now)/1000)}s left`):(c.startedAt==null?'0.0 s':`${((c.over?c.final:clearTime(c,now))/1000).toFixed(1)} s`)
  const score=c.id==='speed'?`${c.score} potted`:c.id==='perfect'?`streak ${c.score}`:`${this.balls.filter(b=>b.on&&b.k!=='cue').length} left`
  const text=`${def.name.toUpperCase()} · ${score} · ${clock}`
  if(this.groupStatus&&this.groupStatus.textContent!==text){this.groupStatus.textContent=text;this.groupStatus.className=''}
  this.shoot.disabled=!this.canAim()||!this.aiming
  if(this.moveCue)this.moveCue.hidden=true
  if(this.changePocket)this.changePocket.hidden=true
  this.status.textContent=this.over?(c.id==='clear'?'Cleared':'Finished'):this.phase==='roll'?'':c.startedAt==null?'Your shot · the clock starts when you shoot':'Your shot'
 }
 updateDrillHud(){
  if(this.groupStatus){const text=`DRILL · ${this.drillLabel||this.drill.name.toUpperCase()}`;if(this.groupStatus.textContent!==text){this.groupStatus.textContent=text;this.groupStatus.className=''}}
  this.shoot.disabled=!this.canAim()||!this.aiming
  if(this.moveCue)this.moveCue.hidden=true
  if(this.changePocket)this.changePocket.hidden=true
  const o=this.drillOutcome
  this.status.textContent=o?(o.ok?this.hinted?'Drill complete, with a hint':`Drill complete${this.attempts>1?` in ${this.attempts} attempts`:' first time'}`:REASONS[o.reason]):this.attempts?`Attempt ${this.attempts+1}`:'Your shot'
 }
 updateHud(){
  this.paintJump()
  if(this.drill)return this.updateDrillHud()
  if(this.rogueSeed!=null)return this.updateRogueHud()
  if(this.chal)return this.updateChallengeHud()
  if(isRotation(this.mode))return this.updateNineHud()
  if(isScoreMode(this.mode))return this.updateScoreHud()
  // A called pocket remains part of a shot after aiming ends; only
  // discard it while setting up an illegal call, never while balls are rolling.
  this.clearInvalidCall();const mine=this.group(this.me),their=this.group(other(this.me)),label=x=>x?x==='solid'?'Solids':'Stripes':'Open table'
  if(this.groupStatus){const left=p=>{const g=this.group(p);if(!g)return '';const n=this.remaining(g);return n?` · ${n} left`:' · the 8'};const text=!mine&&!their?`OPEN TABLE · ${this.remaining('solid')} SOLIDS · ${this.remaining('stripe')} STRIPES`:`${this.tag(this.me,'YOU')}: ${label(mine).toUpperCase()}${left(this.me)}  |  ${this.tag(other(this.me),'THEM')}: ${label(their).toUpperCase()}${left(other(this.me))}`;if(this.groupStatus.textContent!==text){this.groupStatus.textContent=text;this.groupStatus.className=mine||''}}this.shoot.disabled=!this.canAim()||!this.aiming
  const live=this.canControl()&&!this.ballInHand
  if(this.moveCue)this.moveCue.hidden=!(live&&this.placed)
  if(this.changePocket)this.changePocket.hidden=!(live&&this.canCallEight()&&this.calledPocket!=null);this.status.textContent=this.spectator?'Spectating live · controls are with the players':!this.ready?'Waiting for another player…':this.over?(this.result===this.me?'You won the rack':'Opponent won the rack'):this.turn===this.me?(this.ballInHand?'Ball in hand · tap table to place cue':this.aimingAtEight()&&this.eightBlocked()?this.eightBlockedMessage():this.canCallEight()&&this.calledPocket==null?'Mark an 8-ball pocket, then aim':`${label(mine)} · your shot`):this.practice?'AI is lining up…':`${label(their)} · opponent’s turn`
  if(this.hotSeat)this.status.textContent=this.hotStatus(this.status.textContent)}
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
   this.simClock=(this.simClock||0)+STEP*1000
   if(this.rec&&this.simClock-(this.recAt??-1e9)>=40){this.recAt=this.simClock;this.rec.frame(this.simClock,this.balls)}
   if(this.balls.every(b=>!b.on||atRest(b))){this.resolve();break}
  }
  if(stepped&&now-(this.sent||0)>40){this.sent=now;this.sync()}
  return stepped
 }
 loop(t){
  // The next frame is asked for first: a frame that throws (a renderer bug, an odd replay) then costs one
  // frame, not the whole game. A loop that stops leaves a table that never moves or updates again.
  this.raf=requestAnimationFrame(x=>this.loop(x))
  const now=performance.now()
  const frameDt=Math.min(.05,(now-(this.drawnAt??now))/1000)
  this.drawnAt=now
  const stepped=this.advance(now)
  if(!this.host&&this.predicted&&this.phase==="roll")this.predictor.advance(this.predicted,now)
  const replayed=this.replayBalls(now)
  // after a long catch-up the balls jump, and a jump reads as a collision
  if(stepped<.1)this.sfx?.update(replayed||this.balls)
  try{this.draw(frameDt,replayed)}
  catch(e){if(!this.loggedDrawError){this.loggedDrawError=true;console.error('a frame failed to draw',e)}}
 }
 flash(s){this.callout.textContent=s;this.callout.classList.add('show');clearTimeout(this.ft);this.ft=setTimeout(()=>this.callout.classList.remove('show'),1000)}
 destroy(){clearTimeout(this.retryTimer);cancelAnimationFrame(this.raf);clearInterval(this.background);clearTimeout(this.ft);this.unbindInput?.()}
}
