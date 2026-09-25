import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {rack} from '../src/rules.js'
import {createRecorder} from '../src/replay.js'
import {aimFor} from '../src/ai.js'
import {POCKETS} from '../src/table.js'

// A host and a guest joined by their real send/receive in BOTH directions, as in a room.
function pair(){
 const common={mode:'8ball',turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:false,ready:true,
  shots:{a:0,b:0},acc:0,flash(){},setSpin(){},score:{a:0,b:0},breaker:'a'}
 const balls=rack('8ball')
 const host=Object.create(PoolGame.prototype),guest=Object.create(PoolGame.prototype)
 const fin={host:[],guest:[]}
 Object.assign(host,common,{balls,me:'a',host:true,send:m=>guest.receive(m),onSave(){},onFinish:r=>fin.host.push(r),onShot(){},onRack(){},
  power:{value:50},spin:{a:0,b:0}})
 Object.assign(guest,common,{balls:balls.map(b=>({...b})),me:'b',host:false,send:m=>host.receive(m),onFinish:r=>fin.guest.push(r),onShot(){},onRack(){},
  predictor:null,predicted:null,power:{value:50},spin:{a:0,b:0},aiming:false,angle:0,pointerAngle:0})
 host.groups={a:null,b:null};guest.groups={a:null,b:null}
 host.sync()
 return {host,guest,fin}
}
// the guest to shoot, with only the 8 left of their group, the 8 lined up on the top-middle pocket
function eightOn(){
 const p=pair(),{host}=p
 host.groups={a:'stripe',b:'solid'};host.turn='b'
 host.balls.forEach(b=>{if(b.n!==0&&b.n!==8&&b.n!==9)b.on=false})
 const cue=host.balls[0],eight=host.balls.find(b=>b.n===8),nine=host.balls.find(b=>b.n===9)
 cue.x=290;cue.y=300;eight.x=350;eight.y=150;nine.x=120;nine.y=90
 host.sync()
 // a cut shot, so the cue ball does not follow the 8 into the pocket
 const [px,py]=POCKETS[1],d=Math.hypot(px-eight.x,py-eight.y),aim=aimFor(cue,eight,(px-eight.x)/d,(py-eight.y)/d)
 p.angle=aim.angle
 return p
}
const run=(host,ms=6000)=>{let now=host.clock||0;for(let i=0;i<ms*120/1000&&host.phase==='roll';i++){now+=1000/120;host.advance(now)};host.clock=now}

test('control: a guest who calls the right pocket and pots the 8 wins, on both screens',()=>{
 const p=eightOn(),{host,guest,fin}=p
 assert.equal(guest.turn,'b');assert.equal(guest.canCallEight(),true)
 guest.calledPocket=1;guest.aiming=true;guest.angle=p.angle;guest.power.value=40
 guest.takeShot();run(host)
 assert.equal(host.over,true);assert.equal(host.result,'b','the host judged it a win for the guest')
 assert.deepEqual(fin.guest.map(r=>r.winner),['b']);assert.deepEqual(fin.host.map(r=>r.winner),['b'])
})

test('a snapshot that arrives while the guest is lining up must not wipe out the pocket they called',()=>{
 const p=eightOn(),{host,guest,fin}=p
 guest.calledPocket=1;guest.aiming=true;guest.angle=p.angle;guest.power.value=40
 // something makes the host send its state again while the guest is aiming: a spectator joining, a table setting
 host.sync()
 assert.equal(guest.calledPocket,1,'the call is the guest\'s own, not the host\'s empty one')
 guest.takeShot();run(host)
 assert.equal(host.result,'b','so the right pocket still wins the rack')
 assert.deepEqual(fin.guest.map(r=>r.winner),['b'])
})

test('a call is dropped only when calling is no longer allowed',()=>{
 const {host,guest}=eightOn()
 guest.calledPocket=1;host.sync();assert.equal(guest.calledPocket,1)
 // it is the other player's turn now: nothing of the guest's call should survive into it
 host.turn='a';host.sync();assert.equal(guest.calledPocket,null)
 // and a group with balls left cannot call the 8 at all
 host.turn='b';host.balls.find(b=>b.n===3).on=true;host.balls.find(b=>b.n===3).x=200;host.balls.find(b=>b.n===3).y=250;host.sync()
 guest.calledPocket=1;host.sync();assert.equal(guest.calledPocket,null,'three is still on the table')
})

test('a ball-in-hand placement survives a snapshot that arrives before the shot',()=>{
 const {host,guest}=pair()
 host.turn='b';host.ballInHand=true;host.sync()
 guest.pendingPlace=[300,120];guest.balls[0].x=300;guest.balls[0].y=120;guest.ballInHand=false;guest.placed=true
 host.sync()
 assert.deepEqual([guest.balls[0].x,guest.balls[0].y],[300,120],'the cue ball is still where the guest put it')
})

test('starting the next rack ends any replay of the last shot, so play can go on at once',()=>{
 const {host,guest}=pair()
 const rec=createRecorder('8ball',7);rec.frame(0,guest.balls);rec.frame(40,guest.balls);rec.frame(80,guest.balls)
 host.over=true;host.result='a';host.finished=true;host.sync()
 assert.equal(guest.over,true)
 guest.replay={rec:rec.finish(),speed:1,at:performance.now()}
 assert.equal(guest.canControl(),false,'replaying: no control')
 host.newRack()
 assert.equal(guest.round,2);assert.equal(guest.over,false)
 assert.equal(guest.replay,null,'the old rack\'s replay is gone with the old rack')
 guest.turn='b';assert.equal(guest.canControl(),true)
})

test('shooting at the 8 too early says why, in words that fit the table (never "null null")',()=>{
 const {host,guest}=pair()
 // an open table: nobody has a group yet
 host.turn='b';host.sync()
 assert.equal(guest.eightBlockedMessage(),'The 8 has to wait · pot a solid or a stripe first')
 // groups assigned, stripes still on the table
 host.groups={a:'solid',b:'stripe'};host.sync()
 const left=guest.balls.filter(b=>b.on&&b.k==='stripe').length
 assert.equal(guest.eightBlockedMessage(),`The 8 is not yours yet · ${left} stripes still to pot`)
 assert.doesNotMatch(guest.eightBlockedMessage(),/null/)
})

test('the render loop survives a frame that throws, and never leaves the replay balls in place',()=>{
 const real=globalThis.requestAnimationFrame;let scheduled=0
 globalThis.requestAnimationFrame=()=>{scheduled++}
 try{
  const {guest}=pair()
  const authoritative=guest.balls
  guest.drawnAt=performance.now();guest.replayBalls=()=>authoritative.map(b=>({...b,n:b.n}))
  guest.renderer={draw(){throw new Error('a renderer bug')}}
  guest.updateHud=()=>{};guest.sfx=null
  const warn=console.error;console.error=()=>{}
  try{guest.loop(performance.now())}finally{console.error=warn}
  assert.equal(scheduled,1,'the next frame was still requested')
  assert.equal(guest.balls,authoritative,'the real balls were put back')
 }finally{globalThis.requestAnimationFrame=real}
})

test('a spectator cannot ask for the next rack, and the players still can',()=>{
 const {host,guest}=pair()
 host.over=true;host.result='a';host.finished=true;host.sync()
 const sent=[];const watcher=Object.create(PoolGame.prototype)
 Object.assign(watcher,{...guest,spectator:true,send:m=>sent.push(m),over:true})
 watcher.requestRack();assert.deepEqual(sent,[],'nothing sent')
 // the guest, a player, still can
 guest.requestRack();assert.equal(host.round,2,'the next rack began')
})
