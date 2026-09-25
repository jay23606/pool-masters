import {kind,rack} from './rules.js'
import {rollout} from './ai.js'

// Practice drills: a fixed layout, one shot, and a rule for whether it worked.
//
// Everything here is plain data plus two pure functions, so a drill can be
// judged, solved and tested without a game, a renderer or a screen. Every
// drill also carries a hint -- a shot known to solve it -- and the tests run
// that shot through the real physics, so a drill that cannot be solved, or
// that stops being solvable after a physics change, fails the build instead of
// reaching a player.
//
// Table coordinates: 700 x 380, the cushions' inner edge at x 37..663 and
// y 37..343. Pockets, by index: 0 top-left, 1 top-middle, 2 top-right,
// 3 bottom-left, 4 bottom-middle, 5 bottom-right.
//
// `win` says what counts:
//   pot      a ball that must drop         pocket  the pocket it must drop in
//   first    the ball the cue must hit first
//   bank     the potted ball must touch a cushion on its way
//   kick     the cue ball must touch a cushion before it touches a ball
//   zone     {x,y,r} the cue ball must finish inside this circle
//   anyPot   any ball at all must drop
// and a scratch always fails.

// Every drill, and every daily shot, is worked out and proven on the 7 ft table. A bigger table has
// smaller balls and pockets, so the same layout needs a different shot: the game plays drills on this
// table whatever the player's own setting is.
export const DRILL_TABLE=7

const ball=(n,x,y)=>({id:n,n,x,y,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:n===0?'cue':kind(n)})

export const DRILLS=[
 {id:'straight-in',name:'Straight in',level:1,
  goal:'Pot the 1 in the top-middle pocket.',
  tip:'Aim through the middle of the ball at the middle of the pocket. A smooth stroke beats a hard one.',
  layout:{cue:[350,260],balls:[[1,350,150]]},win:{pot:1,pocket:1}},

 {id:'side-cut',name:'Cut into the side',level:1,
  goal:'Pot the 2 in the bottom-middle pocket.',
  tip:'Aim at the point on the far side of the ball that sends it toward the pocket. The thinner the cut, the further the ball leaves the line you hit it on.',
  layout:{cue:[220,180],balls:[[2,300,260]]},win:{pot:2,pocket:4}},

 {id:'across-the-table',name:'Across the table',level:1,
  goal:'Pot the 3 in the top-middle pocket from the far side.',
  tip:'The cue ball has some way to travel, so keep the stroke straight and the aim steady.',
  layout:{cue:[560,220],balls:[[3,400,100]]},win:{pot:3,pocket:1}},

 {id:'corner-cut',name:'Cut into the corner',level:2,
  goal:'Pot the 4 in the top-right corner.',
  tip:'Corner pockets are small targets: aim for the very centre of the pocket, not the edge of it.',
  layout:{cue:[380,260],balls:[[4,600,70]]},win:{pot:4,pocket:2}},

 {id:'combination',name:'Combination',level:2,
  goal:'Hit the 1 first, and pot the 2 in the top-middle pocket with it.',
  tip:'The 1 is the cue ball for the 2 now. Aim the 1 where you want the 2 to go.',
  layout:{cue:[350,320],balls:[[1,350,215],[2,350,125]]},win:{first:1,pot:2,pocket:1}},

 {id:'stop-shot',name:'Stop shot',level:2,
  goal:'Pot the 5 in the top-middle pocket and leave the cue ball where the 5 was.',
  tip:'A dead-centre hit with no spin and just enough speed stops the cue ball on the spot.',
  layout:{cue:[350,300],balls:[[5,350,170]]},win:{pot:5,pocket:1,zone:{x:350,y:186,r:26}}},

 {id:'break',name:'The break',level:2,
  goal:'Break the rack and drop at least one ball without scratching.',
  tip:'Hit the head ball square. Full power with no spin sends the cue ball straight back into a pocket: about three-quarters power keeps it under control.',
  layout:{rack:'8ball'},win:{anyPot:true}},

 {id:'draw-back',name:'Draw shot',level:3,
  goal:'Pot the 6 in the top-middle pocket and bring the cue ball back toward where you started.',
  tip:'Hit the cue ball below centre. Set the dial at the bottom, and hit it firmly.',
  layout:{cue:[350,300],balls:[[6,350,170]]},win:{pot:6,pocket:1,zone:{x:350,y:262,r:40}}},

 {id:'follow-through',name:'Follow shot',level:3,
  goal:'Pot the 7 in the top-middle pocket and follow the cue ball on toward the head of the table.',
  tip:'Hit the cue ball above centre and it keeps rolling after it meets the ball.',
  layout:{cue:[350,300],balls:[[7,350,200]]},win:{pot:7,pocket:1,zone:{x:350,y:130,r:34}}},

 {id:'bank-shot',name:'Bank shot',level:3,
  goal:'Pot the 9 in the bottom-middle pocket by banking it off a cushion.',
  tip:'Find the point on the cushion the ball has to hit. Aim the object ball at the mirror image of the pocket.',
  layout:{cue:[300,300],balls:[[9,260,110]]},win:{pot:9,pocket:4,bank:true}},

 {id:'kick-shot',name:'Kick shot',level:3,
  goal:'The 1 is hidden behind the 4. Kick the cue ball off a cushion first, then pot the 1 in the bottom-middle pocket.',
  tip:'When there is no straight line to a ball, bounce the cue ball off a cushion to reach it.',
  layout:{cue:[520,200],balls:[[1,180,250],[4,350,225]]},win:{pot:1,pocket:4,kick:true}},
]

