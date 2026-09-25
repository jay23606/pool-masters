import test from 'node:test';import assert from 'node:assert/strict'
import {emptyStats,applyEvent,TROPHIES,GROUPS,progressOf,earned,newlyEarned,unlock} from '../src/trophies.js'
import {DRILLS} from '../src/drills.js'

const fold=(events,start=emptyStats())=>events.reduce(applyEvent,start)
const shot=o=>({type:'shot',mine:true,potted:[],foul:false,brk:false,mode:'8ball',won:false,...o})
const rack=o=>({type:'rack',won:true,mode:'8ball',size:7,ai:null,human:false,breakRun:false,...o})
const ctx=(o={})=>({stats:emptyStats(),drills:{},profile:null,...o})
const has=(id,c)=>earned(TROPHIES.find(t=>t.id===id),c)

test('nothing is earned by a player who has done nothing',()=>{
 for(const t of TROPHIES)assert.equal(earned(t,ctx()),false,t.id)
 assert.deepEqual(newlyEarned(ctx(),{}),[])
})

test('the trophies are well formed: unique, named, described, grouped',()=>{
 assert.ok(TROPHIES.length>=20)
 assert.equal(new Set(TROPHIES.map(t=>t.id)).size,TROPHIES.length)
 for(const t of TROPHIES){
  assert.ok(t.name.length>2&&t.desc.length>10&&t.icon&&t.group,t.id)
  const p=progressOf(t,ctx())
  assert.ok(p.target>=1&&p.value===0,`${t.id}: starts at 0 towards a target`)
 }
 assert.ok(GROUPS.length>=5)
 assert.ok(TROPHIES.every(t=>GROUPS.includes(t.group)))
})

test('progress never runs past its target, so a bar cannot overflow',()=>{
 const rich=ctx({stats:{...emptyStats(),racksWon:9999,longestRun:99,matchesWon:50,humanRacks:400,humanWins:400,shared:80,tables:{7:1,8:1,9:1,10:1}},
  profile:{best_streak:50,rating:2400}})
 for(const t of TROPHIES){const p=progressOf(t,rich);assert.ok(p.value<=p.target,`${t.id} ${p.value}/${p.target}`)}
})

test('an event never changes the stats it was given',()=>{
 const before=emptyStats(),snap=JSON.stringify(before)
 applyEvent(before,rack({}));applyEvent(before,shot({potted:[3]}));applyEvent(before,{type:'share'})
 assert.equal(JSON.stringify(before),snap)
})

test('unknown or missing events change nothing',()=>{
 const s=fold([rack({})])
 assert.deepEqual(applyEvent(s,{type:'nonsense'}),s)
 assert.deepEqual(applyEvent(s,null),s)
 assert.deepEqual(applyEvent(s,undefined),s)
})

test('stats saved before a field existed still work',()=>{
 const old={racksWon:3}
 assert.doesNotThrow(()=>applyEvent(old,rack({})))
 assert.equal(applyEvent(old,rack({})).racksWon,4)
 assert.equal(applyEvent({},shot({potted:[1]})).run,1)
})

// ---- runs ----

test('a run counts balls potted in one visit, and any miss, foul or opponent shot ends it',()=>{
 let s=fold([shot({potted:[1]}),shot({potted:[2,3]})])
 assert.equal(s.run,3)
 assert.equal(s.longestRun,3)
 s=applyEvent(s,shot({potted:[]}))
 assert.equal(s.run,0,'a miss ends it');assert.equal(s.longestRun,3,'but the record stays')
 s=fold([shot({potted:[4]}),shot({mine:false,potted:[9]})],s)
 assert.equal(s.run,0,'the opponent taking a shot ends it, and their pots are not mine')
 assert.equal(fold([shot({potted:[4]}),shot({foul:true,potted:[5]})]).run,0,'a foul ends it, and its pot does not count')
})

test('the longest run is the best of them, not the latest',()=>{
 const s=fold([shot({potted:[1,2,3,4,5]}),shot({potted:[]}),shot({potted:[6]})])
 assert.equal(s.longestRun,5);assert.equal(s.run,1)
})

test('the shot that ends a rack does not leave a run behind, whichever order the events arrive in',()=>{
 // the host reports the rack before the final shot; a guest reports it after
 const hostOrder=fold([rack({}),shot({potted:[9],won:true,over:true}),shot({potted:[1]})])
 const guestOrder=fold([shot({potted:[9],won:true,over:true}),rack({}),shot({potted:[1]})])
 assert.equal(hostOrder.run,1,'only the pot in the new rack counts towards its run');assert.equal(guestOrder.run,1)
 assert.equal(hostOrder.longestRun,1);assert.equal(guestOrder.longestRun,1)
})

test('a run does not carry across racks',()=>{
 const s=fold([shot({potted:[1,2]}),rack({}),shot({potted:[3]})])
 assert.equal(s.run,1)
})

// ---- the golden break ----

