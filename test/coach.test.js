import test from 'node:test';import assert from 'node:assert/strict'
import {analyse,describe,chance,coachShot,replayOf,play,pocketName,reasonText,TRIALS} from '../src/coach.js'
import {pack,unpack,ballsAt} from '../src/replay.js'
import {rack} from '../src/rules.js'
import {DRILLS,buildBalls,HINTS} from '../src/drills.js'

const drill=id=>DRILLS.find(d=>d.id===id)
const straight=()=>buildBalls(drill('straight-in'))      // cue below, the 1 straight up the table
const hint=HINTS['straight-in']

test('a good shot is called good, with how often it works, and the coach agrees with it',()=>{
 const a=analyse({before:straight(),shot:hint,group:null,mode:'8ball'})
 assert.equal(a.verdict,'great');assert.deepEqual(a.yours.potted,[1])
 assert.ok(a.yours.chance>=.6,`chance ${a.yours.chance}`)
 assert.match(a.headline,/You potted the 1/)
 assert.match(a.detail,/works (about \d+% of the time|almost every time)/)
})

test('a miss says so, and names the shot the coach would have played',()=>{
 const a=analyse({before:straight(),shot:{...hint,angle:hint.angle+.08},group:null,mode:'8ball'})
 assert.equal(a.verdict,'miss');assert.equal(a.headline,'It did not drop.')
 assert.equal(a.best.pot,1);assert.equal(pocketName(a.best.pocket),'top middle')
 assert.match(a.detail,/coach would have played the 1 into the top middle pocket/)
})

test('a scratch is a foul, and the reason is given',()=>{
 // the cue ball hit straight into the corner beside it
 const balls=[{...straight()[0],x:60,y:60},...straight().slice(1)]
 const a=analyse({before:balls,shot:{angle:-3*Math.PI/4,power:30,spin:[0,0]},group:null,mode:'8ball'})
 assert.equal(a.verdict,'foul');assert.equal(a.yours.foul,'scratch')
 assert.match(a.headline,/foul: the cue ball went into a pocket/)
})

test('hitting the wrong ball first is a foul once groups are known',()=>{
 // solids and stripes: the player owns stripes but hits the 1 (a solid)
 const a=analyse({before:straight(),shot:hint,group:'stripe',mode:'8ball'})
 assert.equal(a.yours.foul,'wrong-first')
})

test('nine-ball: hitting a ball that is not the lowest is a foul',()=>{
 const balls=buildBalls(drill('combination'))            // the 1 and the 2 on the table
 const shot=hint
 const p=play(balls,{angle:Math.atan2(125-320,350-350),power:50,spin:[0,0]},null,'9ball')
 assert.ok(p.foul===null||p.foul==='wrong-first'||p.foul==='no-rail')
 assert.ok(shot)
})

test('the same table always gets the same answer',()=>{
 const args={before:rack('8ball'),shot:{angle:.03,power:60,spin:[0,0]},group:null,mode:'8ball'}
 assert.deepEqual(analyse(args),analyse(args))
 assert.deepEqual(coachShot(rack('8ball'),null,'8ball'),coachShot(rack('8ball'),null,'8ball'))
})

test('the coach never touches the table it was given, or the real random numbers',()=>{
 const before=rack('8ball'),copy=JSON.stringify(before),real=Math.random
 analyse({before,shot:{angle:0,power:70,spin:[0,0]},group:null,mode:'8ball'})
 assert.equal(JSON.stringify(before),copy);assert.equal(Math.random,real)
})

test('a break is described but not compared with a coach pot',()=>{
 const a=analyse({before:rack('8ball'),shot:{angle:0,power:72,spin:[0,0]},group:null,mode:'8ball',breakShot:true})
 assert.equal(a.best,null)
})

test('a sound shot works more often than a marginal one',()=>{
 const good=chance(straight(),hint,null,'8ball')
 const off=chance(straight(),{...hint,angle:hint.angle+.05},null,'8ball')   // ~2.9 degrees off
 assert.ok(good>off,`${good} vs ${off}`)
 assert.equal(good*TRIALS,Math.round(good*TRIALS))
})

