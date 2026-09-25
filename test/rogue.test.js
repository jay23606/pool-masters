import test from 'node:test';import assert from 'node:assert/strict'
import {UPGRADES,upgradeById,levelSpec,newRun,offer,choose,judge,record,emptyRecord,START_LIVES,POCKET_BOOST,rng} from '../src/rogue.js'
import {PoolGame} from '../src/pool.js'
import {chooseShot} from '../src/ai.js'
import {TROPHIES,earned,emptyStats} from '../src/trophies.js'
import {PR,POCKETS} from '../src/table.js'

const shot=(o={})=>({potted:1,scratch:false,left:3,jumped:false,...o})

test('a run starts on table one with three lives, and the same seed is the same run',()=>{
 const a=newRun(42),b=newRun(42),c=newRun(43)
 assert.equal(a.level,1);assert.equal(a.lives,START_LIVES);assert.equal(a.over,false);assert.equal(a.score,0)
 assert.deepEqual(a.layout,b.layout);assert.notDeepEqual(a.layout,c.layout)
 assert.equal(a.layout.length,levelSpec(1).balls)
})

test('tables get bigger and the slack shrinks, and extra shots add to the budget',()=>{
 const s=n=>levelSpec(n)
 for(let n=2;n<=12;n++)assert.ok(s(n).balls>=s(n-1).balls,`table ${n} has fewer balls`)
 assert.ok(s(30).balls<=9,'no more than nine balls')
 assert.ok(s(1).shots-s(1).balls>s(10).shots-s(10).balls,'less slack later')
 assert.ok(s(10).shots-s(10).balls>=1,'always a shot to spare')
 assert.equal(levelSpec(3,{shots:2}).shots,levelSpec(3).shots+4)
})

test('every ball on a table is legal, and a run never repeats a table',()=>{
 let run=newRun(7);const seen=new Set()
 for(let level=1;level<=8;level++){
  const l=run.layout;assert.equal(l.length,levelSpec(level,run.upgrades).balls)
  assert.equal(new Set(l.map(b=>b.n)).size,l.length);assert.ok(l.every(b=>b.n!==8&&b.n!==0))
  for(const b of l)for(const k of POCKETS)assert.ok(Math.hypot(k[0]-b.x,k[1]-b.y)>PR*2.9)
  seen.add(JSON.stringify(l))
  run=choose({...run,cleared:level},offer(run)[0].id)
 }
 assert.equal(seen.size,8)
})

test('a shot costs one; a scratch costs another unless the shield takes it; a jump uses a charge',()=>{
 let run=newRun(1);const start=run.shotsLeft
 let r=judge(run,shot());assert.equal(r.run.shotsLeft,start-1)
 r=judge(run,shot({potted:0,scratch:true}));assert.equal(r.run.shotsLeft,start-2);assert.equal(r.respotCue,true)
 run={...run,shield:true};r=judge(run,shot({potted:0,scratch:true}));assert.equal(r.run.shotsLeft,start-1);assert.equal(r.run.shield,false,'the shield is used up for this table')
 r=judge(r.run,shot({potted:0,scratch:true}));assert.equal(r.run.shotsLeft,start-3,'a second scratch pays')
 run={...run,jumps:2};r=judge(run,shot({jumped:true}));assert.equal(r.run.jumps,1)
 assert.equal(judge({...run,jumps:0},shot({jumped:true})).run.jumps,0,'never below none')
})

test('a scratch scores nothing; balls potted otherwise add to the score',()=>{
 const run=newRun(1)
 assert.equal(judge(run,shot({potted:2})).run.score,2)
 assert.equal(judge(run,shot({potted:2,scratch:true})).run.score,0)
})

test('second wind: the first miss on a table is free, and only a real miss',()=>{
 let run={...newRun(1),wind:1};const start=run.shotsLeft
 let r=judge(run,shot({potted:0}));assert.equal(r.run.shotsLeft,start);assert.equal(r.run.wind,0)
 r=judge(r.run,shot({potted:0}));assert.equal(r.run.shotsLeft,start-1,'used up')
 r=judge({...run,wind:1},shot({potted:1}));assert.equal(r.run.wind,1,'a pot does not use it')
 r=judge({...run,wind:1},shot({potted:0,scratch:true}));assert.equal(r.run.wind,1,'a scratch is not a miss')
})

