import {scatter,HEAD_SPOT} from './challenges.js'

// Rogue Pool: a solo run of tables, each harder than the last. Clear a table within its shots to move on
// and take one of three random upgrades; run out of shots and you lose a life; lose them all and the run
// is over. Pure functions over plain state, so all of it can be tested; PoolGame plays it, and main.js
// keeps the best run in the browser.

export const START_LIVES=3

// The upgrades on offer. `max` is how many times one can be taken.
export const UPGRADES=[
 {id:'pockets',name:'Wide pockets',desc:'Every pocket is 15% wider.',max:3},
 {id:'shots',name:'Extra shots',desc:'Two more shots on every table.',max:3},
 {id:'life',name:'Extra life',desc:'One more life, straight away.',max:9},
 {id:'jump',name:'Jump charges',desc:'Two jump shots on every table (the Jump button appears).',max:3},
 {id:'shield',name:'Scratch shield',desc:'The first scratch on each table costs nothing extra.',max:1},
 {id:'wind',name:'Second wind',desc:'The first miss on each table does not use a shot.',max:2}
]
export const upgradeById=id=>UPGRADES.find(u=>u.id===id)||null

export const POCKET_BOOST=.15

// A small seeded generator, so the same run is the same run. Anything random in a run comes from here.
export function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}

// How many balls a table has, and how many shots to clear it. Tables grow and the slack shrinks.
export function levelSpec(level,upgrades={}){
 const balls=Math.min(9,3+Math.ceil(level/1.5))
 const slack=Math.max(1,3-Math.floor((level-1)/3))
 return {balls,shots:balls+slack+2*(upgrades.shots||0)}
}

const startTable=(run,level,rand)=>{
 const spec=levelSpec(level,run.upgrades)
 return {...run,level,shotsLeft:spec.shots,jumps:2*(run.upgrades.jump||0),shield:(run.upgrades.shield||0)>0,wind:run.upgrades.wind||0,
  layout:scatter(spec.balls,[HEAD_SPOT],rand),over:false}
}

// A new run. `seed` fixes every random choice in it.
export function newRun(seed=Date.now()){
 return startTable({seed,level:1,lives:START_LIVES,upgrades:{},cleared:0,score:0,over:false},1,rng(seed*7919+1))
}

// The table for a level in a run, always the same for the same run and level and attempt.
const tableRand=(run,attempt=0)=>rng(run.seed*7919+run.level*131+attempt*17+1)

// Three different upgrades the run can still take, chosen the same way every time for the same run.
export function offer(run,count=3){
 const rand=rng(run.seed*104729+run.level*31+7)
 const open=UPGRADES.filter(u=>(run.upgrades[u.id]||0)<u.max)
 const out=[]
 while(out.length<count&&open.length){out.push(open.splice(Math.floor(rand()*open.length),1)[0])}
 return out
}

// Take an upgrade and begin the next table.
export function choose(run,id){
 const u=upgradeById(id)
 if(!u||(run.upgrades[id]||0)>=u.max)return run
 const next={...run,upgrades:{...run.upgrades,[id]:(run.upgrades[id]||0)+1}}
 if(id==='life')next.lives=run.lives+1
 return startTable(next,run.level+1,tableRand({...next,level:run.level+1}))
}

// The next table with nothing taken: for a run that has every upgrade it can have, and so has nothing left to be offered.
export function advance(run){return startTable(run,run.level+1,tableRand({...run,level:run.level+1}))}

// Playing one table again after it was lost: the same size, fresh balls.
const retryTable=(run)=>startTable(run,run.level,tableRand(run,run.lives))

// What one finished shot did. `shot` is {potted:number of balls, scratch, left, jumped}. Returns the new run and
// what happened: 'cleared' (the table is empty), 'life' (out of shots, a life gone, the table again), 'over' (out
// of lives), or null. `respotCue` asks for the cue ball back on the head spot.
export function judge(run,shot){
 if(run.over)return {run,event:null,respotCue:false}
 let r={...run}
 if(shot.jumped)r.jumps=Math.max(0,r.jumps-1)
 const missed=shot.potted===0&&!shot.scratch
 let cost=1
 if(missed&&r.wind>0){r.wind-=1;cost=0}
 if(shot.scratch){if(r.shield)r.shield=false;else cost+=1}
 r.shotsLeft=Math.max(0,r.shotsLeft-cost)
 r.score+=shot.scratch?0:shot.potted
 if(shot.left===0){r.cleared=run.level;return {run:r,event:'cleared',respotCue:Boolean(shot.scratch)}}
 if(r.shotsLeft>0)return {run:r,event:null,respotCue:Boolean(shot.scratch)}
 r.lives-=1
 if(r.lives<=0){r.over=true;return {run:r,event:'over',respotCue:false}}
 return {run:retryTable(r),event:'life',respotCue:false}
}

// The result of a run, for the record: how many tables were cleared.
export const tablesCleared=run=>run.cleared||0

export const emptyRecord=()=>({best:0,runs:0})
export function record(rec,run){
 const cleared=tablesCleared(run),old=rec?.best||0
 return {rec:{best:Math.max(old,cleared),runs:(rec?.runs||0)+1},newBest:cleared>old}
}
