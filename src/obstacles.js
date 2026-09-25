import {R} from './table.js'

// Obstacle tables: things on the cloth besides balls. Pure data and small functions, so they can be tested without
// a game. The physics calls obstacleStep after each step of each ball (through railBounce), so the game, the AI's
// rollouts, the puzzle solver and the guest's prediction all see the same obstacles.
//
//   bumper   a round post: balls bounce off it
//   wall     a thin barrier: balls bounce off it
//   portal   a ring; a ball that rolls into one comes out of the paired ring, going the same way
//
// The active set is module state, set by whichever game is being played (setObstacles) and cleared when it ends.
// A ball in the air (a jump shot) hops over bumpers and walls, but not through portals.

export const BUMPER_E=.85          // how much of its speed into a bumper or wall a ball keeps
export const WALL_R=2.5            // half the thickness of a wall

let ACTIVE=[]
export const setObstacles=list=>{ACTIVE=list||[]}
export const getObstacles=()=>ACTIVE

const bumper=(x,y,r=11)=>({t:'bumper',x,y,r})
const wall=(x1,y1,x2,y2)=>({t:'wall',x1,y1,x2,y2})
const portals=(a,b,r=15)=>[{t:'portal',x:a[0],y:a[1],r,to:[b[0],b[1]]},{t:'portal',x:b[0],y:b[1],r,to:[a[0],a[1]]}]

// Every layout keeps the head spot (154,190) and the rack (x 411 to 492) clear, and a lane down the middle open.
export const PRESETS=[
 {id:'bumpers',name:'Bumpers',items:[bumper(270,105),bumper(270,275),bumper(385,140,12),bumper(385,240,12)]},
 {id:'walls',name:'Walls',items:[wall(330,90,330,150),wall(330,230,330,290),wall(370,150,370,230)]},
 {id:'portals',name:'Portals',items:[...portals([250,100],[250,280]),...portals([430,95],[430,285])]},
 {id:'gauntlet',name:'Gauntlet',items:[bumper(300,190,10),wall(370,95,370,135),wall(370,245,370,285),...portals([240,90],[440,290])]}
]
export const presetById=id=>PRESETS.find(p=>p.id===id)||null
export const presetItems=id=>presetById(id)?.items||[]
export const isPreset=id=>id==null||Boolean(presetById(id))

// Bounce a ball off a round thing of radius `rad` at (cx,cy).
function bounceOff(b,cx,cy,rad){
 const dx=b.x-cx,dy=b.y-cy,d=Math.hypot(dx,dy),reach=R+rad
 if(d>=reach||d===0)return false
 const nx=dx/d,ny=dy/d
 b.x=cx+nx*reach;b.y=cy+ny*reach
 const vn=b.vx*nx+b.vy*ny
 if(vn<0){b.vx-=(1+BUMPER_E)*vn*nx;b.vy-=(1+BUMPER_E)*vn*ny}
 return true
}

// The closest point of a wall to (x,y).
export function nearestOnWall(w,x,y){
 const ex=w.x2-w.x1,ey=w.y2-w.y1,len2=ex*ex+ey*ey
 const t=len2?Math.max(0,Math.min(1,((x-w.x1)*ex+(y-w.y1)*ey)/len2)):0
 return [w.x1+t*ex,w.y1+t*ey]
}

// One step's worth of obstacle for one ball: bounces it, or sends it through a portal. Returns true if it bounced,
// which counts as touching a cushion for the rules that ask (a bank shot off a wall is still a bank).
export function obstacleStep(b,list=ACTIVE){
 if(!list.length)return false
 // just came out of a portal: it may not go back in until it has rolled clear of them all
 if(b.pc){
  if(!list.some(o=>o.t==='portal'&&Math.hypot(b.x-o.x,b.y-o.y)<o.r+R+2))b.pc=0
 }
 let hit=false
 const up=(b.z||0)>0
 for(const o of list){
  if(o.t==='portal'){
   if(b.pc||Math.hypot(b.x-o.x,b.y-o.y)>=o.r*.6)continue
   const sp=Math.hypot(b.vx,b.vy);if(sp<1)continue
   b.x=o.to[0]+b.vx/sp*(o.r+R+2);b.y=o.to[1]+b.vy/sp*(o.r+R+2);b.pc=1
   continue
  }
  if(up)continue
  if(o.t==='bumper'){if(bounceOff(b,o.x,o.y,o.r))hit=true}
  else if(o.t==='wall'){const [cx,cy]=nearestOnWall(o,b.x,b.y);if(bounceOff(b,cx,cy,WALL_R))hit=true}
 }
 return hit
}

// Would a ball of the usual size at (x,y) overlap an obstacle? For placing the cue ball and checking layouts.
export function blocks(x,y,list=ACTIVE,radius=R){
 for(const o of list){
  if(o.t==='bumper'&&Math.hypot(x-o.x,y-o.y)<radius+o.r+1)return true
  if(o.t==='wall'){const [cx,cy]=nearestOnWall(o,x,y);if(Math.hypot(x-cx,y-cy)<radius+WALL_R+1)return true}
  if(o.t==='portal'&&Math.hypot(x-o.x,y-o.y)<o.r+radius)return true
 }
 return false
}
