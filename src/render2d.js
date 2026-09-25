import {W,H,R,PR,POCKETS,COLORS} from './table.js'
import {rayToRail,bankPath} from './pool.js'
import {tableFractions} from './screen-point.js'

// The original top-down renderer. Kept as the default and as a fallback for
// devices where WebGL is unavailable or too slow.
export function createRenderer2D(canvas,options={}){
 const g=canvas.getContext('2d')
 let felt=options.felt||'#17794b'
 function drawBall(b){
  g.save();g.beginPath();g.arc(b.x,b.y,R,0,7);g.clip()
  const surface=g.createRadialGradient(b.x-3.5,b.y-4,1,b.x+2,b.y+3,R*1.25)
  surface.addColorStop(0,'#fff');surface.addColorStop(.24,b.k==='cue'?'#e7e7e1':COLORS[b.n]);surface.addColorStop(.78,b.k==='cue'?'#c7c7c0':COLORS[b.n]);surface.addColorStop(1,'#101510')
  g.fillStyle=surface;g.fillRect(b.x-R,b.y-R,2*R,2*R)
  if(b.k==='stripe'){g.fillStyle='#f9f6eb';g.fillRect(b.x-R,b.y-4.4,2*R,8.8)}
  if(b.k!=='cue'){g.fillStyle='#f7f4e9';g.beginPath();g.arc(b.x,b.y,4.45,0,7);g.fill();g.fillStyle='#172018';g.font='bold 5px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(b.n,b.x,b.y+.4)}
  g.restore()
  g.strokeStyle='rgba(0,0,0,.48)';g.lineWidth=.65;g.beginPath();g.arc(b.x,b.y,R,0,7);g.stroke()
  g.fillStyle='rgba(255,255,255,.72)';g.beginPath();g.arc(b.x-3.3,b.y-3.7,1.9,0,7);g.fill()
 }
 return {
  mode:'2d',
  el:canvas,
  point(e){const {fx,fy}=tableFractions(canvas,e);return{x:fx*W,y:fy*H}},
  resize(){},
  destroy(){},
  draw(game){
   g.clearRect(0,0,W,H);g.fillStyle='#5f351f';g.fillRect(0,0,W,H)
   const grad=g.createRadialGradient(350,170,10,350,190,400);grad.addColorStop(0,felt);grad.addColorStop(1,shade(felt,-.48));g.fillStyle=grad;g.fillRect(22,22,656,336)
   g.fillStyle='#07100c'
   const pk=game.pocketScale?game.pocketScale():1
   POCKETS.forEach(([x,y],i)=>{g.beginPath();g.arc(x,y,(PR-2)*pk,0,7);g.fill();if((game.markedPocket?game.markedPocket():game.calledPocket)===i){g.strokeStyle='#ffd75d';g.lineWidth=3;g.beginPath();g.arc(x,y,PR+3,0,7);g.stroke()}if(game.snapMark&&game.snapMark()===i){g.strokeStyle='#ffffffb0';g.lineWidth=2;g.beginPath();g.arc(x,y,PR+1,0,7);g.stroke()}})
   for(const b of game.balls)if(b.on&&!(b.z>0))drawBall(b)
   // A ball in the air is drawn on top of the rest and larger, growing as it climbs and shrinking as it comes down:
   // seen from above, that is how height looks. Its shadow stays on the cloth.
   for(const b of game.balls)if(b.on&&b.z>0){const k=1+Math.min(b.z,30)/40;g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(b.x+b.z*.15,b.y+b.z*.2,R,R*.85,0,0,7);g.fill();g.save();g.translate(b.x,b.y);g.scale(k,k);g.translate(-b.x,-b.y);drawBall(b);g.restore()}
   if(!(game.aiming&&game.canAim()))return
   const q=game.guide()
   g.lineWidth=1.2;g.setLineDash([7,6]);g.strokeStyle='#fff';g.beginPath();g.moveTo(q.c.x,q.c.y);g.lineTo(q.c.x+q.dx*q.t,q.c.y+q.dy*q.t);g.stroke()
   if(q.banks.length){g.strokeStyle='rgba(255,255,255,.48)';g.beginPath();g.moveTo(q.banks[0].x,q.banks[0].y);q.banks.slice(1).forEach(p=>g.lineTo(p.x,p.y));g.stroke()}
   if(q.hit){const gx=q.c.x+q.dx*q.t,gy=q.c.y+q.dy*q.t,nx=(q.hit.x-gx)/(2*R),ny=(q.hit.y-gy)/(2*R),d=rayToRail(q.hit.x,q.hit.y,nx,ny);g.strokeStyle='#ffd96a';g.beginPath();g.moveTo(q.hit.x,q.hit.y);g.lineTo(q.hit.x+nx*d,q.hit.y+ny*d);g.stroke();const past=bankPath(q.hit.x,q.hit.y,nx,ny,2);if(past.length>1){g.strokeStyle='rgba(255,217,106,.45)';g.beginPath();g.moveTo(past[0].x,past[0].y);g.lineTo(past[1].x,past[1].y);g.stroke()}}
   g.setLineDash([])
   const tip=R+6+(+game.power.value/100)*42,at=d=>[q.c.x-q.dx*(tip+d),q.c.y-q.dy*(tip+d)]
   g.lineCap='round'
   for(const[a,b,w,c]of[[0,5,4,'#4e8fa6'],[5,52,7,'#ece0bb'],[52,160,9,'#a76f38'],[160,205,11,'#1d1915'],[205,242,14,'#714326']]){g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(...at(a));g.lineTo(...at(b));g.stroke()}
   g.lineCap='butt'
  },
  setFelt(color){felt=color}
 }
}

function shade(hex,amount){
 const n=parseInt(hex.slice(1),16),f=v=>Math.max(0,Math.min(255,Math.round(v*(1+amount))))
 return `#${[f(n>>16),f((n>>8)&255),f(n&255)].map(v=>v.toString(16).padStart(2,'0')).join('')}`
}
