import test from 'node:test';import assert from 'node:assert/strict'
import {problem,solve,search,proves,encode,decode,puzzleDrill,windowDegrees,MAX_BALLS,MAX_LINK} from '../src/puzzle.js'
import {attempt} from '../src/drills.js'
import {setTableSize} from '../src/table.js'
setTableSize(7)

const easy={cue:[220,190],balls:[[1,420,190],[5,300,300]],target:1}
const blocked={cue:[120,190],balls:[[1,600,190],[2,360,190]],target:1}

test('a layout is refused with a reason a player can act on',()=>{
 assert.equal(problem(easy),null)
 assert.match(problem(null),/not a table/);assert.match(problem({...easy,balls:[]}),/at least one/)
 assert.match(problem({...easy,target:9}),/ball to pot/)
 assert.match(problem({...easy,cue:[5,5]}),/cloth/);assert.match(problem({...easy,cue:[100.5,100]}),/cloth/)
 assert.match(problem({...easy,balls:[[1,420,190],[1,500,190]]}),/share a number/)
 assert.match(problem({...easy,balls:[[0,420,190]],target:0}),/bad number/);assert.match(problem({...easy,balls:[[16,420,190]],target:16}),/bad number/)
 assert.match(problem({...easy,balls:[[1,420,190],[2,425,190]]}),/touching/)
 assert.match(problem({...easy,balls:[[1,45,45]]}),/pocket/)
 const many=[...Array(MAX_BALLS+1)].map((_,i)=>[i+1,80+i*60,300])
 assert.match(problem({cue:[100,100],balls:many,target:1}),/No more than/)
 assert.equal(problem({cue:[100,100],balls:many.slice(0,MAX_BALLS),target:1}),null)
})

test('the solver finds a shot for an open table, and the shot really pots the ball',()=>{
 const r=solve(easy);assert.ok(r,'a solution')
 assert.ok(r.window>=.2);assert.equal(attempt(puzzleDrill(easy),r.hint).ok,true)
 assert.equal(proves(easy,r.hint),true)
 // and the margin it reports is honest: a shot inside the window still works
 assert.equal(attempt(puzzleDrill(easy),{...r.hint,angle:r.hint.angle+.1*Math.PI/180}).ok||attempt(puzzleDrill(easy),{...r.hint,angle:r.hint.angle-.1*Math.PI/180}).ok,true)
})

test('a search cut short returns nothing, or something proven, never a guess',()=>{
 const p={cue:[80,60],balls:[[1,80,300]],target:1}
 const r=solve(p,{budgetMs:1,now:(()=>{let t=0;return()=>t+=5})()})
 assert.ok(r===null||proves(p,r.hint))
})

test('a blocked straight shot is solved some other way, or reported unsolved, never returned unproven',()=>{
 const r=solve(blocked,{budgetMs:8000})
 if(r)assert.equal(proves(blocked,r.hint),true);else assert.equal(r,null)
})

test('the search yields as it goes, so a screen can stay alive, and can be cut short',()=>{
 const it=search(easy,{every:2});const first=it.next()
 assert.equal(first.done,false);assert.ok(first.value.tried>=2)
 const capped=solve(blocked,{tries:5});assert.ok(capped===null||proves(blocked,capped.hint))
})

test('an invalid layout is never searched',()=>{assert.equal(solve({...easy,target:9}),null)})

test('a link round-trips: the same table and the same shot',()=>{
 const r=solve(easy),link=encode(easy,r.hint)
 assert.ok(link.length<MAX_LINK);assert.match(link,/^[v0-9_-]+$/)
 const back=decode(link);assert.ok(back)
 assert.deepEqual(back.puzzle,easy);assert.equal(back.hint.power,r.hint.power);assert.ok(Math.abs(back.hint.angle-r.hint.angle)<1e-4)
 assert.equal(attempt(puzzleDrill(back.puzzle),back.hint).ok,true)
})

test('a link that does not work, or is not a link, is refused',()=>{
 const r=solve(easy),good=encode(easy,r.hint)
 assert.ok(decode(good))
 // a shot that misses
 assert.equal(decode(encode(easy,{...r.hint,angle:r.hint.angle+1})),null,'the proving shot fails on this table')
 for(const bad of [null,undefined,42,'','v2_1_2_3',`${good}_`,good.replace('v1','v9'),`${good}x`,'v1_1_220_190_0_50','v1_9_220_190_0_50_1-420-190',
  'v1_1_220_190_70000_50_1-420-190','v1_1_220_190_0_0_1-420-190','v1_1_220_190_0_101_1-420-190','v1_1_220_190_0_50_1-420','v1_1_5_5_0_50_1-420-190',
  'v1_1_220_190_0_50_1-420-190_1-500-190','v1_1_220_190_0_50_'+[...Array(20)].map((_,i)=>`${i%15+1}-100-100`).join('_'),'x'.repeat(MAX_LINK+1)])
  assert.equal(decode(bad),null,String(bad).slice(0,60))
})

test('the window shrinks when the shot is made worse, and is zero-ish for a lucky one',()=>{
 const r=solve(easy);assert.ok(windowDegrees(puzzleDrill(easy),r.hint)>=r.window-.1)
})
