import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike,shotSpeed} from '../src/physics.js'
import {chooseShot} from '../src/ai.js'
import {rack,MODES,isScoreMode,targetFor,judgeScoreGame,BONUS_POCKET,BONUS_POINTS} from '../src/rules.js'
import {TWISTS,drawTwist,blast,wellPull,bonusPocket,twistName,BLAST_RADIUS,WELL_RADIUS} from '../src/chaos.js'
import {snapshotOf,applySnapshot} from '../src/game-state.js'
import {isGameMessage} from '../src/protocol.js'
import {R,PR,POCKETS} from '../src/table.js'

const seeded=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const ball=(n,x,y,on=true)=>({n,x,y,on,k:n===0?'cue':n<8?'solid':'stripe',vx:0,vy:0,wx:0,wy:0,wz:0})

test('chaos pool is a scored game to fifteen, and the bonus pocket is worth three',()=>{
 assert.equal(MODES.chaos.balls,16);assert.equal(isScoreMode('chaos'),true);assert.equal(targetFor('chaos'),15)
 assert.equal(BONUS_POCKET,6);assert.equal(BONUS_POINTS,3)
 const table=[ball(0,0,0),...[...Array(15)].map((_,i)=>ball(i+1,0,0,i<6))]
 const shot=o=>({mode:'chaos',turn:'a',score:{a:0,b:0},potted:[],pockets:{},railBalls:[],scratch:false,firstHit:{n:3},balls:table,...o})
 const plain=judgeScoreGame(shot({potted:[{n:3}],pockets:{3:1}}))
 assert.deepEqual(plain.score,{a:1,b:0});assert.equal(plain.nextTurn,'a')
 const bonus=judgeScoreGame(shot({potted:[{n:3}],pockets:{3:BONUS_POCKET}}))
 assert.deepEqual(bonus.score,{a:3,b:0});assert.equal(bonus.credited[0].points,3)
 // the bonus pocket only means something in chaos pool
 assert.deepEqual(judgeScoreGame(shot({mode:'straight',potted:[{n:3}],pockets:{3:BONUS_POCKET}})).score,{a:1,b:0})
 // a foul costs a point, fifteen wins, and the table is racked again when one ball is left
 assert.deepEqual(judgeScoreGame(shot({scratch:true,score:{a:5,b:0}})).score,{a:4,b:0})
 assert.equal(judgeScoreGame(shot({score:{a:13,b:0},potted:[{n:3}],pockets:{3:BONUS_POCKET}})).winner,'a','a bonus can take you over the line')
 assert.equal(judgeScoreGame(shot({balls:[ball(0,0,0),ball(5,0,0)],potted:[{n:3}],pockets:{3:1}})).rerack,true)
})

test('twists are always one of the three, well formed, and placed where they can be used',()=>{
 const balls=rack('chaos');const seen=new Set()
 for(let seed=1;seed<=200;seed++){
  const fx=drawTwist(balls,seeded(seed));seen.add(fx.type);assert.ok(TWISTS.includes(fx.type))
  if(fx.type==='bonus'){
   assert.ok(fx.y===28||fx.y===352,'on a long rail');assert.ok(fx.x>=140&&fx.x<=560)
   for(const q of POCKETS)assert.ok(Math.hypot(q[0]-fx.x,q[1]-fx.y)>PR*2,'clear of the real pockets')
   assert.ok(bonusPocket(fx).r>0)
  }
  if(fx.type==='bomb'){assert.ok(balls.some(b=>b.n===fx.n&&b.k!=='cue'));assert.equal(fx.spent,false)}
  if(fx.type==='well'){assert.ok(fx.x>=140&&fx.x<=560&&fx.y>=100&&fx.y<=280);assert.equal(fx.r,WELL_RADIUS)}
 }
 assert.deepEqual([...seen].sort(),[...TWISTS].sort(),'all three come up')
 assert.equal(bonusPocket({type:'bomb'}),null);assert.equal(bonusPocket(null),null)
})

test('a bomb needs a ball to be: with nothing on the table the twist is a well instead',()=>{
 const empty=rack('chaos').map(b=>({...b,on:b.k==='cue'}))
 for(let seed=1;seed<=60;seed++)assert.notEqual(drawTwist(empty,seeded(seed)).type==='bomb',true)
})

