import test from 'node:test';import assert from 'node:assert/strict'
import {normalizeHouse,isDefault,describe,nextBreaker,placementLimit,DEFAULT_HOUSE,RACES,BALL_IN_HAND,BREAKERS,STRAIGHT_TARGETS,HEAD_STRING} from '../src/house.js'
import {PoolGame} from '../src/pool.js'
import {strike} from '../src/physics.js'
import {rack,validCueSpot,judgeScoreGame,targetFor} from '../src/rules.js'
import {bestCueSpot,chooseShot} from '../src/ai.js'
import {R,MINX} from '../src/table.js'

test('the defaults are the standard rules, and anything else is not',()=>{
 assert.deepEqual(DEFAULT_HOUSE,{race:3,ballInHand:'anywhere',breaker:'host',straightTo:30,jumps:false})
 assert.equal(isDefault(DEFAULT_HOUSE),true);assert.equal(isDefault(undefined),true);assert.equal(isDefault({}),true)
 for(const k of Object.keys(DEFAULT_HOUSE)){
  const other={...DEFAULT_HOUSE,[k]:k==='race'?5:k==='ballInHand'?'kitchen':k==='breaker'?'alternate':k==='jumps'?true:50}
  assert.equal(isDefault(other),false,k)
 }
 assert.equal(describe(DEFAULT_HOUSE),'')
 assert.match(describe({race:5,ballInHand:'kitchen',breaker:'winner',straightTo:100,jumps:true}),/race to 5 · ball in hand behind the head string · the winner breaks · straight pool to 100 · jump shots allowed/)
})

test('rules from storage or from another player are validated, and junk falls back to the default',()=>{
 for(const junk of [null,undefined,42,'x',[],{race:99,ballInHand:'lava',breaker:'never',straightTo:7},{race:'3'},{race:3.5}]){
  const n=normalizeHouse(junk);assert.deepEqual(n,DEFAULT_HOUSE,JSON.stringify(junk))
 }
 assert.deepEqual(normalizeHouse({race:5,ballInHand:'none',breaker:'loser',straightTo:15,jumps:true,extra:'x'}),{race:5,ballInHand:'none',breaker:'loser',straightTo:15,jumps:true})
 for(const junk of ['true',1,'yes',null,{}])assert.equal(normalizeHouse({jumps:junk}).jumps,false,`jumps: ${JSON.stringify(junk)}`)
 // every offered choice is one that validates
 for(const r of RACES)assert.equal(normalizeHouse({race:r}).race,r)
 for(const b of BALL_IN_HAND)assert.equal(normalizeHouse({ballInHand:b}).ballInHand,b)
 for(const b of BREAKERS)assert.equal(normalizeHouse({breaker:b}).breaker,b)
 for(const t of STRAIGHT_TARGETS)assert.equal(normalizeHouse({straightTo:t}).straightTo,t)
})

test('who breaks the next rack, by each rule',()=>{
 assert.equal(nextBreaker({breaker:'host'},{breaker:'b',winner:'b'}),'a')
 assert.equal(nextBreaker({breaker:'alternate'},{breaker:'a',winner:'a'}),'b')
 assert.equal(nextBreaker({breaker:'alternate'},{breaker:'b',winner:'a'}),'a')
 assert.equal(nextBreaker({breaker:'alternate'},undefined),'a','the first rack is the host\'s')
 assert.equal(nextBreaker({breaker:'winner'},{breaker:'a',winner:'b'}),'b')
 assert.equal(nextBreaker({breaker:'loser'},{breaker:'a',winner:'b'}),'a')
 assert.equal(nextBreaker({breaker:'loser'},{breaker:'a',winner:'a'}),'b')
 assert.equal(nextBreaker({breaker:'winner'},{breaker:'a',winner:''}),'a','no winner recorded: the host')
})

test('behind the head string only applies to the kitchen rule',()=>{
 assert.equal(placementLimit({ballInHand:'kitchen'}),HEAD_STRING)
 assert.equal(placementLimit({ballInHand:'anywhere'}),null);assert.equal(placementLimit({ballInHand:'none'}),null);assert.equal(placementLimit(undefined),null)
 const balls=rack('8ball')
 assert.equal(validCueSpot(balls,{x:300,y:190}),true)
 assert.equal(validCueSpot(balls,{x:300,y:190},HEAD_STRING),false,'past the string')
 assert.equal(validCueSpot(balls,{x:120,y:100},HEAD_STRING),true)
 assert.equal(validCueSpot(balls,{x:MINX-1,y:190},HEAD_STRING),false,'still on the table')
})

// ---- the game, by its house rules ----
function game(house,extra={}){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{mode:'8ball',turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:true,hotSeat:true,names:{a:'A',b:'B'},
  ready:true,shots:{a:0,b:0},acc:0,flash(){},setSpin(){},balls:rack('8ball'),me:'a',host:true,send(){},onSave(){},onFinish(){},onShot(){},
  score:{a:0,b:0},breaker:'a',house:normalizeHouse(house),...extra})
 g.sync();return g
}
function miss(g){                       // the cue ball goes up the table and hits nothing: a foul
 g.startShot();strike(g.balls[0],0,-900)
 let now=g.clock||0
 for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 g.clock=now
}

