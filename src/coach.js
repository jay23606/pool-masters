import {rollout,chooseShot,foulReason} from './ai.js'
import {createRecorder} from './replay.js'
import {normalizeGroup,isScoreMode,ONE_POCKET} from './rules.js'
import {tableSize} from './table.js'

// The shot coach. From the table as it stood before a shot, it plays the shot that was
// taken out on a copy, plays out the best shot the AI can find, and says how they compare.
//
// All of it is plain arithmetic over ball arrays, so it runs without a screen, and the same
// table always gets the same answer: the coach has no aim error, and the "how often does it
// work" trials use a fixed pseudo-random sequence.

export const TRIALS=16
export const AIM_SIGMA=.25      // degrees of aim wobble a steady player has
export const POWER_SIGMA=3      // and percent of power

const POCKET_NAMES=['top left','top middle','top right','bottom left','bottom middle','bottom right']
export const pocketName=i=>POCKET_NAMES[i]||'a pocket'

function prng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
const gauss=r=>Math.sqrt(-2*Math.log(1-r()))*Math.cos(2*Math.PI*r())

const clone=balls=>balls.map(b=>({...b}))

// Play a shot out and describe it: what dropped, what was hit first, whether it fouled.
export function play(before,shot,group,mode,player='a'){
 const r=rollout(clone(before),shot.angle,shot.power,10,shot.spin||[0,0])
 const pot=r.potted[0]!=null?r.potted[0]:null
 return {potted:r.potted,pockets:r.pockets,firstHit:r.firstHit?r.firstHit.n:null,scratch:r.scratch,
  foul:foulReason(before,r,normalizeGroup(group),mode),pot,pocket:pot!=null?r.pockets[pot]:null,mode,
  // the balls that scored: in the scored games a ball that dropped the wrong way is no use
  counted:!isScoreMode(mode)?r.potted:r.potted.filter(n=>mode==='bank'?r.railBalls.includes(n):r.pockets[n]===ONE_POCKET[player])}
}

// How often a shot like this one works for a steady player: aim and power wobbled a little
// around it, counting the tries that drop something without fouling.
export function chance(before,shot,group,mode,player='a'){
 const rand=prng(Math.round((shot.angle+10)*1e5)^Math.round(shot.power*1000))
 let ok=0
 for(let i=0;i<TRIALS;i++){
  const t={angle:shot.angle+gauss(rand)*AIM_SIGMA*Math.PI/180,power:Math.max(5,Math.min(100,shot.power+gauss(rand)*POWER_SIGMA)),spin:shot.spin}
  const p=play(before,t,group,mode,player)
  if(!p.foul&&p.counted.length)ok++
 }
 return ok/TRIALS
}

// The coach's own shot from these balls: null when there is nothing legal to hit.
export function coachShot(before,group,mode,player='a'){
 // The AI breaks ties and searches for escapes with Math.random; the coach must give the
 // same answer for the same table, so it draws from a fixed sequence while it thinks.
 const real=Math.random
 Math.random=prng(20260101)
 try{
  const plan=chooseShot(clone(before),normalizeGroup(group),false,'coach',mode,{player})
  return plan?{angle:plan.angle,power:plan.power,spin:[0,0]}:null
 }finally{Math.random=real}
}

const REASONS={
 scratch:'the cue ball went into a pocket',
 'no-contact':'the cue ball did not hit anything',
 'wrong-first':'the cue ball hit the wrong ball first',
 'no-rail':'after the first contact nothing reached a cushion',
 'early-8':'the 8 dropped before it was yours'
}
export const reasonText=r=>REASONS[r]||'that was not a legal shot'
const list=ns=>ns.length<3?ns.map(n=>`the ${n}`).join(' and '):`${ns.slice(0,-1).map(n=>`the ${n}`).join(', ')} and the ${ns[ns.length-1]}`
// 16 trials cannot honestly say 100%, so the top of the scale is worded as what it is
const rate=x=>x>=.95?'almost every time':`about ${Math.round(x*100)}% of the time`

// The words. `yours` and `best` are what play() and chance() gave; best may be null.
export function describe(yours,best){
 const steadier=best&&best.chance>yours.chance+.2
 const aim=b=>b.pot!=null?`the ${b.pot} into the ${pocketName(b.pocket)} pocket`:'a safe shot'
 const coachLine=best?(best.pot!=null?`The coach would have played ${aim(best)}, which works ${rate(best.chance)}.`:'There was no good pot on, so the coach would have played safe.'):''
 if(yours.foul)return {verdict:'foul',headline:`That was a foul: ${reasonText(yours.foul)}.`,detail:coachLine}
 const counted=yours.counted||yours.potted    // hand-built results in tests may not say
 if(yours.potted.length&&!counted.length){
  const rule=yours.mode==='bank'?'In bank pool a ball has to touch a cushion on its way.':'In one-pocket a ball has to go in your own pocket.'
  return {verdict:'miss',headline:`${list(yours.potted)[0].toUpperCase()+list(yours.potted).slice(1)} dropped, but it did not count.`,detail:`${rule} ${coachLine}`.trim()}
 }
 if(yours.potted.length){
  const good=yours.chance>=.6
  const same=best&&best.pot===yours.pot&&best.pocket===yours.pocket
  return {verdict:good?'great':'good',
   headline:`You potted ${list(yours.potted)}.`,
   detail:`A shot like that works ${rate(yours.chance)}.`+(steadier?` ${coachLine}`:same?' The coach would have played the same shot.':'')}
 }
 return {verdict:'miss',headline:'It did not drop.',detail:coachLine||'There was nothing legal to play.'}
}

// Everything for one shot: `before` is the balls as they stood, shot is {angle,power,spin}.
// A break has no pot worth comparing to, so it is only described.
export function analyse({before,shot,group,mode,breakShot=false,player='a'}){
 const y=play(before,shot,group,mode,player)
 const yours={...y,chance:y.foul?0:chance(before,shot,group,mode,player),shot}
 const cs=breakShot?null:coachShot(before,group,mode,player)
 let best=null
 if(cs){const b=play(before,cs,group,mode,player);best={...b,chance:b.foul?0:chance(before,cs,group,mode,player),shot:cs}}
 return {yours,best,...describe(yours,best)}
}

// A shot as a replay, so the coach's shot can be watched on the same table with the same
// player as any other: positions every 40ms, exactly what the host would have broadcast.
export function replayOf(before,shot,mode){
 const rec=createRecorder(mode,tableSize)
 let next=0
 const bs=clone(before)
 rec.frame(0,bs)
 rollout(bs,shot.angle,shot.power,10,shot.spin||[0,0],(state,t)=>{if(t*1000>=next+40){next+=40;rec.frame(next,state)}})
 return rec.finish()
}
