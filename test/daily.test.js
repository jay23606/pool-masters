import test from 'node:test';import assert from 'node:assert/strict'
import {DAILY} from '../src/daily-data.js'
import {dayNumber,dailyDrill,entryFor,levelOf,shareText,isDaily,dailyNumberOf,dailySolved,EPOCH} from '../src/daily.js'
import {attempt,buildBalls,DRILL_TABLE} from '../src/drills.js'
import {W,H,R,setTableSize} from '../src/table.js'

// the table the game plays drills on, as the game sets it up (not the module's initial constants)
setTableSize(DRILL_TABLE)

test('day numbers count from 1 January 2026 by the local calendar',()=>{
 assert.equal(dayNumber(new Date(2026,0,1,0,5)),1)
 assert.equal(dayNumber(new Date(2026,0,1,23,59)),1)
 assert.equal(dayNumber(new Date(2026,0,2)),2)
 assert.equal(dayNumber(new Date(2027,0,1)),366)
 assert.equal(EPOCH,Date.UTC(2026,0,1))
})

test('every generated table is a legal one: on the cloth, apart, with the target present',()=>{
 assert.ok(DAILY.length>=150)
 for(const d of DAILY){
  const all=[d.cue,...d.balls.map(b=>[b[1],b[2]])]
  for(const [x,y] of all)assert.ok(x>R*2&&x<W-R*2&&y>R*2&&y<H-R*2,`seed ${d.seed}: a ball is against the cushion`)
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)assert.ok(Math.hypot(all[i][0]-all[j][0],all[i][1]-all[j][1])>2*R,`seed ${d.seed}: two balls overlap`)
  assert.equal(new Set(d.balls.map(b=>b[0])).size,d.balls.length)
  assert.ok(d.balls.some(b=>b[0]===d.target))
 }
})

test('every daily shot can be solved: its hint pots the target, in the real physics',()=>{
 for(const d of DAILY){
  const drill=dailyDrill(1+DAILY.indexOf(d)) // any day works; the shot is what is proven
  const own={layout:{cue:d.cue,balls:d.balls},win:{pot:d.target}}
  assert.ok(attempt(own,d.hint).ok,`seed ${d.seed} is not solved by its own hint`)
  assert.ok(drill.hint)
 }
})

test('a day always gets the same table, and a drill built from it plays like any other',()=>{
 for(const n of [1,2,3,40,365,1000]){
  assert.deepEqual(dailyDrill(n),dailyDrill(n))
  const d=dailyDrill(n)
  assert.equal(d.id,`daily-${n}`);assert.ok(isDaily(d.id));assert.equal(dailyNumberOf(d.id),n)
  const balls=buildBalls(d)
  assert.equal(balls[0].n,0);assert.ok(balls.some(b=>b.n===d.win.pot))
  assert.ok(attempt(d,d.hint).ok,`day ${n}: its hint does not solve it`)
 }
})

test('difficulty follows the week, and a table is not repeated until its grade has been used up',()=>{
 // 1 Jan 2026 is a Thursday (medium); the weekend is hard, Monday and Tuesday easy
 const lv=n=>dailyDrill(n).level
 assert.equal(lv(1),2);assert.equal(lv(2),3);assert.equal(lv(3),3);assert.equal(lv(4),2);assert.equal(lv(5),1);assert.equal(lv(6),1)
 for(const level of [1,2,3]){
  const days=[];for(let n=1;days.length<40;n++)if(entryFor(n).level===level)days.push(n)
  const seeds=days.map(n=>entryFor(n).entry.seed)
  assert.equal(new Set(seeds.slice(0,20)).size,20,`level ${level} repeats within its first twenty days`)
 }
 assert.deepEqual([levelOf(3),levelOf(2.2),levelOf(1.4),levelOf(1)],[1,1,2,3])
})

test('the share text says how it went, and does not claim more than happened',()=>{
 assert.match(shareText(12,2,{done:true,best:1}),/Daily #12 ★★☆\nPotted it first go/)
 assert.match(shareText(12,3,{done:true,best:4}),/★★★\nPotted it in 4 tries/)
 assert.match(shareText(12,1,{done:true,best:null}),/with a little help/)
 assert.match(shareText(12,1,undefined),/Still working on it/)
 assert.match(shareText(12,1,{done:true,best:1}),/https:\/\/jay23606\.github\.io\/pool-masters\/$/)
})

test('only solved daily shots count, and practice drills are not daily shots',()=>{
 const p={'daily-3':{done:true},'daily-4':{done:false},'daily-9':{done:true},'straight-in':{done:true}}
 assert.equal(dailySolved(p),2)
 assert.equal(dailySolved(undefined),0)
 assert.ok(!isDaily('straight-in')&&!isDaily('daily-x'))
})