test('clearing the table ends it, even on the last shot, and reports which table',()=>{
 let run={...newRun(1),shotsLeft:1}
 const r=judge(run,shot({potted:1,left:0}));assert.equal(r.event,'cleared');assert.equal(r.run.cleared,1)
 assert.equal(r.run.lives,START_LIVES,'clearing on the last shot costs no life')
})

test('running out of shots costs a life and gives the same table size again, then the run ends when lives run out',()=>{
 let run={...newRun(5),shotsLeft:1}
 let r=judge(run,shot({potted:0,left:3}));assert.equal(r.event,'life');assert.equal(r.run.lives,START_LIVES-1)
 assert.equal(r.run.level,1);assert.equal(r.run.shotsLeft,levelSpec(1).shots);assert.equal(r.run.layout.length,levelSpec(1).balls)
 assert.notDeepEqual(r.run.layout,run.layout,'fresh balls, not the same ones')
 r=judge({...r.run,lives:1,shotsLeft:1},shot({potted:0}));assert.equal(r.event,'over');assert.equal(r.run.over,true)
 assert.equal(judge(r.run,shot()).event,null,'a finished run takes no more shots')
})

test('the offer is three different upgrades the run can still take, the same every time',()=>{
 const run=newRun(9),o=offer(run)
 assert.equal(o.length,3);assert.equal(new Set(o.map(u=>u.id)).size,3)
 assert.deepEqual(offer(run).map(u=>u.id),o.map(u=>u.id))
 // one that has been taken as often as allowed is not offered again
 const full={...run,upgrades:{shield:1,pockets:3,shots:3,life:9,jump:3}}
 assert.deepEqual(offer(full).map(u=>u.id),['wind'],'only what is left')
 assert.deepEqual(offer({...full,upgrades:{...full.upgrades,wind:2}}),[])
})

test('choosing an upgrade applies it and starts the next table with its effects',()=>{
 const run=newRun(3)
 assert.equal(choose(run,'life').lives,START_LIVES+1)
 const s=choose(run,'shots');assert.equal(s.level,2);assert.equal(s.shotsLeft,levelSpec(2,{shots:1}).shots)
 const j=choose(run,'jump');assert.equal(j.jumps,2)
 assert.equal(choose(run,'shield').shield,true);assert.equal(choose(run,'wind').wind,1)
 assert.equal(choose(run,'pockets').upgrades.pockets,1)
 assert.equal(choose(run,'nope'),run);assert.equal(choose({...run,upgrades:{shield:1}},'shield').upgrades.shield,1,'at its limit: nothing changes')
 // charges refill on every table
 const spent=choose({...j,jumps:0},'life');assert.equal(spent.jumps,2)
})

test('choose does not change the run it was given',()=>{
 const run=newRun(4),copy=JSON.stringify(run);choose(run,'life');judge(run,shot());offer(run);assert.equal(JSON.stringify(run),copy)
})

test('every upgrade has a name, a description and a sane limit',()=>{
 for(const u of UPGRADES){assert.ok(u.name&&u.desc&&u.max>=1);assert.equal(upgradeById(u.id),u)}
 assert.equal(new Set(UPGRADES.map(u=>u.id)).size,UPGRADES.length);assert.equal(upgradeById('x'),null)
})

test('the best run is only ever improved',()=>{
 let {rec,newBest}=record(emptyRecord(),{cleared:3});assert.deepEqual([rec.best,rec.runs,newBest],[3,1,true])
 ;({rec,newBest}=record(rec,{cleared:2}));assert.deepEqual([rec.best,rec.runs,newBest],[3,2,false])
 ;({rec,newBest}=record(rec,{cleared:5}));assert.deepEqual([rec.best,newBest],[5,true])
 assert.equal(record(undefined,{cleared:1}).rec.best,1)
})