test('a blast throws balls away from the bomb, harder the closer they are, and leaves the far ones and the bomb alone',()=>{
 const bomb=ball(9,300,190),near=ball(1,300+R*3,190),mid=ball(2,300,190-R*6),far=ball(3,300+BLAST_RADIUS+5,190),gone=ball(4,310,190,false)
 const moved=blast([bomb,near,mid,far,gone],bomb)
 assert.equal(moved,2)
 assert.ok(near.vx>0&&Math.abs(near.vy)<1e-9,'thrown away along the line from the bomb')
 assert.ok(mid.vy<0&&Math.abs(mid.vx)<1e-9)
 assert.ok(Math.hypot(near.vx,near.vy)>Math.hypot(mid.vx,mid.vy),'closer is harder')
 assert.deepEqual([bomb.vx,bomb.vy,far.vx,far.vy,gone.vx,gone.vy],[0,0,0,0,0,0])
 // a ball exactly on the bomb has no direction to go in, so it stays put rather than getting NaN
 const twin=ball(5,300,190);blast([bomb,twin],bomb);assert.ok(Number.isFinite(twin.vx)&&Number.isFinite(twin.vy))
})

test('a gravity well pulls a ball toward its centre, more the closer it is, and not at all outside',()=>{
 const fx={type:'well',x:300,y:190,r:WELL_RADIUS}
 const a=ball(1,300-40,190),b=ball(2,300-100,190),c=ball(3,300-WELL_RADIUS-5,190)
 assert.equal(wellPull(a,fx,.01),true);wellPull(b,fx,.01);assert.equal(wellPull(c,fx,.01),false)
 assert.ok(a.vx>b.vx&&b.vx>0);assert.equal(c.vx,0)
 assert.equal(wellPull(ball(4,300,190),fx,.01),false,'dead centre: nothing to pull toward')
})

test('the twist names read well in the HUD',()=>{
 assert.equal(twistName(null),'');assert.equal(twistName({type:'bonus'}),'BONUS POCKET')
 assert.equal(twistName({type:'bomb',spent:false}),'BOMB BALL');assert.equal(twistName({type:'bomb',spent:true}),'BOMB (spent)');assert.equal(twistName({type:'well'}),'GRAVITY WELL')
})

// ---- the game ----
function game(fx=null,extra={}){
 const g=Object.create(PoolGame.prototype),flashes=[]
 Object.assign(g,{mode:'chaos',turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:true,hotSeat:true,names:{a:'A',b:'B'},ready:true,me:'a',host:true,
  shots:{a:0,b:0},acc:0,flash:m=>flashes.push(m),setSpin(){},send(){},onSave(){},onFinish(){},onShot(){},onReplay(){},score:{a:0,b:0},breaker:'a',
  balls:rack('chaos'),power:{value:50},spin:{a:0,b:0},aiming:true,angle:0,house:{race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false},fx,...extra})
 g.sync();return {g,flashes}
}
function roll(g,seconds=4){g.phase='roll';let now=g.clock||0;g.simAt=now;for(let i=0;i<seconds*120&&g.phase==='roll';i++){now+=1000/120;g.advance(now)};g.clock=now}
const clear=g=>g.balls.forEach((b,i)=>{if(i)b.on=false})

test('a bonus pocket takes a ball that rolls into it, and scores it as three',()=>{
 const {g}=game({type:'bonus',x:200,y:28})
 clear(g);const cue=g.balls[0],one=g.balls[1];one.on=true;one.x=200;one.y=120;cue.x=200;cue.y=300
 g.balls[2].on=true;g.balls[2].x=600;g.balls[2].y=300;g.balls[3].on=true;g.balls[3].x=620;g.balls[3].y=330
 strike(cue,0,-1400);g.startShot();roll(g)
 assert.equal(one.on,false,'the ball dropped in the bonus pocket')
 assert.equal(g.score.a,3,'and it was worth three')
})

test('with no bonus pocket open, the same shot does not drop a ball at that spot',()=>{
 const {g}=game({type:'well',x:600,y:300,r:WELL_RADIUS})
 clear(g);const cue=g.balls[0],one=g.balls[1];one.on=true;one.x=200;one.y=120;cue.x=200;cue.y=300
 strike(cue,0,-1400);g.startShot();roll(g)
 assert.equal(one.on,true);assert.equal(g.score.a,0)
})

