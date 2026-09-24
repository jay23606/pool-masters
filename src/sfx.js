import {R,MINX,MAXX,MINY,MAXY} from './table.js'

// Sound is driven off ball positions rather than the physics impulses, because
// only the host runs the simulation -- the other player receives positions and
// nothing else. Reading the motion means both sides hear the same table without
// adding anything to the wire.

const HIT=2*R+.6          // a pair this close, that was not, has just collided
const RAIL=2.5            // how near a cushion counts as touching it

// Pure: given the previous and current ball state, what just happened?
// Indexed by position, not by object identity, because the client rebuilds its
// ball objects on every sync -- and the client is exactly who this exists for.
export function detectEvents(prev,balls){
 const out=[]
 if(!prev||prev.length!==balls.length)return out
 for(let i=0;i<balls.length;i++){
  const a=balls[i],p=prev[i]
  if(!p)continue
  if(!a.on){if(p.on)out.push({t:'pocket',v:1});continue}
  const ax=a.x-p.x,ay=a.y-p.y,sp=Math.hypot(ax,ay)
  const nearX=a.x<=MINX+RAIL||a.x>=MAXX-RAIL,nearY=a.y<=MINY+RAIL||a.y>=MAXY-RAIL
  const wasX=p.x<=MINX+RAIL||p.x>=MAXX-RAIL,wasY=p.y<=MINY+RAIL||p.y>=MAXY-RAIL
  if(((nearX&&!wasX)||(nearY&&!wasY))&&sp>2)out.push({t:'rail',v:sp})
  for(let j=i+1;j<balls.length;j++){
   const c=balls[j],q=prev[j]
   if(!c.on||!q)continue
   const d=Math.hypot(c.x-a.x,c.y-a.y)
   if(d>=HIT)continue
   if(Math.hypot(q.x-p.x,q.y-p.y)<HIT)continue          // already touching
   const nx=(c.x-a.x)/(d||1),ny=(c.y-a.y)/(d||1)
   const close=(ax-(c.x-q.x))*nx+(ay-(c.y-q.y))*ny      // closing along the centres
   if(close>.5)out.push({t:'ball',v:close})
  }
 }
 return out
}

export const snapshot=balls=>balls.map(b=>({x:b.x,y:b.y,on:b.on}))

export function createSfx(){
 let ctx=null,master=null,noise=null,enabled=true,haptics=true,lastBuzz=0
 const level=.95
 const buzz=(ms,level=1)=>{if(!haptics||typeof navigator==='undefined'||!navigator.vibrate)return;const now=performance.now();if(now-lastBuzz<55)return;lastBuzz=now;try{navigator.vibrate(Math.round(ms*level))}catch{}}
 // The context can only start from a user gesture, so it is built on demand.
 function audio(){
  if(ctx)return ctx
  const C=window.AudioContext||window.webkitAudioContext
  if(!C)return null
  ctx=new C()
  master=ctx.createGain();master.gain.value=level;master.connect(ctx.destination)
  const len=ctx.sampleRate*.4
  noise=ctx.createBuffer(1,len,ctx.sampleRate)
  const d=noise.getChannelData(0)
  for(let i=0;i<len;i++)d[i]=Math.random()*2-1
  return ctx
 }
 const burst=(when,dur,freq,q,gain,type='bandpass')=>{
  const src=ctx.createBufferSource();src.buffer=noise
  const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q
  const g=ctx.createGain()
  g.gain.setValueAtTime(gain,when)
  g.gain.exponentialRampToValueAtTime(.0001,when+dur)
  src.connect(f);f.connect(g);g.connect(master)
  src.start(when);src.stop(when+dur)
 }
 const tone=(when,dur,from,to,gain,type='triangle')=>{
  const o=ctx.createOscillator();o.type=type
  o.frequency.setValueAtTime(from,when)
  o.frequency.exponentialRampToValueAtTime(to,when+dur)
  const g=ctx.createGain()
  g.gain.setValueAtTime(gain,when)
  g.gain.exponentialRampToValueAtTime(.0001,when+dur)
  o.connect(g);g.connect(master)
  o.start(when);o.stop(when+dur)
 }
 const play={
  // phenolic on phenolic: a bright, very short tick with a noise transient
  ball(v){const n=Math.min(1,v/900),t=ctx.currentTime
   tone(t,.05+ n*.03,1500+Math.random()*700,420,.06+n*.5)
   burst(t,.025,2600,1.2,.05+n*.35)},
  // cushion: the same energy through cloth and rubber, so duller and shorter
  rail(v){const n=Math.min(1,v/1100),t=ctx.currentTime
   burst(t,.09,320,.9,.04+n*.3,'lowpass')
   tone(t,.07,220,90,.03+n*.18,'sine')},
  pocket(){const t=ctx.currentTime
   burst(t,.16,500,.7,.28,'lowpass')
   tone(t+.02,.22,180,60,.22,'sine')},
  cue(v){const n=Math.min(1,v),t=ctx.currentTime
   burst(t,.03,1100,1.6,.12+n*.25)
   tone(t,.05,700,260,.05+n*.2)},
  result(won){const t=ctx.currentTime
   if(won){
    ;[0, .12, .25].forEach((d,i)=>tone(t+d,.31,523+i*131,523+i*131,.24,'sine'))
    burst(t+.18,.24,1300,.8,.22)
   }else{
    // Two falling, slightly detuned voices plus a low crowd-like burst form a
    // clear boo rather than another small table click.
    tone(t,.46,230,115,.34,'sawtooth');tone(t+.04,.5,196,96,.28,'triangle')
    burst(t+.06,.52,185,.65,.26,'lowpass')
   }}
 }
 let prev=null
 return {
  get enabled(){return enabled},get haptics(){return haptics},
  setEnabled(v){enabled=v;if(!v&&ctx)master.gain.value=0;else if(ctx)master.gain.value=level},
  setHaptics(v){haptics=!!v},
  // Called from a user gesture so the context is allowed to start.
  resume(){try{const c=audio();if(c&&c.state==='suspended')c.resume()}catch{}},
  result(won){
   buzz(won?22:35,won?1:1.25);if(!enabled||!audio())return
   const playResult=()=>{try{if(ctx.state==='running')play.result(won)}catch{}}
   if(ctx.state==='suspended')ctx.resume().then(playResult).catch(()=>{});else playResult()
  },
  cue(v){buzz(7,.7+v*.45);if(!enabled||!audio()||ctx.state!=='running')return;try{play.cue(v)}catch{}},
  update(balls){
   const events=(enabled||haptics)?detectEvents(prev,balls):[]
   prev=snapshot(balls)
   if(!events.length)return
   const strongest=events.reduce((a,e)=>e.t==='pocket'?e:(a?.t==='pocket'?a:(!a||e.v>a.v?e:a)),null)
   if(strongest)buzz(strongest.t==='pocket'?15:strongest.t==='rail'?6:4,strongest.t==='pocket'?1:.7)
   if(!enabled||!audio()||ctx.state!=='running')return
   // a break fires dozens at once; play the loudest few so it stays a crack
   // rather than a wall of noise
   events.sort((a,b)=>b.v-a.v)
   // audio must never be able to take the game loop down with it
   try{for(const e of events.slice(0,4))play[e.t](e.v)}catch(err){enabled=false;console.warn('table sound disabled',err)}
  }
 }
}
