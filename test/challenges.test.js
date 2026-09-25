import test from 'node:test';import assert from 'node:assert/strict'
import {CHALLENGES,byId,scatter,begin,startClock,elapsed,timeLeft,clearTime,timedOut,judge,timeUp,record,isBetter,format,NUMBERS,HEAD_SPOT} from '../src/challenges.js'
import {POCKETS,PR,R} from '../src/table.js'
import {TROPHIES,earned,emptyStats} from '../src/trophies.js'

const seeded=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const shot=(o={})=>({potted:[],scratch:false,left:5,...o})

test('there are three challenges, each with a rule about which score is better',()=>{
 assert.deepEqual(CHALLENGES.map(c=>c.id),['speed','perfect','clear'])
 assert.equal(byId('speed').higher,true);assert.equal(byId('clear').higher,false)
 assert.ok(CHALLENGES.every(c=>c.name&&c.blurb&&c.balls>=5))
 assert.equal(byId('nope'),null)
})

test('a scatter is legal: apart, off the cushions, clear of the pockets and the cue ball, and never the 8',()=>{
 for(let seed=1;seed<=60;seed++){
  const cue=HEAD_SPOT,balls=scatter(8,[cue],seeded(seed))
  assert.equal(balls.length,8,`seed ${seed} could not place 8`)
  assert.equal(new Set(balls.map(b=>b.n)).size,8)
  for(const b of balls){
   assert.ok(NUMBERS.includes(b.n)&&b.n!==8)
   assert.ok(b.x>=60&&b.x<=640&&b.y>=60&&b.y<=320)
   for(const k of POCKETS)assert.ok(Math.hypot(k[0]-b.x,k[1]-b.y)>PR*2.9)
   assert.ok(Math.hypot(cue.x-b.x,cue.y-b.y)>R*3.3)
  }
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++)assert.ok(Math.hypot(balls[i].x-balls[j].x,balls[i].y-balls[j].y)>R*3.3)
 }
})

test('the clock starts with the first shot and never again',()=>{
 let c=begin('speed')
 assert.equal(elapsed(c,5000),0);assert.equal(timeLeft(c,5000),60000)
 c=startClock(c,1000);assert.equal(c.startedAt,1000)
 assert.equal(startClock(c,9999).startedAt,1000)
 assert.equal(elapsed(c,31000),30000);assert.equal(timeLeft(c,31000),30000)
 assert.equal(timedOut(c,60999),false);assert.equal(timedOut(c,61000),true)
 assert.equal(timedOut(begin('speed'),1e9),false,'no shot, no clock')
 assert.equal(timedOut(begin('perfect'),1e9),false,'only the timed game times out')
})

test('speed pot: potted balls score, a scratch scores nothing and puts the cue ball back',()=>{
 let c=startClock(begin('speed'),0)
 let r=judge(c,shot({potted:[3,4]}),1000);assert.equal(r.state.score,2);assert.equal(r.respotCue,false)
 r=judge(r.state,shot({potted:[5],scratch:true}),2000);assert.equal(r.state.score,2,'pots on a scratch do not count');assert.equal(r.respotCue,true)
 r=judge(r.state,shot(),3000);assert.equal(r.state.score,2);assert.equal(r.over,false)
})

test('speed pot: the table refills when cleared, and the game ends on time',()=>{
 let c=startClock(begin('speed'),0)
 let r=judge(c,shot({potted:[1],left:0}),1000);assert.equal(r.refill,true);assert.equal(r.over,false)
 r=judge(r.state,shot({potted:[2]}),61000);assert.equal(r.over,true);assert.equal(r.state.final,2,'the last shot still counts')
 assert.equal(judge(r.state,shot({potted:[9]}),62000).state.score,2,'a finished game does not move')
 // clearing the table after time is up does not refill
 const late=judge(c,shot({potted:[1],left:0}),61000);assert.equal(late.refill,false);assert.equal(late.over,true)
})

test('perfect potter: every shot must drop something, and the first that does not ends it',()=>{
 let s=begin('perfect')
 for(let i=1;i<=4;i++){const r=judge(s,shot({potted:[i]}),0);assert.equal(r.over,false);s=r.state;assert.equal(s.score,i)}
 for(const bad of [shot(),shot({potted:[1],scratch:true})]){
  const r=judge(s,bad,0);assert.equal(r.over,true);assert.equal(r.state.final,4,'the run so far is the score')
 }
 // several balls on one shot are still one shot
 assert.equal(judge(begin('perfect'),shot({potted:[1,2,3]}),0).state.score,1)
 assert.equal(judge(begin('perfect'),shot({potted:[1],left:0}),0).refill,true,'a cleared table refills and the run goes on')
})

test('clear the table: scratches cost five seconds and clearing ends it with the time',()=>{
 let c=startClock(begin('clear'),0)
 let r=judge(c,shot({potted:[1],scratch:true,left:5}),4000);assert.equal(r.state.penalties,1);assert.equal(r.respotCue,true)
 assert.equal(clearTime(r.state,4000),4000+5000)
 r=judge(r.state,shot({potted:[2],left:0}),20000)
 assert.equal(r.over,true);assert.equal(r.state.final,20000+5000)
 assert.equal(clearTime(judge(startClock(begin('clear'),0),shot({potted:[1],left:0}),12345).state,12345),12345)
})

test('a timed game that runs out between shots ends with what it has',()=>{
 const c={...startClock(begin('speed'),0),score:7}
 assert.deepEqual([timeUp(c).over,timeUp(c).final],[true,7])
 assert.equal(timeUp(timeUp(c)).final,7)
})

test('a best is only ever improved, in the direction that is better for that game',()=>{
 assert.equal(isBetter('speed',9,8),true);assert.equal(isBetter('speed',8,8),false);assert.equal(isBetter('speed',7,8),false)
 assert.equal(isBetter('clear',30000,40000),true);assert.equal(isBetter('clear',50000,40000),false)
 assert.equal(isBetter('perfect',1,undefined),true)
 let r=record({}, 'speed',6);assert.deepEqual([r.newBest,r.best,r.results.speed.plays],[true,6,1])
 r=record(r.results,'speed',4);assert.deepEqual([r.newBest,r.best,r.results.speed.plays],[false,6,2])
 r=record(r.results,'clear',30000);r=record(r.results,'clear',31000);assert.equal(r.results.clear.best,30000)
})

test('scores read well',()=>{
 assert.equal(format('speed',9),'9');assert.equal(format('clear',31234),'31.2 s');assert.equal(format('perfect',null),'–')
})

test('the challenge trophies read the best scores, and nobody has one for nothing',()=>{
 const t=id=>TROPHIES.find(x=>x.id===id),ctx=challenges=>({stats:emptyStats(),drills:{},career:undefined,challenges,profile:null})
 for(const id of ['speed-10','perfect-8','clear-40'])assert.equal(earned(t(id),ctx(undefined)),false,id)
 assert.equal(earned(t('speed-10'),ctx({speed:{best:9}})),false);assert.equal(earned(t('speed-10'),ctx({speed:{best:10}})),true)
 assert.equal(earned(t('perfect-8'),ctx({perfect:{best:8}})),true)
 assert.equal(earned(t('clear-40'),ctx({clear:{best:40000}})),false,'exactly 40 seconds is not under')
 assert.equal(earned(t('clear-40'),ctx({clear:{best:39900}})),true)
})
