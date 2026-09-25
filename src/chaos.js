import {R,PR,H,M} from './table.js'
import {BONUS_POCKET as BP,BONUS_POINTS as BPTS} from './rules.js'

// Chaos Pool: an ordinary scored game with a random twist dealt before every shot. The host deals it
// and it travels in the game state, so both players see the same one. Pure functions, so the twists
// can be tested; PoolGame applies them while the balls roll.
//
//   bonus  an extra pocket opens on a long rail for this shot, and a ball that drops in it is worth 3
//   bomb   one ball is a bomb: the first time anything hits it, it blasts the balls around it outward
//   well   a gravity well pulls balls near it toward its centre
//
// Nothing here touches the rules: points, turns and fouls are the scored game's.

export const TWISTS=['bonus','bomb','well']
export const BONUS_POCKET=BP         // its number among the pockets, after the six real ones
export const BONUS_POINTS=BPTS
export const BLAST_RADIUS=9*R,BLAST_POWER=1100
export const WELL_RADIUS=120,WELL_PULL=650

// The twist for the next shot. `balls` is the table (a bomb needs a ball to be); `rand` is injectable.
export function drawTwist(balls,rand=Math.random){
 const type=TWISTS[Math.floor(rand()*TWISTS.length)]
 if(type==='bonus'){
  // on the top or bottom rail, and well away from the corners and the middle pockets
  const spots=[[140,300],[400,560]],[lo,hi]=spots[Math.floor(rand()*2)]
  return {type,x:Math.round(lo+rand()*(hi-lo)),y:rand()<.5?M:H-M}
 }
 if(type==='bomb'){
  const objects=balls.filter(b=>b.on&&b.k!=='cue')
  if(!objects.length)return {type:'well',x:350,y:190,r:WELL_RADIUS}
  return {type,n:objects[Math.floor(rand()*objects.length)].n,spent:false}
 }
 return {type,x:Math.round(140+rand()*420),y:Math.round(100+rand()*180),r:WELL_RADIUS}
}

// The pocket a bonus twist opens, as [x,y] with the radius it pots at.
export const bonusPocket=fx=>fx&&fx.type==='bonus'?{x:fx.x,y:fx.y,r:PR*.9}:null

// A bomb going off: every other ball within the blast is kicked away from it, hard when it is close and
// gently at the edge. The bomb itself stays where it is. Returns how many balls it moved.
export function blast(balls,bomb,{radius=BLAST_RADIUS,power=BLAST_POWER}={}){
 let moved=0
 for(const b of balls){
  if(b===bomb||!b.on)continue
  const dx=b.x-bomb.x,dy=b.y-bomb.y,d=Math.hypot(dx,dy)
  if(d>=radius||d===0)continue
  const kick=power*(1-d/radius)
  b.vx+=dx/d*kick;b.vy+=dy/d*kick
  // a kicked ball skids: it starts with no spin from the blast
  moved++
 }
 return moved
}

// A gravity well pulling one ball for one step: nothing outside its radius, and more the closer in.
export function wellPull(b,fx,dt,pull=WELL_PULL){
 const dx=fx.x-b.x,dy=fx.y-b.y,d=Math.hypot(dx,dy)
 if(!(d>1)||d>=fx.r)return false
 const a=pull*(1-d/fx.r)
 b.vx+=dx/d*a*dt;b.vy+=dy/d*a*dt
 return true
}

// What a twist is called, for the HUD.
export const twistName=fx=>!fx?'':fx.type==='bonus'?'BONUS POCKET':fx.type==='bomb'?(fx.spent?'BOMB (spent)':'BOMB BALL'):fx.type==='well'?'GRAVITY WELL':''