test('nothing legal to hit means no coach shot',()=>{
 const balls=straight().map(b=>b.n===0?b:({...b,on:false}))
 assert.equal(coachShot(balls,null,'8ball'),null)
})

test('the words: how a verdict is chosen and when the coach speaks up',()=>{
 const y=(o={})=>({potted:[],foul:null,pot:null,pocket:null,chance:0,...o})
 const best=(o={})=>({pot:5,pocket:2,chance:.9,...o})
 assert.equal(describe(y({foul:'no-rail'}),best()).verdict,'foul')
 assert.match(describe(y({foul:'no-rail'}),null).headline,/nothing reached a cushion/)
 assert.equal(describe(y({potted:[4],pot:4,pocket:1,chance:.8}),best()).verdict,'great')
 assert.equal(describe(y({potted:[4],pot:4,pocket:1,chance:.3}),best()).verdict,'good')
 // the coach speaks up when it has a steadier shot, and otherwise says nothing more
 assert.match(describe(y({potted:[4],pot:4,pocket:1,chance:.3}),best({chance:.9})).detail,/coach would have played the 5 into the top right/)
 assert.doesNotMatch(describe(y({potted:[4],pot:4,pocket:1,chance:.8}),best({chance:.85})).detail,/coach would have played the 5/)
 assert.match(describe(y({potted:[4],pot:4,pocket:1,chance:.8}),best({pot:4,pocket:1})).detail,/same shot/)
 assert.match(describe(y(),best({pot:null,chance:0})).detail,/played safe/)
 assert.match(describe(y(),null).detail,/nothing legal/)
 assert.equal(describe(y({potted:[1,2,3],pot:1}),null).headline,'You potted the 1, the 2 and the 3.')
 assert.match(describe(y({potted:[4],pot:4,pocket:1,chance:1}),null).detail,/almost every time/)
 assert.match(describe(y({potted:[4],pot:4,pocket:1,chance:.5}),null).detail,/about 50% of the time/)
 assert.ok(reasonText('scratch')&&reasonText('whatever'))
})

test('the coach shot can be watched: it becomes a replay that survives a link',async()=>{
 // a full 16-ball table with only the cue ball and the 1 left on it, as a real game has
 const before=rack('8ball').map(b=>b.n===0?{...b,x:350,y:260}:b.n===1?{...b,x:350,y:150}:{...b,on:false}),rec=replayOf(before,hint,'8ball')
 assert.ok(rec.frames.length>5)
 assert.equal(rec.mode,'8ball');assert.equal(rec.ids.length,before.length)
 // the first frame is the table as it stood; the ball ends up potted
 const first=ballsAt(rec,0),cue=first.find(b=>b.n===0)
 assert.equal(Math.round(cue.x),Math.round(before[0].x))
 const last=ballsAt(rec,rec.frames[rec.frames.length-1].t)
 assert.equal(last.find(b=>b.n===1).on,false,'the 1 was potted in the replay')
 const back=await unpack(await pack(rec));assert.deepEqual(back,rec)
})

test('in the scored games the coach only counts what scores',()=>{
 // a straight pot with nothing else on the table: in bank pool it is not a bank, so it does not count
 const before=rack('bank').map(b=>b.n===0?{...b,x:350,y:260}:b.n===1?{...b,x:350,y:150}:{...b,on:false})
 const a=analyse({before,shot:hint,group:null,mode:'bank',player:'a'})
 assert.deepEqual(a.yours.potted,[1]);assert.deepEqual(a.yours.counted,[]);assert.equal(a.verdict,'miss')
 assert.match(a.headline,/dropped, but it did not count/);assert.match(a.detail,/touch a cushion/)
 // one-pocket: the top-middle pocket is nobody's, so it does not count there either
 const b=analyse({before:before.map(x=>({...x})),shot:hint,group:null,mode:'onepocket',player:'a'})
 assert.deepEqual(b.yours.counted,[]);assert.match(b.detail,/your own pocket/)
 // and an eight-ball shot counts everything that dropped, as before
 assert.deepEqual(analyse({before:straight(),shot:hint,group:null,mode:'8ball'}).yours.counted,[1])
})