test('the golden break is the 9 on the break of a 9-ball rack, that won it',()=>{
 assert.equal(fold([shot({brk:true,mode:'9ball',won:true,potted:[3,9]})]).goldenBreaks,1)
 assert.equal(fold([shot({brk:true,mode:'9ball',won:true,potted:[3]})]).goldenBreaks,0,'no 9')
 assert.equal(fold([shot({brk:false,mode:'9ball',won:true,potted:[9]})]).goldenBreaks,0,'not the break')
 assert.equal(fold([shot({brk:true,mode:'8ball',won:true,potted:[9]})]).goldenBreaks,0,'not 9-ball')
 assert.equal(fold([shot({brk:true,mode:'9ball',won:false,potted:[9]})]).goldenBreaks,0,'did not win, so the 9 was on a foul')
 assert.equal(fold([shot({mine:false,brk:true,mode:'9ball',won:true,potted:[9]})]).goldenBreaks,0,'someone else')
})

// ---- racks ----

test('a rack counts played and won, by game',()=>{
 const s=fold([rack({}),rack({won:false}),rack({mode:'9ball'})])
 assert.equal(s.racksPlayed,3);assert.equal(s.racksWon,2)
 assert.equal(s.byMode['8ball:played'],2);assert.equal(s.byMode['8ball:won'],1)
 assert.equal(s.byMode['9ball:won'],1)
})

test('beating the AI counts per level, and only when you won',()=>{
 const s=fold([rack({ai:'league'}),rack({ai:'league',won:false}),rack({ai:'pro'})])
 assert.deepEqual(s.aiWins,{league:1,pro:1})
})

test('racks against a person count separately from the AI',()=>{
 const s=fold([rack({human:true}),rack({human:true,won:false}),rack({ai:'pro'})])
 assert.equal(s.humanRacks,2);assert.equal(s.humanWins,1)
})

test('a break and run counts only if you won it',()=>{
 assert.equal(fold([rack({breakRun:true})]).breakRuns,1)
 assert.equal(fold([rack({breakRun:true,won:false})]).breakRuns,0)
})

test('a clean rack is a win with no fouls of your own, and fouls reset for the next rack',()=>{
 assert.equal(fold([shot({potted:[1]}),rack({})]).cleanRacks,1)
 assert.equal(fold([shot({foul:true}),rack({})]).cleanRacks,0,'you fouled')
 assert.equal(fold([shot({mine:false,foul:true}),rack({})]).cleanRacks,1,'the opponent foul is not yours')
 assert.equal(fold([shot({foul:true}),rack({won:false}),rack({})]).cleanRacks,1,'the foul belonged to the last rack')
 assert.equal(fold([shot({foul:true}),rack({won:false})]).cleanRacks,0,'a loss is not a clean win')
})

test('tables are remembered when you win on them, and only then',()=>{
 const s=fold([rack({size:7}),rack({size:8,won:false}),rack({size:9})])
 assert.deepEqual(Object.keys(s.tables).sort(),['7','9'])
})

test('matches and shares are counted',()=>{
 assert.equal(fold([{type:'match',won:true},{type:'match',won:false},{type:'match',won:true}]).matchesWon,2)
 assert.equal(fold([{type:'share'},{type:'share'}]).shared,2)
})

// ---- the trophies themselves ----

test('racks: won at 1, 10 and 50',()=>{
 for(const [n,id,yes] of [[0,'first-rack',false],[1,'first-rack',true],[9,'ten-racks',false],[10,'ten-racks',true],[49,'fifty-racks',false],[50,'fifty-racks',true]])
  assert.equal(has(id,ctx({stats:{...emptyStats(),racksWon:n}})),yes,`${id} at ${n}`)
})

test('table tourist needs all three sizes',()=>{
 assert.equal(has('tables',ctx({stats:{...emptyStats(),tables:{7:true,8:true}}})),false)
 assert.equal(has('tables',ctx({stats:{...emptyStats(),tables:{7:true,8:true,9:true}}})),true)
})

test('nine-ball trophies read the right things',()=>{
 assert.equal(has('nine-ball',ctx({stats:{...emptyStats(),byMode:{'8ball:won':40}}})),false,'8-ball wins do not count')
 assert.equal(has('nine-ball',ctx({stats:{...emptyStats(),byMode:{'9ball:won':1}}})),true)
 assert.equal(has('golden-break',ctx({stats:{...emptyStats(),goldenBreaks:1}})),true)
})

test('skill trophies: runs of 5 and 8, break and run, clean hands',()=>{
 assert.equal(has('on-a-roll',ctx({stats:{...emptyStats(),longestRun:4}})),false)
 assert.equal(has('on-a-roll',ctx({stats:{...emptyStats(),longestRun:5}})),true)
 assert.equal(has('sweep',ctx({stats:{...emptyStats(),longestRun:7}})),false)
 assert.equal(has('sweep',ctx({stats:{...emptyStats(),longestRun:8}})),true)
 assert.equal(has('break-and-run',ctx({stats:{...emptyStats(),breakRuns:1}})),true)
 assert.equal(has('clean-hands',ctx({stats:{...emptyStats(),cleanRacks:1}})),true)
})

