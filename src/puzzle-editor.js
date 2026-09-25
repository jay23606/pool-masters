import {W,H,R,PR,POCKETS,COLORS} from './table.js'
import {problem,search,puzzleDrill,encode,MAX_BALLS,MIN_WINDOW} from './puzzle.js'

// The puzzle maker's dialog: a flat table to arrange balls on, a button that searches for a solution, and a link
// that only exists once one has been found. All the rules live in puzzle.js; this is drawing and pointer handling.
//
//   tap an empty spot   add a ball        tap a ball   make it the one to pot
//   drag a ball         move it           Remove       take the chosen ball off

const HTML=`<dialog id="puzzle-dialog"><form method="dialog"><h2>Puzzle maker</h2>
<p>Arrange a table, pick the ball to pot, and let the computer prove it can be done. Then share the link.</p>
<canvas id="puzzle-canvas" width="${W}" height="${H}"></canvas>
<p id="puzzle-status" role="status"></p>
<div class="puzzle-tools"><button type="button" id="puzzle-check" class="primary">Check it</button><button type="button" id="puzzle-play">Play it</button><button type="button" id="puzzle-copy" disabled>Copy link</button><button type="button" id="puzzle-remove">Remove ball</button><button type="button" id="puzzle-clear" class="ghost">Clear</button><button value="cancel" class="ghost">Close</button></div>
</form></dialog>`

const START={cue:[190,190],balls:[[1,470,190]],target:1}

