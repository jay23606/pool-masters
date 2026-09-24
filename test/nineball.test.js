import test from 'node:test';import assert from 'node:assert/strict'
import {rack,lowestBall,nineRespot,judgeShot,judgeNineBall,modeOf,MODES} from '../src/rules.js'
import {freshRackState,snapshotOf,applySnapshot} from '../src/game-state.js'
import {isGameMessage} from '../src/protocol.js'
import {chooseShot,legalTargets,simulateFirstHit,bestShot} from '../src/ai.js'
import {R} from '../src/table.js'

const ball=(n,x=300,y=190,on=true)=>({n,x,y,on,k:n===0?'cue':n===8?'eight':n<8?'solid':'stripe',vx:0,vy:0,wx:0,wy:0,wz:0})
// a finished shot, as the simulation would hand it to the judge
const shot=o=>({mode:'9ball',turn:'a',potted:[],scratch:false,firstHit:ball(1),lowest:1,railHit:false,...o})

test('a nine-ball rack is the cue plus balls 1-9, in a diamond, with the 1 at the apex and the 9 in the middle',()=>{
 const r=rack('9ball')
 assert.equal(r.length,10)
 assert.deepEqual(r.map(b=>b.n).sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8,9])
 assert.equal(r[0].k,'cue')
 assert.equal(r[1].n,1,'index 1 is the apex ball, so the opening aim still points at the rack')
 assert.equal(r[1].x,420);assert.equal(r[1].y,190)
 const nine=r.find(b=>b.n===9)
 assert.ok(Math.abs(nine.x-(420+2*R*Math.sqrt(3)))<1e-9,'the 9 sits in the middle column')
 assert.equal(nine.y,190)
 const columns=[...new Set(r.slice(1).map(b=>Math.round(b.x)))]
 assert.equal(columns.length,5,'five columns')
})

test('no two balls in a nine-ball rack overlap, and every ball is on the table',()=>{
 for(let g=0;g<50;g++){
  const r=rack('9ball')
  for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++)
   assert.ok(Math.hypot(r[i].x-r[j].x,r[i].y-r[j].y)>=2*R-1e-6,`balls ${r[i].n} and ${r[j].n} overlap`)
 }
})

test('the other seven balls are shuffled between racks',()=>{
 const layouts=new Set()
 for(let g=0;g<30;g++)layouts.add(rack('9ball').map(b=>b.n).join())
 assert.ok(layouts.size>10,'the rack should not be the same every time')
})

test('the eight-ball rack is unchanged, and an unknown mode falls back to it',()=>{
 assert.equal(rack().length,16)
 assert.equal(rack('8ball').length,16)
 assert.equal(rack('nonsense').length,16)
 assert.equal(modeOf('9ball'),'9ball');assert.equal(modeOf(undefined),'8ball')
 assert.equal(MODES['9ball'].balls,10)
})

test('the lowest ball is the lowest number still on the table',()=>{
 const balls=[ball(0),ball(3),ball(5),ball(1,0,0,false),ball(9)]
 assert.equal(lowestBall(balls),3,'the 1 is off the table, so the 3 is next')
 assert.equal(lowestBall([ball(0),ball(9)]),9)
 assert.equal(lowestBall([ball(0)]),null)
})

test('hitting the lowest ball first and potting it keeps the turn',()=>{
 const v=judgeNineBall(shot({potted:[ball(1)]}))
 assert.equal(v.foul,false);assert.equal(v.nextTurn,'a');assert.equal(v.winner,null)
})

test('potting any ball, not just the lowest, keeps the turn once the lowest was hit first',()=>{
 const v=judgeNineBall(shot({potted:[ball(5)]}))
 assert.equal(v.foul,false);assert.equal(v.nextTurn,'a')
})

test('hitting a legal ball and pocketing nothing passes the turn, without a foul',()=>{
 const v=judgeNineBall(shot({railHit:true}))
 assert.equal(v.foul,false);assert.equal(v.nextTurn,'b')
})

test('hitting anything but the lowest ball first is a foul, even if a ball drops',()=>{
 const v=judgeNineBall(shot({firstHit:ball(4),potted:[ball(4)]}))
 assert.equal(v.foul,true);assert.equal(v.reason,'wrong-first');assert.equal(v.nextTurn,'b')
})

