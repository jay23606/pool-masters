import {attempt} from './drills.js'
import {POCKETS,R,PR} from './table.js'

// The puzzle maker: a table somebody arranged (the cue ball, up to eight balls, and one ball to pot),
// proved solvable by a real search of the physics, and shared as a link. Pure functions, so a puzzle can be
// checked, solved, packed and unpacked without a screen. Puzzles are played on the drill table (7 ft).
//
// A link carries the layout and the solving shot. Opening one plays that shot through the physics again and
// refuses the puzzle if it does not pot the ball, so a link can never hold an unsolvable table, whether it
// was edited by hand or made before a physics change.

export const MAX_BALLS=8
export const BOUNDS={x0:40,x1:660,y0:40,y1:340}
export const MIN_WINDOW=.2          // degrees of aim that still work; below this it is a lottery, not a puzzle
const POWERS=[30,50,70,90]

const inField=([x,y])=>Number.isInteger(x)&&Number.isInteger(y)&&x>=BOUNDS.x0&&x<=BOUNDS.x1&&y>=BOUNDS.y0&&y<=BOUNDS.y1

// Why a layout is not a puzzle yet, or null when it is fine.
export function problem(p){
 if(!p||!Array.isArray(p.cue)||!Array.isArray(p.balls))return 'That is not a table.'
 if(!inField(p.cue))return 'The cue ball has to be on the cloth.'
 if(!p.balls.length)return 'Put at least one ball on the table.'
 if(p.balls.length>MAX_BALLS)return `No more than ${MAX_BALLS} balls.`
 const seen=new Set(),spots=[p.cue]
 for(const b of p.balls){
  if(!Array.isArray(b)||b.length!==3||!Number.isInteger(b[0])||b[0]<1||b[0]>15)return 'A ball has a bad number.'
  if(seen.has(b[0]))return 'Two balls share a number.'
  seen.add(b[0])
  if(!inField([b[1],b[2]]))return `The ${b[0]} has to be on the cloth.`
  spots.push([b[1],b[2]])
 }
 if(!seen.has(p.target))return 'Pick the ball to pot.'
 for(const s of spots)for(const k of POCKETS)if(Math.hypot(s[0]-k[0],s[1]-k[1])<PR+R)return 'Nothing can sit on a pocket.'
 for(let i=0;i<spots.length;i++)for(let j=i+1;j<spots.length;j++)if(Math.hypot(spots[i][0]-spots[j][0],spots[i][1]-spots[j][1])<2*R+.5)return 'Two balls are touching.'
 return null
}

// The drill a puzzle plays as, in the shape the practice drills use.
export const puzzleDrill=(p,hint=null)=>({id:'puzzle',puzzle:true,name:'Puzzle',level:2,
 goal:`Pot the ${p.target}. Somebody built this table, and it can be done.`,tip:'Look at what is in the way before you look at the pocket.',
 layout:{cue:p.cue,balls:p.balls},win:{pot:p.target},hint})

const normal=a=>{const t=2*Math.PI;return((a%t)+t)%t}
const quantise=shot=>({angle:Math.round(normal(shot.angle)*10000)/10000,power:shot.power,spin:[0,0]})
const angleTo=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0])

// How many degrees of aim either side still pot the ball with this shot.
export function windowDegrees(drill,shot){
 const ok=d=>attempt(drill,{...shot,angle:shot.angle+d*Math.PI/180}).ok
 let lo=0,hi=0
 while(lo>-5&&ok(lo-.05))lo-=.05
 while(hi<5&&ok(hi+.05))hi+=.05
 return Math.round((hi-lo+.05)*100)/100
}

// Every shot worth trying, most likely first: the target ball into each pocket, then a sweep of the whole circle.
function* candidates(p){
 const t=p.balls.find(b=>b[0]===p.target)
 for(const k of POCKETS){
  const u=[k[0]-t[1],k[1]-t[2]],m=Math.hypot(...u),g=[t[1]-u[0]/m*2*R,t[2]-u[1]/m*2*R]
  const base=angleTo(p.cue,g)
  for(let d=-3;d<=3;d+=.5)for(const power of POWERS)yield {angle:base+d*Math.PI/180,power,spin:[0,0]}
 }
 // combinations, banks and kicks: no pocket to aim at, so try every direction
 for(let deg=0;deg<360;deg+=1)for(const power of POWERS)yield {angle:deg*Math.PI/180,power,spin:[0,0]}
}

// The search, as a generator that yields now and then so a screen can stay alive while it runs. It finishes
// with the best shot found ({hint,window}) or null.
export function* search(p,{tries=Infinity,every=6}={}){
 const drill=puzzleDrill(p);let best=null,n=0
 for(const c of candidates(p)){
  if(n++>=tries)break
  const shot=quantise(c)
  if(attempt(drill,shot).ok){
   const w=windowDegrees(drill,shot)
   if(w>=MIN_WINDOW&&(!best||w>best.window))best={hint:shot,window:w}
  }
  if(n%every===0)yield {tried:n,best}
  // a comfortable direct shot is good enough; keep going only while it is a tight one
  if(best&&best.window>=2)break
 }
 return best
}

// Run the search to the end, within a time budget.
export function solve(p,{budgetMs=20000,now=()=>Date.now(),tries}={}){
 if(problem(p))return null
 const t0=now(),it=search(p,{tries})
 for(;;){
  const r=it.next()
  if(r.done)return r.value
  if(now()-t0>budgetMs)return r.value.best
 }
}

// Does this shot really pot the ball on this table?
export const proves=(p,hint)=>Boolean(hint)&&Number.isFinite(hint.angle)&&hint.power>=1&&hint.power<=100&&attempt(puzzleDrill(p),hint).ok

// ---- links ----
const VERSION='v1'
export function encode(p,hint){
 const balls=p.balls.map(b=>b.join('-')).join('_')
 return [VERSION,p.target,p.cue[0],p.cue[1],Math.round(normal(hint.angle)*10000),hint.power,balls].join('_')
}

export const MAX_LINK=400

// A puzzle from a link, or null if it is malformed, unreasonable, or does not actually work.
export function decode(str){
 if(typeof str!=='string'||str.length>MAX_LINK||!/^[v0-9_-]+$/.test(str))return null
 const f=str.split('_');if(f[0]!==VERSION||f.length<7||f.length>6+MAX_BALLS)return null
 const num=s=>/^\d{1,6}$/.test(s)?Number(s):NaN
 const [,t,cx,cy,ang,pow]=f.slice(0,6).map((s,i)=>i?num(s):s)
 const balls=[]
 for(const s of f.slice(6)){const q=s.split('-').map(num);if(q.length!==3)return null;balls.push(q)}
 if([t,cx,cy,ang,pow].some(Number.isNaN)||ang>62832||pow<1||pow>100)return null
 const p={cue:[cx,cy],balls,target:t}
 if(problem(p))return null
 const hint={angle:ang/10000,power:pow,spin:[0,0]}
 return proves(p,hint)?{puzzle:p,hint}:null
}