test('a bomb ball goes off once, when hit, and throws its neighbours',()=>{
 const {g,flashes}=game({type:'bomb',n:2,spent:false})
 clear(g);const [cue,bomb,neigh,far]=g.balls;bomb.on=neigh.on=far.on=true
 cue.x=200;cue.y=190;bomb.x=280;bomb.y=190;neigh.x=280;neigh.y=230;far.x=600;far.y=330;bomb.n=2
 g.balls[1].n=2;neigh.n=3;far.n=4
 strike(cue,900,0);g.startShot();roll(g,.5)
 assert.equal(g.fx.spent,true,'it went off');assert.ok(flashes.some(m=>/BOOM/.test(m)))
 assert.ok(neigh.y>232||Math.abs(neigh.vy)>1||neigh.y!==230,'the neighbour was thrown')
 const at=g.fx
 // and never twice
 g.explode();assert.equal(g.fx,at,'already spent: nothing happens')
})

test('a bomb hit by another ball, not the cue ball, goes off too',()=>{
 const {g}=game({type:'bomb',n:5,spent:false})
 clear(g);const [cue,a,b]=g.balls;a.on=b.on=true;a.n=3;b.n=5;a.x=300;a.y=190;b.x=300+2*R-1;b.y=190;cue.x=100;cue.y=100
 a.vx=400;g.startShot();roll(g,.3)
 assert.equal(g.fx.spent,true)
})

test('a gravity well bends a rolling ball toward it',()=>{
 const straight=game({type:'well',x:400,y:100,r:WELL_RADIUS}),plain=game(null)
 for(const {g} of [straight,plain]){clear(g);const cue=g.balls[0];cue.x=200;cue.y=190;strike(cue,500,0);g.startShot();roll(g,.5)}
 assert.ok(straight.g.balls[0].y<plain.g.balls[0].y-1,`pulled up toward the well: ${straight.g.balls[0].y} vs ${plain.g.balls[0].y}`)
})

test('every shot deals a new twist, and the first rack starts with one',()=>{
 const {g}=game(null);g.resetRack();assert.ok(g.fx&&TWISTS.includes(g.fx.type),'a twist at the start')
 g.balls[0].x=200;g.balls[0].y=190;const before=g.fx
 g.startShot();g.potted=[];g.scratch=false;g.phase='roll';g.resolve()
 assert.ok(g.fx&&g.fx!==before,'a fresh one after the shot')
 const plain=Object.create(PoolGame.prototype);plain.mode='8ball';plain.newTwist();assert.equal(plain.fx,undefined,'other games deal none')
})

test('the twist crosses the network, and a bad one is refused',()=>{
 const {g}=game({type:'bonus',x:300,y:352})
 const snap=JSON.parse(JSON.stringify(snapshotOf(g)));assert.deepEqual(snap.fx,{type:'bonus',x:300,y:352});assert.ok(isGameMessage(snap))
 const guest=game(null).g;applySnapshot(guest,snap);assert.deepEqual(guest.fx,{type:'bonus',x:300,y:352})
 const plain=JSON.parse(JSON.stringify(snapshotOf(game(null).g)));assert.equal(plain.fx,null);assert.ok(isGameMessage(plain))
 const old={...plain};delete old.fx;assert.ok(isGameMessage(old),'a snapshot without one still validates')
 for(const bad of [{type:'nuke'},{type:'bonus',x:'a'},{type:'bomb',n:NaN},{type:'bomb',spent:'yes'},7,'x'])assert.equal(isGameMessage({...plain,fx:bad}),false,JSON.stringify(bad))
 assert.equal(isGameMessage({...plain,mode:'chaos'}),true)
})

test('two AIs play a whole chaos game to a winner, twists and all',()=>{
 const real=Math.random;Math.random=seeded(77)
 try{
  const {g}=game(null);g.resetRack();g.hotSeat=true;let n=0
  for(;n<500&&!g.over;n++){
   const plan=chooseShot(g.balls,null,g.ballInHand,'league','chaos',{player:g.turn});if(!plan)break
   if(plan.place){g.balls[0].x=plan.place.x;g.balls[0].y=plan.place.y;g.ballInHand=false}
   g.startShot();strike(g.balls[0],Math.cos(plan.angle)*shotSpeed(plan.power),Math.sin(plan.angle)*shotSpeed(plan.power));roll(g,8)
   assert.ok(g.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)),'no ball ever went to NaN')
  }
  assert.ok(g.over,`chaos did not finish in ${n} shots`);assert.ok(g.score[g.result]>=15)
 }finally{Math.random=real}
})
