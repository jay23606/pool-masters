import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike,atRest,airborne,jumpSpeed,JUMP_MIN,JUMP_MAX,substeps} from '../src/physics.js'
import {stepCosmetic,STEP} from '../src/predict.js'
import {rack} from '../src/rules.js'
import {snapshotOf,applySnapshot} from '../src/game-state.js'
import {isGameMessage} from '../src/protocol.js'
import {R,POCKETS} from '../src/table.js'

const b=(n,x,y)=>({n,x,y,on:true,k:n?'solid':'cue',vx:0,vy:0,wx:0,wy:0,wz:0,z:0,vz:0})
// the same fixed-step, adaptive-substep loop the game runs, without the game
function simulate(balls,seconds=3){
 for(let t=0;t<seconds;t+=STEP){const n=substeps(balls,STEP);for(let i=0;i<n;i++)stepCosmetic(balls,STEP/n)}
}

test('a jump shot hops over a ball it is touching; the same shot without a jump hits it',()=>{
 const flat=[b(0,200,190),b(1,220,190)]
 strike(flat[0],700,0);simulate(flat,.5)
 assert.ok(flat[1].x>230,'without a jump the ball is hit and goes away')
 const hop=[b(0,200,190),b(1,220,190)]
 strike(hop[0],700,0,0,0,true);simulate(hop,3)
 assert.deepEqual([hop[1].x,hop[1].y],[220,190],'the ball on the table never moved')
 assert.ok(hop[0].x>240,'the cue ball went past it')
 assert.equal(hop[0].z,0,'and came back down');assert.equal(hop[0].vz,0)
 assert.ok(hop.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)&&Number.isFinite(x.z)))
})

test('in the air a ball keeps its sideways speed, then lands and rolls as any ball does',()=>{
 const c=b(0,100,190);strike(c,600,0,0,0,true)
 const v0=c.vx;let flew=0,peak=0
 while(airborne(c)&&flew<200){stepCosmetic([c],STEP);flew++;peak=Math.max(peak,c.z);if(airborne(c))assert.equal(c.vx,v0,'no friction in the air')}
 assert.ok(flew>10&&flew<120,`it was in the air for ${flew} steps`)
 assert.ok(peak>R,'it rose more than a ball radius')
 assert.ok(peak<4*R,'and not absurdly high')
 for(let i=0;i<2000&&!atRest(c);i++)stepCosmetic([c],STEP)
 assert.equal(atRest(c),true)
})

test('a ball in the air is never "at rest", even when it is not moving sideways',()=>{
 const c=b(0,300,190);c.z=5;c.vz=0
 assert.equal(atRest(c),false);assert.equal(airborne(c),true)
 c.z=0;assert.equal(atRest(c),true)
})

test('a harder shot jumps higher, within limits',()=>{
 assert.equal(jumpSpeed(0),JUMP_MIN);assert.equal(jumpSpeed(1e6),JUMP_MAX)
 assert.ok(jumpSpeed(600)>jumpSpeed(500)&&jumpSpeed(500)>=JUMP_MIN)
 const soft=b(0,0,0),hard=b(0,0,0);strike(soft,450,0,0,0,true);strike(hard,900,0,0,0,true)
 assert.ok(hard.vz>soft.vz)
})

test('a shot that is not a jump leaves the ball on the cloth, even if it was in the air before',()=>{
 const c=b(0,0,0);c.z=9;c.vz=100;strike(c,300,0)
 assert.equal(c.z,0);assert.equal(c.vz,0)
})

// ---- the game ----
function game(house,extra={}){
 const g=Object.create(PoolGame.prototype),sent=[]
 Object.assign(g,{mode:'8ball',turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:true,ready:true,me:'a',host:true,
  shots:{a:0,b:0},acc:0,flash(){},setSpin(){},send:m=>sent.push(m),onSave(){},onFinish(){},onShot(){},onReplay(){},score:{a:0,b:0},breaker:'a',
  balls:rack('8ball'),power:{value:50},spin:{a:0,b:0},aiming:true,angle:0,house:{race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false,...house},...extra})
 g.sync();return {g,sent}
}

