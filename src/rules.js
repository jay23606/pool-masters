import {R,MINX,MAXX,MINY,MAXY,POCKETS} from './table.js'

// Eight-ball and nine-ball rules, as pure functions over a plain state object.
// Nothing here touches the DOM, the network or a renderer, so a game can be
// judged, tested or replayed without any of them.

export const MODES={
 '8ball':{label:'8-ball',balls:16},'9ball':{label:'9-ball',balls:10},
 'bank':{label:'Bank pool',balls:16},'onepocket':{label:'One-pocket',balls:16}
}
export const modeOf=m=>MODES[m]?m:'8ball'
// Bank pool and one-pocket are scored games: fifteen balls, any of them may be hit first, and the
// first to eight wins. What they share is judged by judgeScoreGame().
export const isScoreMode=m=>m==='bank'||m==='onepocket'
export const SCORE_TARGET=8
// One-pocket: each player owns one of the two foot corners (the end the rack sits at). Player A
// has the bottom-right pocket and player B the top-right; a ball dropped in either is that
// player's, whoever shot it.
export const ONE_POCKET={a:5,b:2}

export const other=t=>t==='a'?'b':'a'
export const kind=n=>n===8?'eight':n<8?'solid':'stripe'
export const opposite=g=>g==='solid'?'stripe':'solid'
// Older room state may have used the display labels. Normalize at the rules
// boundary so a stale peer can never make a remaining stripe invisible.
export const normalizeGroup=g=>g==='solids'?'solid':g==='stripes'?'stripe':g

const shuffle=a=>a.sort(()=>Math.random()-.5)
export function rack(mode='8ball'){
 return modeOf(mode)==='9ball'?nineRack():eightRack()
}

// Diamond of ten: the 1 on the foot spot at the apex, the 9 in the middle, the
// other seven anywhere -- five columns of 1, 2, 3, 2, 1.
function nineRack(){
 const cue={id:0,x:154,y:190,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:'cue',n:0}
 const slots=[[0,0],[1,-.5],[1,.5],[2,-1],[2,0],[2,1],[3,-.5],[3,.5],[4,0]]
 const others=shuffle([2,3,4,5,6,7,8])
 const nums=[1,...others.slice(0,3),9,...others.slice(3)]   // slot 4 is the middle of column 2
 return [cue,...slots.map(([col,row],i)=>{
  const n=nums[i]
  return {id:n,x:420+col*(R*Math.sqrt(3)),y:190+row*(2*R),vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:kind(n),n}
 })]
}

function eightRack(){
 const nums=shuffle([...Array(7)].map((_,i)=>i+1).concat([...Array(7)].map((_,i)=>i+9)))
 nums.splice(4,0,8)
 const a=[{id:0,x:154,y:190,vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:'cue',n:0}]
 let q=0
 for(let row=0;row<5;row++)for(let i=0;i<=row;i++){
  const n=nums[q++]
  a.push({id:n,x:420+row*(R*Math.sqrt(3)),y:190+(i-row/2)*(2*R),vx:0,vy:0,wx:0,wy:0,wz:0,on:true,k:kind(n),n})
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
 if(modeOf(s.mode)==='9ball')return judgeNineBall(s)
 if(isScoreMode(modeOf(s.mode)))return judgeScoreGame(s)
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

// ---- nine-ball ----
//
// No groups and no called pockets. The cue ball must hit the lowest-numbered
// ball on the table first, and the shot must then either pocket something or
// drive some ball to a cushion. Pocketing the 9 on a legal shot wins the rack
// -- including off a combination -- while the 9 pocketed on a foul comes back
// to the table. Any foul gives the opponent ball in hand.

// The ball that has to be hit first: the lowest number still on the table.
export function lowestBall(balls){
 let low=null
 for(const b of balls)if(b.on&&b.k!=='cue'&&(low===null||b.n<low))low=b.n
 return low
}

// Where a pocketed 9 goes back: the foot spot, or the next free spot behind it
// if a ball is sitting there, so it can never reappear inside another ball.
export function nineRespot(balls){
 const free=p=>!balls.some(b=>b.on&&b.n!==9&&Math.hypot(b.x-p.x,b.y-p.y)<2*R)
 for(let x=420;x<=MAXX;x+=R)if(free({x,y:190}))return {x,y:190}
 for(let x=420;x>=MINX;x-=R)if(free({x,y:190}))return {x,y:190}
 return {x:420,y:190}
}

// Takes: turn, potted (object balls only), scratch, firstHit, lowest (the
// lowest ball when the shot was taken), railHit (a ball reached a cushion
// after the first contact).
export function judgeNineBall(s){
 const shooter=s.turn,nine=s.potted.some(b=>b.n===9)
 const reason=s.scratch?'scratch'
  :!s.firstHit?'no-contact'
  :s.firstHit.n!==s.lowest?'wrong-first'
  :!s.potted.length&&!s.railHit?'no-rail'
  :null
 if(reason)return {winner:null,foul:true,reason,assign:null,nextTurn:other(shooter),respotNine:nine}
 if(nine)return {winner:shooter,foul:false,reason:null,assign:null,nextTurn:shooter,respotNine:false}
 return {winner:null,foul:false,reason:null,assign:null,nextTurn:s.potted.length?shooter:other(shooter),respotNine:false}
}

// ---- bank pool and one-pocket ----
//
// Any ball may be hit first; the cue ball must hit something, and must not go in a pocket. A foul
// gives the opponent ball in hand and scores nothing, whatever dropped. Otherwise:
//   bank pool   a ball scores for the shooter only if it touched a cushion on its way to the
//               pocket; a ball that dropped without doing so is out of the game and scores nothing
//   one-pocket  a ball scores for whoever owns the pocket it dropped in (ONE_POCKET); a ball in any
//               other pocket is out of the game and scores nothing
// The shooter keeps the table while they score for themselves. First to SCORE_TARGET wins; if the
// balls run out first, the higher score wins, and a tie goes to whoever was not shooting.
//
// Takes: mode, turn, score {a,b}, potted (object balls), pockets (or pocketOf) {ball: pocket}, railBalls (balls
// that touched a cushion; an array or a Set), scratch, firstHit, and balls (the table after the shot).
export function judgeScoreGame(s){
 const shooter=s.turn,opponent=other(shooter),mode=modeOf(s.mode)
 const score={a:s.score?.a||0,b:s.score?.b||0}
 const rails=new Set(s.railBalls||[])
 const pockets=s.pockets||s.pocketOf      // a game object keeps this as pocketOf; a bare test shot says pockets
 const reason=s.scratch?'scratch':!s.firstHit?'no-contact':null
 const credited=[],wasted=[]
 for(const b of s.potted){
  let to=null
  if(!reason){
   if(mode==='bank')to=rails.has(b.n)?shooter:null
   else{const i=pockets?.[b.n];to=i===ONE_POCKET.a?'a':i===ONE_POCKET.b?'b':null}
  }
  if(to){score[to]++;credited.push({n:b.n,to})}else wasted.push(b.n)
 }
 const left=s.balls.filter(b=>b.on&&b.k!=='cue').length
 let winner=score.a>=SCORE_TARGET?'a':score.b>=SCORE_TARGET?'b':null
 if(!winner&&left===0)winner=score.a>score.b?'a':score.b>score.a?'b':opponent
 const kept=!reason&&credited.some(c=>c.to===shooter)
 return {winner,foul:Boolean(reason),reason,assign:null,nextTurn:reason||!kept?opponent:shooter,score,credited,wasted}
}