test('opponent trophies: each AI level is its own',()=>{
 const only=lvl=>ctx({stats:{...emptyStats(),aiWins:{[lvl]:1}}})
 assert.deepEqual(['beat-beginner','beat-league','beat-pro'].filter(id=>has(id,only('league'))),['beat-league'])
 assert.equal(has('face-to-face',ctx({stats:{...emptyStats(),humanRacks:1}})),true)
 assert.equal(has('bragging-rights',ctx({stats:{...emptyStats(),humanRacks:3,humanWins:0}})),false,'losing to people is not bragging')
})

test('drill trophies read the drill progress',()=>{
 const doneAll=Object.fromEntries(DRILLS.map(d=>[d.id,{tries:1,done:true,best:1}]))
 const hinted=Object.fromEntries(DRILLS.map(d=>[d.id,{tries:1,done:true,best:null}]))
 assert.equal(has('first-drill',ctx({drills:{[DRILLS[0].id]:{done:true,best:null}}})),true)
 assert.equal(has('all-drills',ctx({drills:doneAll})),true)
 assert.equal(has('all-drills',ctx({drills:{...doneAll,[DRILLS[0].id]:{done:false,best:null}}})),false,'one short')
 assert.equal(has('unaided',ctx({drills:hinted})),false,'every one used the hint')
 assert.equal(has('unaided',ctx({drills:doneAll})),true)
 const lvl3=DRILLS.filter(d=>d.level===3)
 const partial=Object.fromEntries(lvl3.slice(1).map(d=>[d.id,{done:true,best:1}]))
 assert.equal(has('advanced',ctx({drills:partial})),false)
 assert.equal(has('advanced',ctx({drills:Object.fromEntries(lvl3.map(d=>[d.id,{done:true,best:1}]))})),true)
})

test('league trophies read the profile, and are absent without one',()=>{
 assert.equal(has('streak-3',ctx({profile:{best_streak:3,rating:1000}})),true)
 assert.equal(has('streak-5',ctx({profile:{best_streak:4,rating:1000}})),false)
 assert.equal(has('elo-1100',ctx({profile:{best_streak:0,rating:1100}})),true)
 assert.equal(has('elo-1250',ctx({profile:{best_streak:0,rating:1249}})),false)
 for(const id of ['streak-3','streak-5','elo-1100','elo-1250'])assert.equal(has(id,ctx({profile:null})),false,'no profile loaded')
})

test('sharing a replay earns the highlight reel',()=>{
 assert.equal(has('share',ctx({stats:fold([{type:'share'}])})),true)
})

// ---- unlocking ----

test('newlyEarned skips what is already recorded, and unlock records when',()=>{
 const c=ctx({stats:{...emptyStats(),racksWon:10}})
 const first=newlyEarned(c,{})
 assert.deepEqual(first.map(t=>t.id),['first-rack','ten-racks'],'in list order')
 const unlocked=unlock({},first,12345)
 assert.deepEqual(unlocked['ten-racks'],{at:12345})
 assert.deepEqual(newlyEarned(c,unlocked),[],'nothing new the second time')
 assert.deepEqual(newlyEarned({...c,stats:{...c.stats,racksWon:50}},unlocked).map(t=>t.id),['fifty-racks'])
})

test('unlock keeps what was already there and does not mutate its input',()=>{
 const before={'first-rack':{at:1}},snap=JSON.stringify(before)
 const after=unlock(before,[TROPHIES[3]],2)
 assert.equal(JSON.stringify(before),snap)
 assert.deepEqual(after['first-rack'],{at:1});assert.deepEqual(after[TROPHIES[3].id],{at:2})
})

test('existing progress is honoured at once: a player with drills already done starts with those trophies',()=>{
 const doneAll=Object.fromEntries(DRILLS.map(d=>[d.id,{tries:1,done:true,best:1}]))
 const ids=newlyEarned(ctx({drills:doneAll,profile:{best_streak:5,rating:1260}}),{}).map(t=>t.id)
 for(const id of ['first-drill','unaided','advanced','all-drills','streak-3','streak-5','elo-1100','elo-1250'])assert.ok(ids.includes(id),id)
})

test('a whole winning game, folded event by event, earns the trophies it should',()=>{
 // a 9-ball golden break against the Pro AI on a 9-foot table
 const s=fold([
  shot({brk:true,mode:'9ball',won:true,potted:[2,9]}),
  rack({mode:'9ball',size:9,ai:'pro',breakRun:true}),
  {type:'match',won:false},
 ])
 const got=newlyEarned(ctx({stats:s}),{}).map(t=>t.id)
 for(const id of ['first-rack','nine-ball','golden-break','break-and-run','clean-hands','beat-pro'])assert.ok(got.includes(id),id)
 for(const id of ['ten-racks','match','tables','bragging-rights','face-to-face','sweep'])assert.ok(!got.includes(id),`${id} should not be earned`)
})