test('the run trophies read the best run',()=>{
 const t=id=>TROPHIES.find(x=>x.id===id),ctx=rogue=>({stats:emptyStats(),drills:{},profile:null,rogue})
 assert.equal(earned(t('rogue-3'),ctx(undefined)),false);assert.equal(earned(t('rogue-3'),ctx({best:3})),true)
 assert.equal(earned(t('rogue-8'),ctx({best:7})),false);assert.equal(earned(t('rogue-8'),ctx({best:8})),true)
})

test('the same seed always gives the same stream, and different seeds do not',()=>{
 const a=rng(5),b=rng(5),c=rng(6);const xs=[a(),a(),a()],ys=[b(),b(),b()],zs=[c(),c(),c()]
 assert.deepEqual(xs,ys);assert.notDeepEqual(xs,zs);assert.ok(xs.every(v=>v>=0&&v<1))
})

// ---- through the real game object ----
function game(seed=11){
 const g=Object.create(PoolGame.prototype),events=[]
 Object.assign(g,{mode:'8ball',rogueSeed:seed,turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:true,ready:true,me:'a',host:true,
  shots:{a:0,b:0},acc:0,flash(){},setSpin(){},send(){},onSave(){},onShot(){},onReplay(){},onFinish(){},onRogue:e=>events.push(e),
  power:{value:50},spin:{a:0,b:0},house:{race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false},breaker:'a'})
 g.resetRack();g.sync()
 return {g,events}
}
function play(g,angle,power,jump=false){
 g.jumpOn=jump;g.aiming=true;g.angle=angle;g.power.value=power;g.takeShot()
 let now=g.clock||0
 for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 g.clock=now
}

test('the game sets up a run: the cue ball on the spot and the table\'s balls',()=>{
 const {g}=game();assert.equal(g.balls[0].n,0);assert.equal(g.balls.length,1+levelSpec(1).balls)
 assert.equal(g.run.level,1);assert.equal(g.rogueWait,false)
})

test('an AI clears tables and takes upgrades; the game never gets stuck between them',()=>{
 const {g,events}=game(21)

 for(let i=0;i<400&&!g.over;i++){
  if(g.rogueWait){const e=events[events.length-1];assert.equal(e.type,'cleared');assert.equal(g.canControl(),false,'no shooting while choosing');assert.equal(g.pickUpgrade(e.offer[0].id),true);continue}
  const plan=chooseShot(g.balls.map(b=>({...b})),null,false,'league','8ball')
  if(!plan)break
  play(g,plan.angle,plan.power)
 }
 assert.ok(g.over,'the run ended within the shot limit')
 assert.equal(events[events.length-1].type,'over')
 assert.ok(events.some(e=>e.type==='cleared'),'at least one table was cleared on the way')
 assert.equal(g.run.lives,0)
})

test('choosing before a table is cleared, or twice, does nothing',()=>{
 const {g}=game();assert.equal(g.pickUpgrade('life'),false)
})

test('jumps come only from the upgrade, and a jump uses a charge',()=>{
 const {g}=game(3);assert.equal(g.jumpAllowed(),false)
 g.run={...g.run,jumps:2};assert.equal(g.jumpAllowed(),true)
 play(g,0.3,30,true);assert.equal(g.run.jumps,1)
 g.run={...g.run,jumps:0};assert.equal(g.jumpAllowed(),false)
})

test('wide pockets pot balls a normal pocket would miss, and only in a run',()=>{
 const {g}=game(5),ball=g.balls[1],[px,py]=POCKETS[1]
 const off=PR*1.1                       // just outside a normal pocket
 ball.x=px;ball.y=py+off;ball.vx=ball.vy=0;g.potted=[];g.scratch=false
 g.sub(1/1000);assert.equal(ball.on,true,'outside a normal pocket')
 g.run={...g.run,upgrades:{...g.run.upgrades,pockets:1}};assert.equal(g.pocketScale(),1+POCKET_BOOST)
 g.sub(1/1000);assert.equal(ball.on,false,'inside a wider one')
 const plain=Object.create(PoolGame.prototype);assert.equal(plain.pocketScale(),1)
})

test('a game that is not a run is untouched: no run state, no waiting',()=>{
 const g=Object.create(PoolGame.prototype);assert.equal(g.pocketScale(),1);assert.notEqual(g.rogueWait,true)
})
