import {R,MINX,MAXX,MINY,MAXY} from './table.js'

// The table is 700x380 units with a 9-unit ball radius, which puts one unit at
// roughly 4.06 mm — so the speed scale the game already used is physical: a
// full-power break leaves the cue at about 13 m/s. That means we can use real
// coefficients here rather than invented ones.
export const G=2414                 // gravity, units/s^2

// power slider percentage -> launch speed
export const shotSpeed=v=>120+Math.pow(Math.max(1,Math.min(100,v))/100,1.45)*3080

export const MU_SLIDE=.22           // cloth friction while a ball is skidding
export const MU_ROLL=.04          // rolling resistance once it grips
export const SPIN_DECAY=12          // rad/s^2, decay of vertical-axis English
export const MU_BALL=.06,E_BALL=.95 // ball-on-ball friction and restitution
export const MU_CUSHION=.2
export const SLIP_EPS=.6                   // below this the ball counts as rolling

// A ball carries angular velocity (wx,wy,wz) as well as (vx,vy). wx/wy give
// top- and backspin, wz is English. The contact patch sits at (0,0,-R), so the
// velocity of the cloth contact point is:
export const slip=b=>[b.vx-R*b.wy,b.vy+R*b.wx]
// ...and rolling without slipping means that velocity is zero:
export const setRolling=b=>{b.wy=b.vx/R;b.wx=-b.vy/R}
export const slipSpeed=b=>{const[ux,uy]=slip(b);return Math.hypot(ux,uy)}
export const speed=b=>Math.hypot(b.vx,b.vy)

// Everything interesting about pool comes from this distinction: a struck ball
// skids first, and only later grips and rolls. Friction acts at the contact
// point, so while it is skidding it both slows the ball and torques it toward
// the rolling state — which is why a stun shot stops dead, a rolling cue ball
// follows, and a ball with backspin still on it draws back.
export function integrate(b,dt){
 b.x+=b.vx*dt;b.y+=b.vy*dt
 const[ux,uy]=slip(b),us=Math.hypot(ux,uy)
 if(us>SLIP_EPS){
  const a=MU_SLIDE*G,nx=ux/us,ny=uy/us
  b.vx-=a*nx*dt;b.vy-=a*ny*dt
  b.wx-=(5*a)/(2*R)*ny*dt
  b.wy+=(5*a)/(2*R)*nx*dt
  // slip decays at 7/2 the linear rate; clamp so a step can't overshoot it
  const[nx2,ny2]=slip(b)
  if(nx2*nx+ny2*ny<0)setRolling(b)
 }else{
  const s=Math.hypot(b.vx,b.vy)
  if(s>0){const a=Math.min(MU_ROLL*G*dt,s);b.vx-=a*b.vx/s;b.vy-=a*b.vy/s}
  setRolling(b)
 }
 const az=SPIN_DECAY*dt
 b.wz=Math.abs(b.wz)<=az?0:b.wz-Math.sign(b.wz)*az
}

// Tip offset in ball radii: a is sideways (right positive), b is vertical
// (above centre positive). Both are clamped well inside the miscue limit.
export function strike(ball,vx,vy,a=0,bOff=0){
 const v=Math.hypot(vx,vy)
 ball.vx=vx;ball.vy=vy
 ball.wx=ball.wy=ball.wz=0
 if(!v)return
 const dx=vx/v,dy=vy/v,k=5*v/(2*R)
 a=Math.max(-.5,Math.min(.5,a));bOff=Math.max(-.5,Math.min(.5,bOff))
 ball.wz=k*a                  // English, about the vertical axis
 ball.wx=k*bOff*-dy           // top/backspin, about the axis across the shot
 ball.wy=k*bOff*dx
}

// Equal masses, so impulses are written per unit mass.
export function ballCollide(a,b){
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)
 if(!(d>0&&d<2*R))return false
 const nx=dx/d,ny=dy/d,ov=2*R-d
 a.x-=nx*ov/2;a.y-=ny*ov/2;b.x+=nx*ov/2;b.y+=ny*ov/2
 const vn=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny
 if(vn<=0)return true                       // already separating
 const jn=(1+E_BALL)*vn/2
 a.vx-=jn*nx;a.vy-=jn*ny;b.vx+=jn*nx;b.vy+=jn*ny
 // Tangential friction at the contact point. This is throw: a spinning or
 // cut cue ball drags the object ball a little off the line of centres.
 const tx=-ny,ty=nx
 const s=(a.vx-b.vx)*tx+(a.vy-b.vy)*ty+R*(a.wz+b.wz)
 const lim=MU_BALL*jn
 const p=Math.max(-lim,Math.min(lim,s/7))   // s/7 would null the slip outright
 a.vx-=p*tx;a.vy-=p*ty
 b.vx+=p*tx;b.vy+=p*ty
 a.wz-=5*p/(2*R);b.wz-=5*p/(2*R)
 return true
}

function cushion(b,nx,ny){
 const vn=b.vx*nx+b.vy*ny
 if(vn>=0)return
 const into=-vn
 // Restitution drops with impact speed, which is why hard banks come up short
 // of where the mirror line says they should.
 const e=Math.max(.68,.88-.16*Math.min(1,into/1400))
 const tx=-ny,ty=nx
 let vt=b.vx*tx+b.vy*ty
 // The contact point is at -R*n, so English shows up as tangential slip here:
 // running English widens the rebound, reverse English tightens it.
 const s=vt-R*b.wz,lim=MU_CUSHION*(1+e)*into
 const p=Math.max(-lim,Math.min(lim,-s/3.5))
 vt+=p
 b.wz-=5*p/(2*R)
 const vnOut=into*e
 b.vx=nx*vnOut+tx*vt
 b.vy=ny*vnOut+ty*vt
}

// Returns true if the ball touched a cushion this step.
export function railBounce(b){
 let hit=false
 if(b.x<MINX){b.x=MINX;cushion(b,1,0);hit=true}else if(b.x>MAXX){b.x=MAXX;cushion(b,-1,0);hit=true}
 if(b.y<MINY){b.y=MINY;cushion(b,0,1);hit=true}else if(b.y>MAXY){b.y=MAXY;cushion(b,0,-1);hit=true}
 return hit
}

// Enough substeps that nothing moves more than a quarter of a radius per step.
// A break at 3200 units/s would otherwise jump six ball widths per frame.
export function substeps(balls,dt){
 let worst=0
 for(const b of balls)if(b.on)worst=Math.max(worst,speed(b),slipSpeed(b))
 return Math.max(4,Math.min(64,Math.ceil(worst*dt/(R*.25))))
}

// A ball at the top of a draw shot has almost no velocity but a great deal of
// slip, and is about to come back — so resting means both are small.
export const REST_SPEED=4.5          // units/s, below both linear and slip speed a ball counts as stopped
export const atRest=b=>speed(b)<REST_SPEED&&slipSpeed(b)<REST_SPEED
export const clearMotion=b=>{b.vx=b.vy=b.wx=b.wy=b.wz=0}