export function createPuzzleEditor({onPlay,onLink,toast=()=>{}}){
 document.body.insertAdjacentHTML('beforeend',HTML)
 const dlg=document.querySelector('#puzzle-dialog'),cv=dlg.querySelector('#puzzle-canvas'),ctx=cv.getContext('2d')
 const $=s=>dlg.querySelector(s),status=$('#puzzle-status'),copy=$('#puzzle-copy')
 let p=JSON.parse(JSON.stringify(START)),solved=null,job=null,drag=null

 const say=t=>{status.textContent=t}
 const stop=()=>{if(job){clearTimeout(job.timer);job=null;$('#puzzle-check').textContent='Check it'}}
 const edited=()=>{stop();solved=null;copy.disabled=true;const why=problem(p);say(why||'Ready: press Check it to prove it can be done.');draw()}

 function draw(){
  const g=ctx
  g.clearRect(0,0,W,H);g.fillStyle='#4a2c17';g.fillRect(0,0,W,H);g.fillStyle='#1c6b45';g.fillRect(28,28,W-56,H-56)
  g.fillStyle='#050805';for(const k of POCKETS){g.beginPath();g.arc(k[0],k[1],PR,0,7);g.fill()}
  const ball=(n,x,y,label)=>{
   const gr=g.createRadialGradient(x-R*.35,y-R*.4,1,x,y,R);gr.addColorStop(0,'#fff');gr.addColorStop(.3,n?COLORS[n]:'#e7e7e1');gr.addColorStop(1,'#101510')
   g.fillStyle=gr;g.beginPath();g.arc(x,y,R,0,7);g.fill()
   if(label){g.fillStyle='#fff';g.font='bold 9px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),x,y+.5)}
  }
  for(const b of p.balls){
   ball(b[0],b[1],b[2],true)
   if(b[0]===p.target){g.strokeStyle='#ffe17c';g.lineWidth=2;g.beginPath();g.arc(b[1],b[2],R+4,0,7);g.stroke()}
  }
  ball(0,p.cue[0],p.cue[1],false)
  if(solved){g.strokeStyle='#8ff0bb';g.lineWidth=2;g.setLineDash([4,4]);g.strokeRect(30,30,W-60,H-60);g.setLineDash([])}
 }

 const at=e=>{const r=cv.getBoundingClientRect();return [Math.round((e.clientX-r.left)*W/r.width),Math.round((e.clientY-r.top)*H/r.height)]}
 const hit=([x,y])=>{
  if(Math.hypot(x-p.cue[0],y-p.cue[1])<=R+3)return {cue:true}
  for(const b of p.balls)if(Math.hypot(x-b[1],y-b[2])<=R+3)return {ball:b}
  return null
 }
 const nextNumber=()=>{for(let n=1;n<=15;n++)if(!p.balls.some(b=>b[0]===n))return n;return null}

 cv.onpointerdown=e=>{
  const pt=at(e),h=hit(pt)
  cv.setPointerCapture(e.pointerId)
  if(h)drag={h,moved:false,from:pt,orig:h.cue?[...p.cue]:[h.ball[1],h.ball[2]]}
  else{
   const n=nextNumber()
   if(p.balls.length>=MAX_BALLS||n==null)return say(`No more than ${MAX_BALLS} balls.`)
   p.balls.push([n,...pt]);if(!p.balls.some(b=>b[0]===p.target))p.target=n
   const why=problem(p);if(why){p.balls.pop();say(why);return}
   edited()
  }
 }
 cv.onpointermove=e=>{
  if(!drag)return
  const pt=at(e);if(Math.hypot(pt[0]-drag.from[0],pt[1]-drag.from[1])<4&&!drag.moved)return
  drag.moved=true
  const old=drag.h.cue?[...p.cue]:[drag.h.ball[1],drag.h.ball[2]]
  if(drag.h.cue)p.cue=pt;else{drag.h.ball[1]=pt[0];drag.h.ball[2]=pt[1]}
  // keep the last place that was legal, so the ball cannot be dragged onto a pocket or another ball
  const other=problem(p)
  if(other&&!/Pick|ball to pot/.test(other)){if(drag.h.cue)p.cue=old;else{drag.h.ball[1]=old[0];drag.h.ball[2]=old[1]}}
  else{solved=null;copy.disabled=true;stop();say('');draw()}
 }
 cv.onpointerup=()=>{
  if(!drag)return
  if(!drag.moved&&drag.h.ball){p.target=drag.h.ball[0]}
  drag=null;edited()
 }
 cv.onpointercancel=()=>{drag=null;edited()}

 $('#puzzle-remove').onclick=()=>{
  if(p.balls.length<=1)return say('A puzzle needs a ball to pot.')
  p.balls=p.balls.filter(b=>b[0]!==p.target);p.target=p.balls[0][0];edited()
 }
 $('#puzzle-clear').onclick=()=>{p=JSON.parse(JSON.stringify(START));edited()}

 $('#puzzle-check').onclick=()=>{
  if(job)return stop(),say('Stopped.')
  const why=problem(p);if(why)return say(why)
  const it=search(p),t0=performance.now();job={timer:0}
  $('#puzzle-check').textContent='Stop'
  const step=()=>{
   if(!job)return
   let r
   const until=performance.now()+40
   do{r=it.next()}while(!r.done&&performance.now()<until)
   if(r.done||performance.now()-t0>25000){
    const best=r.done?r.value:r.value.best
    stop()
    if(best){solved=best;copy.disabled=false;say(`Solvable ✓ The shot works within ${best.window}° of aim.`)}
    else say('No shot found. Try moving a ball to open a path.')
    draw();return
   }
   say(`Searching… ${r.value.tried} shots tried`)
   job.timer=setTimeout(step,0)
  }
  step()
 }
 $('#puzzle-play').onclick=()=>{
  const why=problem(p);if(why)return say(why)
  dlg.close();onPlay(puzzleDrill(JSON.parse(JSON.stringify(p)),solved?.hint||null))
 }
 copy.onclick=async()=>{
  if(!solved)return
  const r=await onLink(encode(p,solved.hint));if(r?.copied)toast('Puzzle link copied');else say(`Copy this link: ${r?.url??''}`)
 }
 dlg.addEventListener('close',stop)
 return {open(){edited();dlg.showModal()},minWindow:MIN_WINDOW,get puzzle(){return p}}
}