test('touching no ball at all is a foul',()=>{
 const v=judgeNineBall(shot({firstHit:null}))
 assert.equal(v.foul,true);assert.equal(v.reason,'no-contact')
})

test('a legal hit that neither pockets a ball nor reaches a cushion is a foul',()=>{
 const v=judgeNineBall(shot({railHit:false,potted:[]}))
 assert.equal(v.foul,true);assert.equal(v.reason,'no-rail');assert.equal(v.nextTurn,'b')
})

test('a pocketed ball satisfies the cushion rule on its own',()=>{
 assert.equal(judgeNineBall(shot({railHit:false,potted:[ball(2)]})).foul,false)
})

test('scratching is a foul and outranks every other outcome',()=>{
 const v=judgeNineBall(shot({scratch:true,potted:[ball(1)]}))
 assert.equal(v.foul,true);assert.equal(v.reason,'scratch');assert.equal(v.nextTurn,'b')
})

test('the 9 on a legal shot wins the rack, whether hit directly or off a combination',()=>{
 const direct=judgeNineBall(shot({lowest:9,firstHit:ball(9),potted:[ball(9)]}))
 assert.equal(direct.winner,'a')
 const combo=judgeNineBall(shot({firstHit:ball(1),potted:[ball(9)]}))
 assert.equal(combo.winner,'a','pocketing the 9 with the 1 as first contact is the classic combination win')
})

test('the 9 on the break wins when the break is legal',()=>{
 const v=judgeNineBall(shot({breakShot:true,potted:[ball(9),ball(3)],railHit:true}))
 assert.equal(v.winner,'a')
})

test('the 9 pocketed on a foul does not win, and is put back',()=>{
 for(const bad of [{scratch:true},{firstHit:ball(3)},{firstHit:null}]){
  const v=judgeNineBall(shot({potted:[ball(9)],...bad}))
  assert.equal(v.winner,null,JSON.stringify(bad))
  assert.equal(v.foul,true)
  assert.equal(v.respotNine,true,'the 9 must come back onto the table')
 }
})

test('a foul with no 9 involved does not ask for a respot',()=>{
 assert.equal(judgeNineBall(shot({scratch:true,potted:[ball(2)]})).respotNine,false)
})

test('the shooter is whoever is at the table, so player b can win too',()=>{
 assert.equal(judgeNineBall(shot({turn:'b',firstHit:ball(1),potted:[ball(9)]})).winner,'b')
 assert.equal(judgeNineBall(shot({turn:'b',railHit:true})).nextTurn,'a')
})

test('judgeShot hands nine-ball to the nine-ball judge, and leaves eight-ball alone',()=>{
 assert.equal(judgeShot(shot({potted:[ball(9)]})).winner,'a')
 const eight=judgeShot({mode:'8ball',turn:'a',groups:{a:'solid',b:'stripe'},potted:[ball(2)],scratch:false,firstHit:ball(2),before:3,breakShot:false})
 assert.equal(eight.nextTurn,'a')
 const legacy=judgeShot({turn:'a',groups:{a:'solid',b:'stripe'},potted:[ball(2)],scratch:false,firstHit:ball(2),before:3,breakShot:false})
 assert.equal(legacy.nextTurn,'a','state with no mode at all is eight-ball')
})

test('a re-spotted 9 lands on the foot spot when it is free',()=>{
 assert.deepEqual(nineRespot([ball(0),ball(2,100,100)]),{x:420,y:190})
})

test('a re-spotted 9 is placed behind the foot spot when a ball is sitting on it, and never inside a ball',()=>{
 const balls=[ball(0),ball(1,420,190),ball(2,420+R,190),ball(3,420+2*R,190)]
 const p=nineRespot(balls)
 assert.equal(p.y,190);assert.ok(p.x>420)
 for(const b of balls)assert.ok(Math.hypot(b.x-p.x,b.y-p.y)>=2*R-1e-6,'respot overlaps ball '+b.n)
})

// ---- state and wire format ----