test('after a foul: anywhere puts the cue ball in hand on the head spot, as ever',()=>{
 const g=game({});miss(g)
 assert.equal(g.ballInHand,true);assert.equal(g.turn,'b')
 assert.equal(g.validCueSpot({x:500,y:100}),true)
})

test('after a foul: kitchen puts it in hand, but only behind the head string',()=>{
 const g=game({ballInHand:'kitchen'});miss(g)
 assert.equal(g.ballInHand,true)
 assert.equal(g.validCueSpot({x:500,y:100}),false);assert.equal(g.validCueSpot({x:100,y:100}),true)
 g.ballInHand=false
 assert.equal(g.validCueSpot({x:500,y:100}),true,'an ordinary shot is not restricted')
})

test('after a foul: none leaves the cue ball where it stopped, and nobody gets it in hand',()=>{
 const g=game({ballInHand:'none'});miss(g)
 assert.equal(g.ballInHand,false);assert.equal(g.turn,'b')
 const cue=g.balls[0];assert.equal(cue.on,true)
 assert.ok(Math.hypot(cue.x-154,cue.y-190)>5,'it is where it stopped after rolling, not put back on the head spot')
})

test('after a scratch under none, the potted cue ball goes back on the head spot, clear of other balls',()=>{
 const g=game({ballInHand:'none'})
 g.balls[0].on=false;g.balls[3].x=154;g.balls[3].y=190;g.balls[3].on=true   // a ball is sitting on the head spot
 g.firstHit=null;g.foul('scratch')
 const cue=g.balls[0];assert.equal(cue.on,true);assert.equal(g.ballInHand,false)
 assert.ok(g.balls.every((b,i)=>i===0||!b.on||Math.hypot(b.x-cue.x,b.y-cue.y)>=2*R),'not inside another ball')
})

test('the words of a foul match the rule',()=>{
 const said=[];const g=game({ballInHand:'kitchen'},{flash:m=>said.push(m)});g.firstHit=null;g.foul('no-contact')
 assert.match(said[0],/behind the head string/)
 const n=[];const h=game({ballInHand:'none'},{flash:m=>n.push(m)});h.firstHit=null;h.foul('scratch')
 assert.doesNotMatch(n[0],/ball in hand/i)
})

test('who breaks the next rack follows the rule, and the AI breaks when it is the AI\'s turn',async()=>{
 const g=game({breaker:'alternate'},{hotSeat:false,aiShot(){g.aiBroke=true}})
 g.over=true;g.result='a';g.newRack();assert.equal(g.turn,'b');assert.equal(g.breaker,'b')
 await new Promise(r=>setTimeout(r,800));assert.equal(g.aiBroke,true,'the AI takes the break')
 g.over=true;g.result='b';g.newRack();assert.equal(g.turn,'a','alternates back')
 const w=game({breaker:'winner'});w.over=true;w.result='b';w.newRack();assert.equal(w.turn,'b')
 const l=game({breaker:'loser'});l.over=true;l.result='b';l.newRack();assert.equal(l.turn,'a')
 const s=game({});s.over=true;s.result='b';s.newRack();assert.equal(s.turn,'a','standard: the host')
})

test('straight pool is played to the score the house chose',()=>{
 const target=hh=>{const x=game(hh,{mode:'straight'});x.scoreTarget=normalizeHouse(hh).straightTo;return x.scoreTarget}
 assert.equal(target({straightTo:50}),50);assert.equal(target({}),30)
 const base={mode:'straight',turn:'a',potted:[{n:3}],pockets:{3:0},railBalls:[],scratch:false,firstHit:{n:3},balls:[{n:0,k:'cue',on:true},{n:5,k:'solid',on:true},{n:6,k:'solid',on:true}]}
 assert.equal(judgeScoreGame({...base,score:{a:29,b:0}}).winner,'a')
 assert.equal(judgeScoreGame({...base,score:{a:29,b:0},scoreTarget:50}).winner,null,'29 does not win to 50')
 assert.equal(judgeScoreGame({...base,score:{a:49,b:0},scoreTarget:50}).winner,'a')
 assert.equal(targetFor('straight'),30)
})

test('the AI places the cue ball behind the head string when the rule says so',()=>{
 const balls=rack('8ball');balls[0].x=154;balls[0].y=190
 for(let i=0;i<5;i++){
  const spot=bestCueSpot(balls.map(b=>({...b})),null,'8ball',{player:'b',limitX:HEAD_STRING})
  assert.ok(spot.x<=HEAD_STRING,`the AI put the cue ball at x ${spot.x}`)
 }
 const plan=chooseShot(balls.map(b=>({...b})),null,true,'league','8ball',{player:'b',limitX:HEAD_STRING})
 assert.ok(!plan.place||plan.place.x<=HEAD_STRING)
})
