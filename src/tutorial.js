// The first-run tutorial: five short steps, each one an ordinary drill with a plain explanation of the control it
// teaches, so a new player learns the game by doing it. Pure data and a few helpers; main.js plays the steps as drills.

export const STEPS=[
 {drill:'straight-in',title:'Aim and shoot',
  text:'Drag on the table to turn the cue. The dotted line shows where the ball will go: point it at the yellow ball and the pocket, then press Shoot (or Space).'},
 {drill:'across-the-table',title:'Power',
  text:'The Power slider is how hard you hit. Harder is faster but harder to control. This ball is a long way off, so try about half power.'},
 {drill:'side-cut',title:'Cutting a ball',
  text:'You rarely hit a ball straight on. Aim at the far edge of it to send it off at an angle toward the pocket; the second line shows where it will travel.'},
 {drill:'stop-shot',title:'Spin',
  text:'The white circle beside Shoot is the cue ball. Tap low on it for backspin, high for follow-through. Here, hit low and centre so the cue ball stops where the yellow ball was.'},
 {drill:'bank-shot',title:'Bank shots',
  text:'A ball can bounce off a cushion. Aim the ball at the rail, not at the pocket; the bent line shows the bank. Stuck? Press Show me.'}
]

export const DONE_KEY='pool-masters:tutorial'
export const stepAt=i=>Number.isInteger(i)&&i>=0&&i<STEPS.length?STEPS[i]:null
export const hasNext=i=>Number.isInteger(i)&&i>=0&&i<STEPS.length-1
export const label=i=>`TUTORIAL ${i+1} OF ${STEPS.length}`

// Whether to offer the tutorial to someone: only until they have done it or said no.
export const shouldOffer=stored=>stored==null||stored===''

// A drill, dressed as a tutorial step: the same layout, rule and hint, with the step's own words.
export function stepDrill(drills,i){
 const s=stepAt(i);if(!s)return null
 const d=drills.find(x=>x.id===s.drill);if(!d)return null
 return {...d,name:s.title,tip:s.text,label:label(i),tutorial:i}
}
