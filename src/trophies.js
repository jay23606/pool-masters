import {DRILLS} from './drills.js'

// Trophies. Pure data and pure functions, like the rules: stats are plain
// numbers, an event changes them, and an achievement is a number reaching a
// target. Nothing here touches storage, the DOM or a game, so all of it can be
// tested; main.js feeds it events and keeps the result in the browser.
//
// Everything is per device. There is no server behind these, so a trophy is not
// proof of anything to anyone else -- it is a record for the player who earned
// it. Ranking stays where it is; the league tracks streaks and Elo, and those
// trophies read from that profile when it is available.

export const emptyStats=()=>({
 racksWon:0,racksPlayed:0,byMode:{},aiWins:{},humanRacks:0,humanWins:0,
 breakRuns:0,goldenBreaks:0,cleanRacks:0,matchesWon:0,
 longestRun:0,run:0,rackFouls:0,tables:{},shared:0,
})

const bump=(o,k,n=1)=>({...o,[k]:(o?.[k]||0)+n})

// An event describes one thing that happened to the player; the result is the
// stats afterwards. Nothing is mutated.
//
//   shot   {mine, potted:[n], foul, brk, mode, won, over}   one finished shot, by either side;
//          over is true if this shot ended the rack, which the host reports *before*
//          the rack itself and a guest after, so a run must not outlive it either way
//   rack   {won, mode, size, ai:level|null, human, breakRun}   a finished rack
//   match  {won}                                      a finished race-to match
//   share  {}                                         a replay link was shared
export function applyEvent(stats,e){
 const s={...emptyStats(),...stats}
 switch(e?.type){
  case 'shot':{
   const pots=e.potted?.length||0
   if(!e.mine)return {...s,run:0}
   if(e.foul)return {...s,run:0,rackFouls:s.rackFouls+1}
   if(!pots)return {...s,run:0}
   const run=s.run+pots
   // pocketing the 9 on the break, legally, wins the rack: the golden break
   const golden=e.brk&&e.mode==='9ball'&&e.won&&e.potted.includes(9)
   return {...s,run:e.over?0:run,longestRun:Math.max(s.longestRun,run),goldenBreaks:s.goldenBreaks+(golden?1:0)}
  }
  case 'rack':{
   const played=bump(s.byMode,`${e.mode}:played`),won=e.won?bump(played,`${e.mode}:won`):played
   return {...s,
    racksPlayed:s.racksPlayed+1,racksWon:s.racksWon+(e.won?1:0),byMode:won,
    aiWins:e.won&&e.ai?bump(s.aiWins,e.ai):s.aiWins,
    humanRacks:s.humanRacks+(e.human?1:0),humanWins:s.humanWins+(e.human&&e.won?1:0),
    breakRuns:s.breakRuns+(e.won&&e.breakRun?1:0),
    cleanRacks:s.cleanRacks+(e.won&&s.rackFouls===0?1:0),
    tables:e.won&&e.size?{...s.tables,[e.size]:true}:s.tables,
    run:0,rackFouls:0}
  }
  case 'match':return {...s,matchesWon:s.matchesWon+(e.won?1:0)}
  case 'share':return {...s,shared:s.shared+1}
  default:return s
 }
}

// ---- the achievements ----
// `progress(ctx)` is {value,target}; the trophy is earned when value reaches
// target. ctx is {stats, drills, profile}: the drill progress map, and the league
// profile if one has loaded (it has wins, best_streak and rating).

const A=(id,group,icon,name,desc,progress)=>({id,group,icon,name,desc,progress})
const at=(f,target)=>c=>({value:Math.min(f(c),target),target})
const won=(mode,c)=>c.stats.byMode?.[`${mode}:won`]||0
const drillsDone=c=>DRILLS.filter(d=>c.drills?.[d.id]?.done).length
const unaided=c=>DRILLS.filter(d=>c.drills?.[d.id]?.best!=null).length
const level3=DRILLS.filter(d=>d.level===3)

