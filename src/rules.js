import {R,MINX,MAXX,MINY,MAXY,POCKETS} from './table.js'

// Eight-ball rules, as pure functions over a plain state object. Nothing here
// touches the DOM, the network or a renderer, so a game can be judged, tested
// or replayed without any of them.

export const other=t=>t==='a'?'b':'a'
export const kind=n=>n===8?'eight':n<8?'solid':'stripe'
export const opposite=g=>g==='solid'?'stripe':'solid'
// Older room state may have used the display labels. Normalize at the rules
// boundary so a stale peer can never make a remaining stripe invisible.
export const normalizeGroup=g=>g==='solids'?'solid':g==='stripes'?'stripe':g

const shuffle=a=>a.sort(()=>Math.random()-.5)
export function rack(){
 const nums=shuffle([...Array(7)].map((_,i)=>i+1).concat([...Array(7)].map((_,i)=>i+9)))
 nums.splice(4,0,8)
 const a=[{x:154,y:190,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:'cue',n:0}]
 let q=0
 for(let row=0;row<5;row++)for(let i=0;i<=row;i++){
  const n=nums[q++]
  a.push({x:420+row*(R*Math.sqrt(3)),y:190+(i-row/2)*(2*R),vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:kind(n),n})
 }
 return a
}

export const groupOf=(s,player)=>s.groups[player]
export const remaining=(balls,group)=>balls.filter(b=>b.on&&b.k===group).length
export const nearestPocket=p=>POCKETS.reduce((best,x,i)=>{
 const d=Math.hypot(p.x-x[0],p.y-x[1])
 return d<best.d?{i,d}:best
},{i:0,d:Infinity}).i
export const validCueSpot=(balls,p)=>
 p.x>=MINX&&p.x<=MAXX&&p.y>=MINY&&p.y<=MAXY&&
 !balls.some(b=>b.k!=='cue'&&b.on&&Math.hypot(b.x-p.x,b.y-p.y)<2*R)

// What a finished shot means, decided without changing anything. The caller
// applies the verdict and owns the side effects -- the flash, the sync, the
// cue ball coming back.
//
// Takes: turn, groups, breakShot, potted, scratch, firstHit, calledPocket,
// eightPocket, and `before` -- how many of the shooter's own balls were on the
// table when the shot was taken.
export function judgeShot(s){
 const shooter=s.turn,group=normalizeGroup(s.groups[shooter]),open=!group
 const black=s.potted.some(b=>b.k==='eight')
 const onTheEight=s.before===0
 const noContact=!s.firstHit
 const wrongFirst=!!s.firstHit&&(open
  ? s.firstHit.k==='eight'
  : s.firstHit.k!==(onTheEight?'eight':group))

 // APA 8-ball: scratching while playing the 8 is loss of game, even when
 // the eight stays on the table. A normal scratch on any other shot remains
 // ball in hand below.
 if(black||(s.scratch&&s.firstHit?.k==='eight')){
  // the eight on the break is a win here rather than a re-rack
  const legal=black&& (s.breakShot
   ? !s.scratch
   : !!group&&onTheEight&&!s.scratch&&s.calledPocket===s.eightPocket)
  return {winner:legal?shooter:other(shooter),foul:false,assign:null,nextTurn:shooter}
 }
 if(s.scratch||wrongFirst||noContact)return {winner:null,foul:true,reason:s.scratch?'scratch':wrongFirst?'wrong-first':'no-contact',assign:null,nextTurn:other(shooter)}

 // APA keeps the table open after every break, no matter what drops. On the
 // first later legal scoring shot, the first object ball pocketed decides the
 // groups. `firstObjectPotted` is recorded by the simulation at the pocket,
 // rather than inferred from the rack's array order after the shot.
 let assign=null
 const firstObject=s.firstObjectPotted||s.potted.find(b=>b.k==='solid'||b.k==='stripe')
 if(open&&!s.breakShot)assign=firstObject?.k==='solid'||firstObject?.k==='stripe'
  ?firstObject.k:null
 // potting anything of your own keeps you at the table; while the table is
 // open, any object ball counts
 const madeOwn=group?s.potted.some(b=>b.k===group)
                    :s.potted.some(b=>b.k==='solid'||b.k==='stripe')
 return {winner:null,foul:false,reason:null,assign,nextTurn:madeOwn?shooter:other(shooter)}
}
