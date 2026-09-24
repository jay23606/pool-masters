import {integrate,railBounce,ballCollide,substeps} from './physics.js'
import {POCKETS,PR} from './table.js'

// A ball's motion, and nothing else. The host's own sub() runs this same
// physics but also decides what a shot MEANS -- who fouled, what got potted,
// whose turn is next. That adjudication has to stay host-only and singular;
// this file exists so a client (or a spectator, or eventually a replay) can
// run the same trajectory for smooth, physically correct rendering between
// the host's periodic corrections, without ever being asked to rule on
// anything. It only ever touches position, velocity and spin.
//
// STEP/CATCHUP are exported from here, not from pool.js, so the host's own
// authoritative stepping and this cosmetic stepping are structurally unable
// to drift apart onto different granularities.
export const STEP=1/120       // fixed simulation step, so frame pacing cannot change a shot
export const CATCHUP=3        // never make up more than this much time in one go

export function stepCosmetic(balls,dt){
 for(const b of balls){
  if(!b.on)continue
  integrate(b,dt)
  for(const q of POCKETS)if(Math.hypot(b.x-q[0],b.y-q[1])<PR){b.on=false;break}
  if(b.on)railBounce(b)
 }
 for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
  const a=balls[i],c=balls[j]
  if(a.on&&c.on)ballCollide(a,c)
 }
}

// A minimal accumulator, structurally identical to PoolGame's own advance():
// fixed-size STEP chunks, each with as many adaptive substeps as the current
// speed demands, so a fast-moving ball can't tunnel through a thin gap here
// any more than it can under host-authoritative stepping.
export function createPredictor(){
 let acc=0,at=null
 return {
  // Replace the predicted balls and the accumulator's clock with a fresh,
  // trusted anchor -- called whenever an authoritative update arrives, so
  // drift can never accumulate past one inter-update interval.
  reset(now){acc=0;at=now},
  advance(balls,now,everyStep){
   if(at==null){at=now;return}
   let dt=(now-at)/1000;at=now
   if(!(dt>0))return
   dt=Math.min(dt,CATCHUP)
   acc+=dt
   while(acc>=STEP){
    const n=substeps(balls,STEP)
    for(let i=0;i<n;i++)stepCosmetic(balls,STEP/n)
    acc-=STEP
    everyStep?.()
   }
  }
 }
}
