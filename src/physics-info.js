import * as physics from './physics.js'
import {TABLE_SIZES} from './table.js'
import {STEP} from './predict.js'

// A read-only description of the simulation's constants, for the Physics panel.
// The values are read from physics.js when asked for, never copied, so the panel
// cannot disagree with the game; a test fails if a constant is added there and not
// described here.

export const MM_PER_UNIT=4.06   // see the note at the top of physics.js

export const GROUPS=['Balls and cloth','Cushions','Shot','Simulation']

export const CONSTANTS=[
 {key:'G',group:'Balls and cloth',name:'Gravity',unit:'units/s²',note:'Sets how hard the cloth grips a ball; friction is proportional to it.'},
 {key:'MU_SLIDE',group:'Balls and cloth',name:'Sliding friction',unit:'',note:'Cloth friction while a ball is skidding, before it grips. It is what makes draw and follow work.'},
 {key:'MU_ROLL',group:'Balls and cloth',name:'Rolling resistance',unit:'',note:'Slows a ball that is rolling cleanly, so it eventually stops.'},
 {key:'SPIN_DECAY',group:'Balls and cloth',name:'English decay',unit:'rad/s²',note:'How fast sidespin (about the vertical axis) dies away.'},
 {key:'SLIP_EPS',group:'Balls and cloth',name:'Rolling threshold',unit:'units/s',note:'Below this slip speed a ball counts as rolling rather than skidding.'},
 {key:'MU_BALL',group:'Balls and cloth',name:'Ball-on-ball friction',unit:'',note:'Friction between two balls in contact; it is what causes throw on a cut shot.'},
 {key:'E_BALL',group:'Balls and cloth',name:'Ball restitution',unit:'',note:'How much speed two balls keep when they collide (1 would be perfectly elastic).'},
 {key:'MU_CUSHION',group:'Cushions',name:'Cushion friction',unit:'',note:'Friction against a cushion, which is how sidespin changes the angle a ball leaves at.'},
 {key:'REST_SPEED',group:'Simulation',name:'Rest threshold',unit:'units/s',note:'A ball slower than this, in both motion and slip, counts as stopped.'},
]

const raw=key=>physics[key]
export const valueOf=c=>raw(c.key)

// Two decimals is plenty for anything here; trailing zeros only add noise.
export const format=v=>Number.isInteger(v)?String(v):String(Number(v.toFixed(3)))

// The power slider mapped to launch speed, in the game's units and in real ones.
export const POWERS=[10,25,50,75,100]
export const shotTable=()=>POWERS.map(p=>{const s=physics.shotSpeed(p);return {power:p,speed:s,ms:s*MM_PER_UNIT/1000}})

// What changes with the table size.
export const tables=()=>Object.entries(TABLE_SIZES).map(([size,t])=>({size:Number(size),label:t.label,ball:t.radius,pocket:Number((t.radius*2.1).toFixed(1))}))

// Facts about the loop rather than the material.
export const simulation=()=>[
 {name:'Fixed step',value:`1/${Math.round(1/STEP)} s`,note:'The simulation always advances in steps this long, so frame rate cannot change a shot.'},
 {name:'Substeps',value:'4 – 64',note:'Each step is split so that nothing moves more than a quarter of a ball radius at a time.'},
 {name:'Length of a unit',value:`${MM_PER_UNIT} mm`,note:'The table is 700 × 380 units; a full-power break leaves the cue ball at about 13 m/s.'},
]