test('jump shots are a house rule, off by default: a request for one is ignored',()=>{
 const {g}=game({})
 assert.equal(g.jumpAllowed(),false)
 g.receiveShot?.call(Object.assign(g,{turn:'b',phase:'aim'}),{t:'shot',vx:500,vy:0,spin:[0,0],jump:true})
 assert.equal(g.balls[0].z,0,'the host did not let the cue ball leave the cloth')
})

test('with the rule on, the host plays a jump when the shooter asked for one, and only that shot',()=>{
 const {g}=game({jumps:true},{turn:'b'})
 assert.equal(g.jumpAllowed(),true)
 g.receiveShot({t:'shot',vx:500,vy:0,spin:[0,0],jump:true});assert.ok(g.balls[0].z>0)
 const {g:h}=game({jumps:true},{turn:'b'})
 h.receiveShot({t:'shot',vx:500,vy:0,spin:[0,0]});assert.equal(h.balls[0].z,0,'no jump unless asked')
})

test('the shooter\'s own Jump toggle applies to one shot and then switches off',()=>{
 const {g}=game({jumps:true});g.jumpOn=true
 g.takeShot();assert.ok(g.balls[0].z>0,'the cue ball left the cloth');assert.equal(g.jumpOn,false)
 // a guest asks the host with a flag, and sends nothing extra when it is not a jump
 const {g:guest,sent}=game({jumps:true},{host:false});guest.jumpOn=true;guest.takeShot()
 assert.equal(sent[0].jump,true)
 const {g:plain,sent:s2}=game({jumps:true},{host:false});plain.takeShot();assert.equal('jump' in s2[0],false)
})

test('drills and challenges never allow a jump, whatever the house says',()=>{
 assert.equal(game({jumps:true},{drill:{id:'x'}}).g.jumpAllowed(),false)
 assert.equal(game({jumps:true},{chal:{id:'speed'}}).g.jumpAllowed(),false)
})

test('a ball in the air is not potted by a pocket it passes over, and is when it lands in one',()=>{
 const {g}=game({jumps:true})
 const cue=g.balls[0],[px,py]=POCKETS[0]
 cue.x=px;cue.y=py;cue.vx=cue.vy=0;cue.z=12;cue.vz=0
 g.potted=[];g.scratch=false
 g.sub(1/1000)
 assert.equal(cue.on,true,'still on the table: it was over the pocket, not in it')
 cue.z=0;cue.vz=0;g.sub(1/1000)
 assert.equal(cue.on,false,'on the cloth over a pocket it is potted');assert.equal(g.scratch,true)
})

test('a jump shot is not graded by the coach, which knows nothing of the air',()=>{
 const {g}=game({jumps:true});g.jumpOn=true;g.lastCoach=null;g.takeShot()
 assert.equal(g.lastCoach??null,null)
 const {g:h}=game({jumps:true});h.takeShot();assert.ok(h.lastCoach,'an ordinary shot still is')
})

// ---- the wire ----
test('height crosses the network only while a ball is in the air, and the old shape still validates',()=>{
 const {g}=game({jumps:true})
 const flat=JSON.parse(JSON.stringify(snapshotOf(g)));assert.equal(flat.b[0].length,10);assert.ok(isGameMessage(flat))
 g.balls[0].z=8;g.balls[0].vz=120
 const up=JSON.parse(JSON.stringify(snapshotOf(g)));assert.equal(up.b[0].length,12);assert.ok(isGameMessage(up))
 const guest=game({}).g;applySnapshot(guest,up)
 assert.deepEqual([guest.balls[0].z,guest.balls[0].vz],[8,120])
 applySnapshot(guest,flat);assert.equal(guest.balls[0].z,0,'a snapshot without height means on the cloth')
})

test('the shot message carries a jump flag that has to be a boolean, and a bad tuple length is refused',()=>{
 const shot={t:'shot',vx:1,vy:2,spin:[0,0]}
 assert.equal(isGameMessage(shot),true);assert.equal(isGameMessage({...shot,jump:true}),true);assert.equal(isGameMessage({...shot,jump:false}),true)
 for(const bad of ['yes',1,null,{}])assert.equal(isGameMessage({...shot,jump:bad}),false,JSON.stringify(bad))
 const {g}=game({});const s=JSON.parse(JSON.stringify(snapshotOf(g)));s.b[0]=[...s.b[0],1]
 assert.equal(isGameMessage(s),false,'eleven fields is not a shape')
})