export const TROPHIES=[
 A('first-rack','Racks','🎱','Racked up','Win your first rack.',at(c=>c.stats.racksWon,1)),
 A('ten-racks','Racks','🎱','Regular','Win 10 racks.',at(c=>c.stats.racksWon,10)),
 A('fifty-racks','Racks','🎱','Hustler','Win 50 racks.',at(c=>c.stats.racksWon,50)),
 A('match','Racks','🏁','Race won','Win a race-to-3 match.',at(c=>c.stats.matchesWon,1)),
 A('tables','Racks','📐','Table tourist','Win a rack on a 7, an 8 and a 9-foot table.',at(c=>Object.keys(c.stats.tables||{}).length,3)),

 A('nine-ball','Nine-ball','9️⃣','Nine ball, corner pocket','Win a rack of 9-ball.',at(c=>won('9ball',c),1)),
 A('golden-break','Nine-ball','🌟','Golden break','Win a 9-ball rack by pocketing the 9 on the break.',at(c=>c.stats.goldenBreaks,1)),

 A('on-a-roll','Skill','🔥','On a roll','Pot 5 balls in one visit to the table.',at(c=>c.stats.longestRun,5)),
 A('sweep','Skill','🧹','Clean sweep','Pot 8 balls in one visit to the table.',at(c=>c.stats.longestRun,8)),
 A('break-and-run','Skill','⚡','Break and run','Win a rack without your opponent ever shooting.',at(c=>c.stats.breakRuns,1)),
 A('clean-hands','Skill','🧤','Clean hands','Win a rack without committing a foul.',at(c=>c.stats.cleanRacks,1)),

 A('beat-beginner','Opponents','🤖','Beginner’s luck','Beat the Beginner AI.',at(c=>c.stats.aiWins?.beginner||0,1)),
 A('beat-league','Opponents','🤖','League standard','Beat the League AI.',at(c=>c.stats.aiWins?.league||0,1)),
 A('beat-pro','Opponents','🤖','Going pro','Beat the Pro AI.',at(c=>c.stats.aiWins?.pro||0,1)),
 A('face-to-face','Opponents','🤝','Face to face','Play a rack against another person.',at(c=>c.stats.humanRacks,1)),
 A('bragging-rights','Opponents','😎','Bragging rights','Beat another person.',at(c=>c.stats.humanWins,1)),

 A('first-drill','Practice','🎯','Off the rail','Complete a practice drill.',at(drillsDone,1)),
 A('unaided','Practice','🧠','No training wheels','Solve 5 drills without using the hint.',at(unaided,5)),
 A('advanced','Practice','🎓','Advanced class','Complete every level-3 drill.',at(c=>level3.filter(d=>c.drills?.[d.id]?.done).length,level3.length)),
 A('all-drills','Practice','🏅','Graduate','Complete every practice drill.',at(drillsDone,DRILLS.length)),

 A('share','Social','🎬','Highlight reel','Share a replay of one of your shots.',at(c=>c.stats.shared,1)),

 A('streak-3','League','📈','Hot streak','Win 3 ranked racks in a row.',at(c=>c.profile?.best_streak||0,3)),
 A('streak-5','League','📈','Unstoppable','Win 5 ranked racks in a row.',at(c=>c.profile?.best_streak||0,5)),
 A('elo-1100','League','⬆️','Moving up','Reach 1100 Elo.',at(c=>c.profile?.rating||0,1100)),
 A('elo-1250','League','🏆','Contender','Reach 1250 Elo.',at(c=>c.profile?.rating||0,1250)),
]

export const GROUPS=[...new Set(TROPHIES.map(t=>t.group))]

export const progressOf=(t,ctx)=>t.progress({...ctx,stats:{...emptyStats(),...ctx?.stats}})
export const earned=(t,ctx)=>{const p=progressOf(t,ctx);return p.value>=p.target}

// Trophies that are earned now and were not recorded before, in list order.
export const newlyEarned=(ctx,unlocked)=>TROPHIES.filter(t=>!unlocked?.[t.id]&&earned(t,ctx))

// Record them, with when. Returns a new map.
export const unlock=(unlocked,list,when=Date.now())=>({...unlocked,...Object.fromEntries(list.map(t=>[t.id,{at:when}]))})
