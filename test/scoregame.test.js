import test from 'node:test';import assert from 'node:assert/strict'
import {judgeShot,judgeScoreGame,rack,MODES,modeOf,isScoreMode,ONE_POCKET,SCORE_TARGET} from '../src/rules.js'

const ball=(n,on=true)=>({n,on,k:n===0?'cue':n===8?'eight':n<8?'solid':'stripe'})
const table=(...on)=>[ball(0),...[...Array(15)].map((_,i)=>ball(i+1,on.includes(i+1)))]
const shot=o=>({mode:'bank',turn:'a',score:{a:0,b:0},potted:[],pockets:{},railBalls:[],scratch:false,firstHit:{n:3},balls:table(1,2,3,4,5),...o})

test('the two modes exist, are scored games, and have a full rack',()=>{
 for(const m of ['bank','onepocket']){
  assert.equal(modeOf(m),m);assert.ok(isScoreMode(m));assert.equal(MODES[m].balls,16)
  const r=rack(m);assert.equal(r.length,16);assert.equal(new Set(r.map(b=>b.n)).size,16)
 }
 assert.ok(!isScoreMode('8ball')&&!isScoreMode('9ball'))
 assert.equal(modeOf('nonsense'),'8ball')
})

test('judgeShot hands both modes to the scored-game rules',()=>{
 assert.deepEqual(judgeShot(shot({potted:[ball(3)],railBalls:[3]})),judgeScoreGame(shot({potted:[ball(3)],railBalls:[3]})))
})

test('bank pool: a ball that touched a cushion scores and keeps the turn',()=>{
 const v=judgeScoreGame(shot({potted:[ball(3)],railBalls:[3]}))
 assert.deepEqual(v.score,{a:1,b:0});assert.equal(v.nextTurn,'a');assert.equal(v.foul,false)
 assert.deepEqual(v.credited,[{n:3,to:'a',points:1}])
})

test('bank pool: a ball that dropped without a bank scores nothing and ends the turn',()=>{
 const v=judgeScoreGame(shot({potted:[ball(3)],railBalls:[]}))
 assert.deepEqual(v.score,{a:0,b:0});assert.equal(v.nextTurn,'b');assert.deepEqual(v.wasted,[3])
 assert.equal(v.foul,false,'a straight pot is not a foul, it just is not a point')
})

test('bank pool: a mix scores what was banked and keeps the turn',()=>{
 const v=judgeScoreGame(shot({potted:[ball(3),ball(4)],railBalls:[4]}))
 assert.deepEqual(v.score,{a:1,b:0});assert.equal(v.nextTurn,'a');assert.deepEqual(v.wasted,[3])
})

test('a scratch or hitting nothing is a foul: no score whatever dropped, and the turn passes',()=>{
 for(const o of [{scratch:true},{firstHit:null}]){
  const v=judgeScoreGame(shot({potted:[ball(3)],railBalls:[3],...o}))
  assert.equal(v.foul,true);assert.deepEqual(v.score,{a:0,b:0});assert.equal(v.nextTurn,'b');assert.deepEqual(v.wasted,[3])
 }
 assert.equal(judgeScoreGame(shot({scratch:true})).reason,'scratch')
 assert.equal(judgeScoreGame(shot({firstHit:null})).reason,'no-contact')
})

test('a miss with nothing dropped passes the turn without a foul',()=>{
 const v=judgeScoreGame(shot());assert.equal(v.foul,false);assert.equal(v.nextTurn,'b')
})

test('one-pocket: a ball in your own pocket scores, in the opponent\'s pocket scores for them, elsewhere for nobody',()=>{
 const own=judgeScoreGame(shot({mode:'onepocket',potted:[ball(3)],pockets:{3:ONE_POCKET.a}}))
 assert.deepEqual(own.score,{a:1,b:0});assert.equal(own.nextTurn,'a')
 const theirs=judgeScoreGame(shot({mode:'onepocket',potted:[ball(3)],pockets:{3:ONE_POCKET.b}}))
 assert.deepEqual(theirs.score,{a:0,b:1});assert.equal(theirs.nextTurn,'b','helping the opponent ends your turn')
 const stray=judgeScoreGame(shot({mode:'onepocket',potted:[ball(3)],pockets:{3:0}}))
 assert.deepEqual(stray.score,{a:0,b:0});assert.equal(stray.nextTurn,'b');assert.deepEqual(stray.wasted,[3])
})

test('one-pocket: scoring for yourself and for them on one shot keeps your turn',()=>{
 const v=judgeScoreGame(shot({mode:'onepocket',potted:[ball(3),ball(4)],pockets:{3:ONE_POCKET.a,4:ONE_POCKET.b}}))
 assert.deepEqual(v.score,{a:1,b:1});assert.equal(v.nextTurn,'a')
})

test('the pockets belong to the players, whoever is shooting',()=>{
 const v=judgeScoreGame(shot({turn:'b',mode:'onepocket',potted:[ball(3)],pockets:{3:ONE_POCKET.b}}))
 assert.deepEqual(v.score,{a:0,b:1});assert.equal(v.nextTurn,'b')
 assert.notEqual(ONE_POCKET.a,ONE_POCKET.b)
})

test('first to eight wins, on the shot that gets there',()=>{
 const v=judgeScoreGame(shot({score:{a:SCORE_TARGET-1,b:3},potted:[ball(3)],railBalls:[3]}))
 assert.equal(v.winner,'a')
 assert.equal(judgeScoreGame(shot({score:{a:SCORE_TARGET-1,b:3}})).winner,null)
 // one-pocket: the opponent can be carried over the line by the shooter's mistake
 const gift=judgeScoreGame(shot({mode:'onepocket',score:{a:2,b:SCORE_TARGET-1},potted:[ball(3)],pockets:{3:ONE_POCKET.b}}))
 assert.equal(gift.winner,'b')
})

test('when the balls run out, more points win, and a tie goes to the player who was not shooting',()=>{
 const empty=table()
 assert.equal(judgeScoreGame(shot({balls:empty,score:{a:4,b:2}})).winner,'a')
 assert.equal(judgeScoreGame(shot({balls:empty,score:{a:2,b:4}})).winner,'b')
 assert.equal(judgeScoreGame(shot({balls:empty,score:{a:3,b:3}})).winner,'b')
 assert.equal(judgeScoreGame(shot({balls:empty,turn:'b',score:{a:3,b:3}})).winner,'a')
})

test('the rules never change what they were given',()=>{
 const s=shot({potted:[ball(3)],railBalls:new Set([3])}),copy=JSON.stringify({...s,railBalls:[...s.railBalls]})
 judgeScoreGame(s);assert.equal(JSON.stringify({...s,railBalls:[...s.railBalls]}),copy)
})

test('a game object, which keeps its pockets as pocketOf, is judged the same as a bare shot',()=>{
 const asGame={...shot({mode:'onepocket',potted:[ball(3)]}),pocketOf:{3:ONE_POCKET.a}}
 delete asGame.pockets
 assert.deepEqual(judgeScoreGame(asGame).score,{a:1,b:0})
})