// The table a drill starts on.
export const buildBalls=d=>d.layout.rack?rack(d.layout.rack):[ball(0,...d.layout.cue),...d.layout.balls.map(([n,x,y])=>ball(n,x,y))]

// Why a shot failed, in a sentence a player can use.
export const REASONS={
 scratch:'Scratch: the cue ball dropped.',
 missed:'Not this time.',
 'wrong-pocket':'It dropped, but in the wrong pocket.',
 'no-bank':'It dropped without touching a cushion; this one is a bank.',
 'no-kick':'The cue ball has to touch a cushion before it touches a ball.',
 'wrong-first':'The cue ball hit the wrong ball first.',
 position:'Potted it, but the cue ball finished in the wrong place.',
}

// What a shot did, in the shape evaluate() wants. The game and the rollout both
// produce this, so the two cannot disagree about what counts.
export const resultOf=r=>({
 scratch:r.scratch,first:r.firstHit?r.firstHit.n:null,cueRailFirst:r.cueRailFirst,
 potted:r.potted,pockets:r.pockets,railBalls:r.railBalls,cue:r.cue})

export function evaluate(drill,r){
 const w=drill.win
 if(r.scratch)return {ok:false,reason:'scratch'}
 if(w.first!=null&&r.first!==w.first)return {ok:false,reason:'wrong-first'}
 if(w.kick&&!r.cueRailFirst)return {ok:false,reason:'no-kick'}
 if(w.pot!=null){
  if(!r.potted.includes(w.pot))return {ok:false,reason:'missed'}
  if(w.pocket!=null&&r.pockets[w.pot]!==w.pocket)return {ok:false,reason:'wrong-pocket'}
  if(w.bank&&!r.railBalls.includes(w.pot))return {ok:false,reason:'no-bank'}
 }
 if(w.anyPot&&!r.potted.length)return {ok:false,reason:'missed'}
 if(w.zone&&(!r.cue.on||Math.hypot(r.cue.x-w.zone.x,r.cue.y-w.zone.y)>w.zone.r))return {ok:false,reason:'position'}
 return {ok:true}
}

// Try a shot on a drill's table with the real physics and judge it.
export function attempt(drill,shot){
 const out=rollout(buildBalls(drill),shot.angle,shot.power,10,shot.spin||[0,0])
 return {...evaluate(drill,resultOf(out)),result:out}
}

// A shot known to solve each drill. Generated by tools/solve-drills.mjs, which
// searches with the real physics and prefers the most robust solution; the tests
// run every one of these through the physics again, so if a change to the
// physics or a layout breaks one, that fails the build. Re-run the tool then.
export const HINTS={
  'straight-in':{angle:4.6897,power:50,spin:[0,0]},   // window 3.55°, 100% robust
  'side-cut':{angle:0.7103,power:50,spin:[0,0]},   // window 3.25°, 100% robust
  'across-the-table':{angle:1.9775,power:50,spin:[0,0]},   // window 1°, 100% robust
  'corner-cut':{angle:5.5554,power:80,spin:[0,0]},   // window 0.9°, 100% robust
  'combination':{angle:4.7072,power:50,spin:[0,0]},   // window 1.45°, 100% robust
  'stop-shot':{angle:4.7124,power:50,spin:[0,0]},   // window 0.75°, 100% robust
  'draw-back':{angle:4.7072,power:40,spin:[0,-0.25]},   // window 1.35°, 100% robust
  'follow-through':{angle:4.7002,power:20,spin:[0,0.45]},   // window 2.15°, 78% robust
  'bank-shot':{angle:4.4558,power:60,spin:[0,0.25]},   // window 0.6°, 78% robust
  'kick-shot':{angle:2.4958,power:100,spin:[0,0]},   // window 0.25°, 56% robust
  // chosen by hand: the solver preferred a slightly off-centre aim, but the lesson is a square hit at about three-quarters power
  'break':{angle:0,power:72,spin:[0,0]},
}
for(const d of DRILLS)d.hint=HINTS[d.id]||null

// ---- progress ----
// What a player has done, kept in the browser. Pure, so it can be tested. The
// best is the fewest attempts a drill was ever solved in *without the hint*: a
// solve the game aimed for you completes the drill but does not set a record.

export const emptyProgress=()=>({})

export function recordDrill(progress,id,{ok,attempts,hinted=false}){
 const cur=progress?.[id]||{tries:0,done:false,best:null}
 const clean=Boolean(ok)&&!hinted
 return {...progress,[id]:{
  tries:cur.tries+1,
  done:cur.done||Boolean(ok),
  best:clean?(cur.best==null?attempts:Math.min(cur.best,attempts)):cur.best}}
}

export const doneCount=progress=>DRILLS.filter(d=>progress?.[d.id]?.done).length

// The drill after this one, or null at the end of the list.
export const nextDrill=id=>{const i=DRILLS.findIndex(d=>d.id===id);return i>=0&&i<DRILLS.length-1?DRILLS[i+1]:null}
