// Pull back to shoot: press on the cue ball, drag away from it like drawing a bow,
// release to fire. The shot goes the opposite way to the pull, and its power is
// how far the pull is. Pure, so the arithmetic can be tested without a screen.

export const GRAB=26      // table units around the cue ball that start a pull
export const DEAD=9       // a pull shorter than this is a cancel, not a shot
export const FULL=170     // the pull that means full power

export const grabs=(cue,p)=>Math.hypot(p.x-cue.x,p.y-cue.y)<=GRAB

// What the pointer at p means for a pull that started on the cue ball.
// {armed:false} inside the dead zone: nothing to fire, and letting go cancels.
export function pull(cue,p){
 const dx=cue.x-p.x,dy=cue.y-p.y,d=Math.hypot(dx,dy)
 if(d<DEAD)return {armed:false,power:0,angle:0,distance:d}
 return {armed:true,angle:Math.atan2(dy,dx),power:Math.max(1,Math.min(100,Math.round(d/FULL*100))),distance:d}
}
