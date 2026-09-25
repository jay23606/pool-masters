import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {integrate,railBounce,substeps,strike,shotSpeed} from '../src/physics.js'
import {rollout,chooseShot} from '../src/ai.js'
import {rack,validCueSpot} from '../src/rules.js'
import {PRESETS,presetById,presetItems,isPreset,setObstacles,getObstacles,obstacleStep,blocks,nearestOnWall,BUMPER_E,WALL_R} from '../src/obstacles.js'
import {R,PR,POCKETS,MINX,MAXX,MINY,MAXY,setTableSize} from '../src/table.js'
setTableSize(7)
globalThis.cancelAnimationFrame??=()=>{};globalThis.clearTimeout??=()=>{}

const ball=(x,y,vx=0,vy=0,n=1)=>({n,x,y,vx,vy,wx:0,wy:0,wz:0,z:0,vz:0,on:true,k:n?'solid':'cue'})
const seeded=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
test.afterEach(()=>setObstacles([]))

test('every preset leaves the head spot and the rack clear, sits on the table, and pairs its portals',()=>{
 assert.equal(new Set(PRESETS.map(p=>p.id)).size,PRESETS.length)
 for(const p of PRESETS){
  assert.ok(p.items.length>0);assert.notEqual(presetById(p.id),null)
  for(const b of [...rack('8ball'),...rack('9ball'),...rack('bank')])assert.equal(blocks(b.x,b.y,p.items),false,`${p.id}: ball ${b.n} of a rack is clear`)
  assert.equal(blocks(154,190,p.items),false,`${p.id}: head spot`)
  for(const o of p.items){
   const pts=o.t==='wall'?[[o.x1,o.y1],[o.x2,o.y2]]:[[o.x,o.y]]
   for(const [x,y] of pts){
    assert.ok(x>MINX+20&&x<MAXX-20&&y>MINY+10&&y<MAXY-10,`${p.id}: on the cloth`)
    for(const k of POCKETS)assert.ok(Math.hypot(x-k[0],y-k[1])>PR*3,`${p.id}: clear of the pockets`)
   }
   if(o.t==='portal'){
    const back=p.items.find(q=>q.t==='portal'&&q.x===o.to[0]&&q.y===o.to[1]);assert.ok(back,`${p.id}: portal has a partner`)
    assert.deepEqual(back.to,[o.x,o.y]);assert.equal(back.r,o.r)
   }
  }
 }
 assert.deepEqual(presetItems('nope'),[]);assert.deepEqual(presetItems(null),[]);assert.equal(isPreset(null),true);assert.equal(isPreset('bumpers'),true);assert.equal(isPreset('x'),false)
})

test('a bumper bounces a ball back, keeping most of its speed and its sideways motion',()=>{
 const list=[{t:'bumper',x:300,y:190,r:12}]
 const b=ball(300-(R+12)+2,190,400,60)
 assert.equal(obstacleStep(b,list),true)
 assert.ok(b.vx<0,'turned around');assert.ok(Math.abs(b.vx+400*BUMPER_E)<1e-6);assert.equal(b.vy,60,'tangential speed kept')
 assert.ok(Math.hypot(b.x-300,b.y-190)>=R+12-1e-9,'pushed back out of it')
 const away=ball(300-(R+12)+2,190,-400,0);obstacleStep(away,list);assert.equal(away.vx,-400,'a ball already leaving is not slowed')
 assert.equal(obstacleStep(ball(100,100,50,50),list),false)
 const centre=ball(300,190,0,0);assert.equal(obstacleStep(centre,list),false,'dead centre: no direction to push, no NaN')
})

test('a wall bounces a ball off its side and its end, and is a thin barrier',()=>{
 const w={t:'wall',x1:300,y1:100,x2:300,y2:200}
 const side=ball(300-(R+WALL_R)+1,150,500,0);assert.equal(obstacleStep(side,[w]),true);assert.ok(side.vx<0)
 const end=ball(300,200+R+WALL_R-1,0,-300);assert.equal(obstacleStep(end,[w]),true);assert.ok(end.vy>0,'bounced off the end cap')
 assert.equal(obstacleStep(ball(300,200+R+WALL_R+3,0,-300),[w]),false)
 assert.deepEqual(nearestOnWall(w,250,50),[300,100]);assert.deepEqual(nearestOnWall(w,250,150),[300,150]);assert.deepEqual(nearestOnWall({...w,y2:100},250,150),[300,100])
})

test('a portal sends a ball out of its partner going the same way, and it does not go straight back in',()=>{
 const list=presetItems('portals'),A=list[0],B=list[1]
 const b=ball(A.x-5,A.y,300,0);assert.equal(obstacleStep(b,list),false,'a portal is not a bounce')
 assert.ok(Math.hypot(b.x-B.x,b.y-B.y)>A.r,'it left the partner ring');assert.ok(b.x>B.x,'on the side it is heading toward');assert.equal(b.vx,300);assert.equal(b.pc,1)
 const at=[b.x,b.y];obstacleStep(b,list);assert.deepEqual([b.x,b.y],at,'no second trip while it is still near a ring')
 b.x=B.x+200;b.y=B.y;obstacleStep(b,list);assert.equal(b.pc,0,'clear of the rings: it can use one again')
 const slow=ball(A.x,A.y,.2,0);obstacleStep(slow,list);assert.deepEqual([slow.x,slow.y],[A.x,A.y],'a ball at rest on a ring stays put')
})

