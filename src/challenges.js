import {R,PR,POCKETS} from './table.js'

// Challenge games: short, scored, solo. A table of balls, a rule for what a shot is worth, and a
// rule for when it ends. Pure functions over plain state, so all of it can be tested; PoolGame
// plays them and main.js keeps the best scores in the browser.
//
//   Speed Pot        pot as many as you can in 60 seconds; the clock starts with your first shot
//   Perfect Potter   pot a ball with every shot: the first shot that drops nothing ends the run
//   Clear the Table  pot all seven as fast as you can; every scratch costs five seconds

export const CHALLENGES=[
 {id:'speed',name:'Speed Pot',balls:8,seconds:60,higher:true,unit:'balls',
  blurb:'Pot as many balls as you can in 60 seconds. The clock starts with your first shot. A scratch puts the cue ball back, and balls that drop on it do not count.'},
 {id:'perfect',name:'Perfect Potter',balls:6,higher:true,unit:'in a row',
  blurb:'Pot a ball with every shot. The first shot that drops nothing, or scratches, ends the run. The table refills when you clear it.'},
 {id:'clear',name:'Clear the Table',balls:7,higher:false,unit:'',penaltyMs:5000,
  blurb:'Pot all seven balls as fast as you can. The clock starts with your first shot, and every scratch adds five seconds.'}
]
export const byId=id=>CHALLENGES.find(c=>c.id===id)||null

// Ball numbers a scatter may use: never the 8, which has rules of its own in the game.
export const NUMBERS=[1,2,3,4,5,6,7,9,10,11,12,13,14,15]
export const HEAD_SPOT={x:154,y:190}

// Where a scatter of balls may sit: off the cushions, apart from each other and the cue ball, and
// clear of the pockets (a ball beside a pocket is not a shot, it is a gift).
const X0=70,X1=630,Y0=70,Y1=310

// `count` balls at random legal places. `avoid` are spots already taken (the cue ball). `rand` is
// injectable so a test can use a fixed sequence.
export function scatter(count,avoid=[],rand=Math.random){
 const placed=[...avoid.map(p=>({x:p.x,y:p.y}))],out=[]
 const nums=[...NUMBERS].sort(()=>rand()-.5)
 for(let n=0;n<count;n++){
  let p=null
  for(let tries=0;tries<400&&!p;tries++){
   const c={x:X0+rand()*(X1-X0),y:Y0+rand()*(Y1-Y0)}
   if(placed.every(q=>Math.hypot(q.x-c.x,q.y-c.y)>R*3.4)&&POCKETS.every(k=>Math.hypot(k[0]-c.x,k[1]-c.y)>PR*3))p=c
  }
  if(!p)break
  placed.push(p);out.push({n:nums[n],x:Math.round(p.x),y:Math.round(p.y)})
 }
 return out
}

// ---- playing one ----

export const begin=id=>({id,score:0,startedAt:null,penalties:0,over:false,final:null})

// The clock starts with the first shot, and never again.
export const startClock=(c,now)=>c.startedAt==null?{...c,startedAt:now}:c

// Milliseconds on the clock: for the timed games, how long since the first shot (0 before it).
export const elapsed=(c,now)=>c.startedAt==null?0:Math.max(0,now-c.startedAt)
export const timeLeft=(c,now)=>{const d=byId(c.id);return d.seconds?Math.max(0,d.seconds*1000-elapsed(c,now)):null}
export const clearTime=(c,now)=>elapsed(c,now)+c.penalties*(byId('clear').penaltyMs)

// True when a timed game has run out of time.
export const timedOut=(c,now)=>Boolean(byId(c.id).seconds)&&c.startedAt!=null&&timeLeft(c,now)===0

// What one finished shot did. `shot` is {potted:[ball numbers], scratch, left} (`left` is how many
// object balls are still on the table after it). Returns the new state and what to do about it:
//   respotCue  put the cue ball back on the head spot (after a scratch)
//   refill     the table is clear and the game goes on: put out a fresh scatter
//   over       the game has ended, with the state's `final` score
export function judge(c,shot,now){
 if(c.over)return {state:c,respotCue:false,refill:false,over:true}
 const potted=shot.potted||[],cleared=shot.left===0
 let s={...c},refill=false,over=false
 if(c.id==='speed'){
  s.score+=shot.scratch?0:potted.length
  over=timedOut(s,now)
  refill=cleared&&!over
 }else if(c.id==='perfect'){
  const good=!shot.scratch&&potted.length>0
  if(good)s.score+=1;else over=true
  refill=cleared&&!over
 }else{
  if(shot.scratch)s.penalties+=1
  if(cleared)over=true
 }
 if(over){s.over=true;s.final=c.id==='clear'?clearTime(s,now):s.score}
 return {state:s,respotCue:Boolean(shot.scratch),refill,over}
}

// Finish a timed game that ran out of time between shots.
export function timeUp(c){return c.over?c:{...c,over:true,final:c.score}}

// ---- results ----

export const emptyResults=()=>({})

export function isBetter(id,score,best){
 if(best==null)return true
 return byId(id).higher?score>best:score<best
}

// Record a finished game. Returns {results,newBest,best}; never lowers a best.
export function record(results,id,score){
 const old=results?.[id]?.best,newBest=isBetter(id,score,old)
 return {results:{...results,[id]:{best:newBest?score:old,plays:(results?.[id]?.plays||0)+1}},newBest,best:newBest?score:old}
}

export function format(id,score){
 if(score==null)return '–'
 if(id==='clear')return `${(score/1000).toFixed(1)} s`
 return String(score)
}
