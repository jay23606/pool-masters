import {TRICKS} from './tricks-data.js'

// Curated trick shots: a small table that one shot clears completely. Every one was found by tools/gen-tricks.mjs,
// which searches the real physics, and is picked and named by tools/build-tricks.mjs; the tests run each shot
// through the physics again, so a physics change that breaks one fails the build. They play as drills (Show me
// plays the proven shot), on the 7 ft table the shots were found on.

export {TRICKS}

const LEVEL={2:1,3:2,4:3}
export const trickDrill=(t,i)=>({id:t.id,trick:true,name:t.name,level:LEVEL[t.balls.length]||3,
 goal:`Pot all ${t.balls.length} balls with one shot.`,
 tip:t.balls.length===2?'One ball has to carry another in. Work out which way each will go.':'Every ball has to drop from this one shot. If it will not come, use Show me and watch how the balls run.',
 layout:{cue:t.cue,balls:t.balls},win:{clear:true},hint:t.hint,index:i})

export const TRICK_DRILLS=TRICKS.map(trickDrill)
export const trickById=id=>TRICK_DRILLS.find(d=>d.id===id)||null
export const isTrick=id=>typeof id==='string'&&id.startsWith('trick-')
export const nextTrick=id=>{const i=TRICK_DRILLS.findIndex(d=>d.id===id);return i>=0&&i<TRICK_DRILLS.length-1?TRICK_DRILLS[i+1]:null}
export const tricksDone=progress=>TRICK_DRILLS.filter(d=>progress?.[d.id]?.done).length