test('a nine-ball snapshot round-trips its mode and its ten balls',()=>{
 const source={...freshRackState('9ball'),round:1}
 assert.equal(source.mode,'9ball');assert.equal(source.balls.length,10)
 const s=snapshotOf(source)
 assert.equal(s.mode,'9ball');assert.equal(s.b.length,10)
 assert.equal(isGameMessage(s),true)
 const target={};applySnapshot(target,s)
 assert.equal(target.mode,'9ball');assert.equal(target.balls.length,10)
})

test('a snapshot with no mode is an eight-ball snapshot',()=>{
 const s=snapshotOf({...freshRackState(),round:1})
 delete s.mode
 assert.equal(isGameMessage(s),true)
 const target={};applySnapshot(target,s)
 assert.equal(target.mode,'8ball');assert.equal(target.balls.length,16)
})

test('the validator rejects a rack whose size does not match its mode',()=>{
 const nine=snapshotOf({...freshRackState('9ball'),round:1})
 assert.equal(isGameMessage({...nine,mode:'8ball'}),false,'ten balls cannot be an eight-ball rack')
 const eight=snapshotOf({...freshRackState(),round:1})
 assert.equal(isGameMessage({...eight,mode:'9ball'}),false,'sixteen balls cannot be a nine-ball rack')
 assert.equal(isGameMessage({...nine,mode:'10ball'}),false,'an unknown mode is rejected')
})

test('a nine-ball rack cannot smuggle in a ball above 9',()=>{
 const nine=snapshotOf({...freshRackState('9ball'),round:1})
 const bad={...nine,b:nine.b.map((b,i)=>i===9?[b[0],b[1],b[2],'stripe',12,...b.slice(5)]:b)}
 assert.equal(isGameMessage(bad),false)
})

// ---- the opponent ----

test('in nine-ball the only legal target is the lowest ball, whatever else is on the table',()=>{
 const balls=[ball(0,100,190),ball(4,300,100),ball(2,300,300),ball(9,500,190)]
 assert.deepEqual(legalTargets(balls,null,'9ball').map(b=>b.n),[2])
 assert.ok(legalTargets(balls,null,'8ball').length>1,'eight-ball still allows several')
})

test('the AI breaks by hitting the 1, and never names a pocket in nine-ball',()=>{
 for(let g=0;g<20;g++){
  const balls=rack('9ball')
  const plan=chooseShot(balls,null,false,'league','9ball')
  assert.ok(plan,'the AI should always play something')
  assert.equal(plan.pocket,null,'nine-ball has no called pockets')
  const hit=simulateFirstHit(balls,plan.angle,plan.power)
  assert.equal(hit?.n,1,'the break has to hit the 1 first')
 }
})

test('the AI makes a legal first contact from scattered positions almost every time',()=>{
 let legal=0,total=0
 for(let g=0;g<150;g++){
  const r=rack('9ball')
  // scatter the object balls around the table
  const placed=[r[0]]
  for(const b of r.slice(1)){
   for(let tries=0;tries<200;tries++){
    b.x=60+Math.random()*580;b.y=60+Math.random()*260
    if(placed.every(p=>Math.hypot(p.x-b.x,p.y-b.y)>2*R+1)){placed.push(b);break}
   }
  }
  if(placed.length!==r.length)continue
  const low=lowestBall(r)
  const plan=chooseShot(r,null,false,'league','9ball')
  if(!plan)continue
  total++
  if(simulateFirstHit(r,plan.angle,plan.power)?.n===low)legal++
 }
 assert.ok(total>100,'the test needs enough usable layouts')
 assert.ok(legal/total>=.9,`only ${legal}/${total} first contacts were the lowest ball`)
})

test('with ball in hand in nine-ball the AI places the cue ball and still targets the lowest',()=>{
 const balls=[ball(0,154,190),ball(3,500,120),ball(6,300,300),ball(9,450,250)]
 const plan=chooseShot(balls,null,true,'league','9ball')
 assert.ok(plan.place)
 assert.ok(bestShot(balls,null,'9ball')===null||bestShot(balls,null,'9ball').target.n===3)
})

// ---- the opponent checks its own shot ----