test('a ball in the air hops bumpers and walls, but not portals',()=>{
 const list=[{t:'bumper',x:300,y:190,r:12},{t:'wall',x1:400,y1:100,x2:400,y2:300},...presetItems('portals')]
 const h=ball(295,190,400,0);h.z=10;assert.equal(obstacleStep(h,list),false);assert.equal(h.vx,400)
 const w=ball(400,190,400,0);w.z=10;assert.equal(obstacleStep(w,list),false)
 const p=ball(list[2].x,list[2].y,300,0);p.z=10;obstacleStep(p,list);assert.equal(p.pc,1,'still goes through a portal')
})

test('through the real step loop, even the hardest shot cannot tunnel through a wall',()=>{
 setObstacles([{t:'wall',x1:350,y1:60,x2:350,y2:320}])
 for(const y of [80,150,200,260,300]){
  const b=ball(200,y);strike(b,3200,0)
  for(let t=0;t<1.2;t+=1/120){const n=substeps([b],1/120);for(let i=0;i<n;i++){integrate(b,1/120/n);railBounce(b)}}
  assert.ok(b.x<350,`y=${y}: stayed on its side (x=${b.x.toFixed(1)})`)
 }
})

test("the AI's rollout sees obstacles: a wall shields a ball that is open without it",()=>{
 const balls=[ball(200,190,0,0,0),ball(300,190,0,0,1)]
 const open=rollout(balls,0,55,6,[0,0]);assert.ok(open.firstHit&&open.firstHit.n===1)
 setObstacles([{t:'wall',x1:250,y1:120,x2:250,y2:260}])
 const walled=rollout(balls,0,55,6,[0,0]);assert.equal(walled.firstHit,null,'the cue ball never reaches the ball')
})

test('the cue ball cannot be placed on an obstacle',()=>{
 setObstacles(presetItems('bumpers'))
 const b=presetItems('bumpers')[0]
 assert.equal(validCueSpot(rack('8ball'),{x:b.x,y:b.y}),false)
 assert.equal(validCueSpot(rack('8ball'),{x:154,y:190}),true)
 setObstacles([]);assert.equal(validCueSpot(rack('8ball'),{x:b.x,y:b.y}),true)
})

// ---- the game ----
function game(obstacles,extra={}){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{mode:'8ball',turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:true,hotSeat:true,names:{a:'A',b:'B'},ready:true,me:'a',host:true,
  shots:{a:0,b:0},acc:0,flash(){},setSpin(){},send(){},onSave(){},onFinish(){},onShot(){},onReplay(){},score:{a:0,b:0},breaker:'a',
  balls:rack('8ball'),power:{value:50},spin:{a:0,b:0},aiming:true,angle:0,house:{race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false},obstacles,...extra})
 return g
}

test('a game sets its obstacles on a new rack, clears them when it ends, and the clear-cloth games ignore them',()=>{
 const g=game('bumpers');g.resetRack();assert.equal(getObstacles().length,presetItems('bumpers').length)
 g.destroy();assert.equal(getObstacles().length,0)
 game(null).resetRack();assert.equal(getObstacles().length,0)
 for(const extra of [{mode:'chaos'},{rogueSeed:5},{challenge:'speed'}]){const h=game('bumpers',extra);try{h.resetRack()}catch{/* the harness has no Rogue or challenge state; only the obstacles matter here */}assert.equal(getObstacles().length,0,JSON.stringify(extra))}
 const d=game('bumpers',{drill:{layout:{cue:[200,190],balls:[[1,400,190]]},win:{pot:1},obs:'walls'}});d.resetRack();assert.equal(getObstacles().length,presetItems('walls').length,'a puzzle brings its own')
})

for(const id of ['bumpers','walls','portals','gauntlet'])test(`two AIs play on the ${id} table without a ball ever being lost or stuck in an obstacle`,()=>{
 const real=Math.random;Math.random=seeded(31)
 try{
  const g=game(id);g.resetRack();let n=0
  const items=presetItems(id).filter(o=>o.t!=='portal')   // a ball may come to rest beside a portal ring; it is not stuck
  for(;n<60&&!g.over;n++){
   const plan=chooseShot(g.balls,g.group?.(g.turn)??null,g.ballInHand,'league','8ball',{player:g.turn});if(!plan)break
   if(plan.place){g.balls[0].x=plan.place.x;g.balls[0].y=plan.place.y;g.ballInHand=false}
   g.startShot();strike(g.balls[0],Math.cos(plan.angle)*shotSpeed(plan.power),Math.sin(plan.angle)*shotSpeed(plan.power))
   g.phase='roll';g.simAt=0;let now=0;for(let i=0;i<8*120&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
   for(const b of g.balls)if(b.on){
    assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y)&&b.x>=MINX-1&&b.x<=MAXX+1&&b.y>=MINY-1&&b.y<=MAXY+1,'on the table')
    assert.equal(blocks(b.x,b.y,items,R-1.5),false,`ball ${b.n} at rest inside an obstacle (${b.x|0},${b.y|0})`)
   }
  }
  assert.ok(n>2,'it played some shots')
 }finally{Math.random=real}
})
