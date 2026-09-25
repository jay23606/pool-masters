import test from 'node:test';import assert from 'node:assert/strict'
import {PoolGame} from '../src/pool.js'
import {strike} from '../src/physics.js'
import {rack} from '../src/rules.js'

// A host game with nothing around it: no DOM, no network. hotSeat games are hosts.
function game(extra={}){
 const g=Object.create(PoolGame.prototype)
 Object.assign(g,{mode:'8ball',turn:'a',phase:'aim',over:false,result:'',finished:false,round:1,groups:{a:null,b:null},
  assignment:null,breakShot:false,calledPocket:null,ballInHand:false,placed:false,practice:true,ready:true,
  shots:{a:0,b:0},acc:0,flash(){},setSpin(){},balls:rack('8ball'),me:'a',host:true,send(){},onSave(){},onFinish(){},onShot(){},
  hotSeat:true,names:{a:'Ann',b:'Bo'},...extra})
 return g
}
function miss(g){                       // the cue ball goes up the table and hits nothing: a foul
 g.startShot();strike(g.balls[0],0,-900)
 let now=g.clock||0
 for(let i=0;i<9000&&g.phase==='roll';i++){now+=1000/120;g.advance(now)}
 g.clock=now
}

test('whoever is to shoot is "me", so every control follows the turn',()=>{
 const g=game();g.sync()
 assert.equal(g.me,'a')
 g.turn='b';g.sync();assert.equal(g.me,'b')
 g.turn='a';g.sync();assert.equal(g.me,'a')
})

test('a change of turn announces whose it is, but not the first look and not a finished rack',()=>{
 const said=[],g=game({onTurn:n=>said.push(n)})
 g.sync();assert.deepEqual(said,[],'nothing to announce before anyone has played')
 g.turn='b';g.sync();g.sync();assert.deepEqual(said,['Bo'],'once, however often it syncs')
 g.turn='a';g.sync();assert.deepEqual(said,['Bo','Ann'])
 g.over=true;g.turn='b';g.sync();assert.deepEqual(said,['Bo','Ann'],'a finished rack has no next shooter')
})

test('a game that is not hot-seat is untouched by all of it',()=>{
 const said=[],g=game({hotSeat:false,me:'a',onTurn:n=>said.push(n)})
 g.turn='b';g.sync();assert.equal(g.me,'a');assert.deepEqual(said,[])
 assert.equal(g.tag('a','YOU'),'YOU')
})

test('names are the players\' own, with sensible defaults, and read in the third person',()=>{
 const g=game()
 assert.equal(g.nameOf('a'),'Ann');assert.equal(game({names:undefined}).nameOf('b'),'Player 2')
 assert.equal(g.tag('b','THEM'),'BO')
 g.turn='b'
 assert.equal(g.hotStatus('Solids · your shot'),'Solids · Bo’s shot')
 assert.equal(g.hotStatus('Ball in hand · tap table to place cue'),'Ball in hand · tap table to place cue')
 g.over=true;g.result='a';assert.equal(g.hotStatus('anything'),'Ann won the rack')
})

test('the HUD names the players instead of you and them',()=>{
 const g=game();g.groups={a:'solid',b:'stripe'};g.turn='b';g.sync()
 const bar={textContent:'',className:''},st={textContent:''}
 Object.assign(g,{groupStatus:bar,status:st,shoot:{disabled:false},power:{value:45},aiming:false,canControl:()=>true,changePocket:null,moveCue:null,spinPad:null})
 try{g.updateHud()}catch(e){/* the HUD touches parts of a real game this one does not have */}
 assert.match(bar.textContent,/^BO: STRIPES · \d+ left {2}\| {2}ANN: SOLIDS · \d+ left$/)
 assert.match(st.textContent,/Bo’s shot/)
})

test('a foul passes the shot to the other person, and no AI ever answers for them',async()=>{
 let ai=0
 const g=game({aiShot(){ai++}});g.sync()
 miss(g)
 assert.equal(g.turn,'b');assert.equal(g.me,'b');assert.equal(g.ballInHand,true,'the other person gets ball in hand')
 await new Promise(r=>setTimeout(r,900))
 assert.equal(ai,0,'the AI must not shoot for a human')
})

test('the same foul in a practice game against the AI does bring the AI in',async()=>{
 let ai=0
 const g=game({hotSeat:false,aiShot(){ai++}});g.sync()
 miss(g)
 assert.equal(g.turn,'b')
 await new Promise(r=>setTimeout(r,900))
 assert.equal(ai,1)
})