import {rollout,fouls} from '../src/ai.js'

const mk=(n,x,y)=>({id:n,...ball(n,x,y)})

test('the layout that made the AI scratch on every attempt now plays a legal shot, from either placement',()=>{
 // The 2 sits beside the bottom-middle pocket. The best-looking pot is a straight
 // one from behind, from where the cue ball followed it in, every time: thirty
 // scratches in a row in self-play.
 const layout=()=>[mk(0,154,190),mk(8,416,86),mk(5,149,296),mk(3,353,284),mk(9,338,327),mk(6,223,268),mk(2,319,337),mk(7,128,185),mk(4,41,293)]
 for(const inHand of [true,false]){
  let legal=0
  for(let i=0;i<100;i++){
   const balls=layout()
   const plan=chooseShot(balls,null,inHand,'league','9ball')
   if(plan.place){balls[0].x=plan.place.x;balls[0].y=plan.place.y}
   const r=rollout(balls,plan.angle,plan.power)
   if(!r.scratch&&r.firstHit?.n===2&&(r.potted.length||r.railHit))legal++
  }
  assert.ok(legal>=95,`ball in hand ${inHand}: only ${legal}/100 shots were legal`)
 }
})

test('in a tight cluster with ball in hand the AI finds a legal shot far more often than it fouls',()=>{
 let legal=0,total=0
 for(let g=0;g<300;g++){
  const r=rack('9ball');const placed=[r[0]];r[0].x=100;r[0].y=190
  const cx=380+Math.random()*100,cy=120+Math.random()*140
  for(const b of r.slice(1)){for(let t=0;t<400;t++){b.x=cx+(Math.random()-.5)*100;b.y=cy+(Math.random()-.5)*100;if(placed.every(p=>Math.hypot(p.x-b.x,p.y-b.y)>2*R+.2)){placed.push(b);break}}}
  if(placed.length!==r.length)continue
  const plan=chooseShot(r,null,true,'league','9ball')
  if(plan.place){r[0].x=plan.place.x;r[0].y=plan.place.y}
  total++
  const out=rollout(r,plan.angle,plan.power)
  if(!out.scratch&&out.firstHit?.n===lowestBall(r)&&(out.potted.length||out.railHit))legal++
 }
 assert.ok(total>200)
 assert.ok(legal/total>=.8,`only ${legal}/${total} were legal`)   // about 0.5 before the AI checked its own shot
})

test('fouls() names a scratch, a wrong first contact, and a missed cushion',()=>{
 // find a shot that really does scratch, rather than assume one
 const near=[mk(0,154,190),mk(8,416,86),mk(5,149,296),mk(3,353,284),mk(9,338,327),mk(6,223,268),mk(2,319,337),mk(7,128,185),mk(4,41,293)]
 let scratching=null
 for(let deg=0;deg<360&&!scratching;deg+=5)for(const power of [30,60,90])
  if(rollout(near,deg*Math.PI/180,power).scratch){scratching={angle:deg*Math.PI/180,power};break}
 assert.ok(scratching,'the search should find at least one scratching shot on this table')
 assert.equal(fouls(near,scratching,null,'9ball'),true,'a shot that scratches is a foul')
 const wrong=[mk(0,200,190),mk(1,500,60),mk(5,330,190)]
 assert.equal(fouls(wrong,{angle:0,power:50},null,'9ball'),true,'hits the 5 with the 1 still up')
 const dead=[mk(0,300,190),mk(1,340,190),mk(9,560,80)]
 assert.equal(fouls(dead,{angle:0,power:5},null,'9ball'),true,'never reaches a cushion')
 const fine=[mk(0,200,190),mk(1,450,190),mk(9,560,80)]
 assert.equal(fouls(fine,{angle:0,power:55},null,'9ball'),false)
})

test('in eight-ball fouls() also catches pocketing the 8 before the group is cleared',()=>{
 // cue -> 8 -> pocket, while a solid is still on the table
 const layout=[mk(0,350,300),mk(8,350,120),mk(3,560,80)]
 assert.equal(fouls(layout,{angle:-Math.PI/2,power:70},'solid','8ball'),true)
})
