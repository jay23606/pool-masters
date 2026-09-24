import {W,H,TABLE_SIZES} from './table.js'
import {kind,MODES,modeOf} from './rules.js'

// A replay is a recorded shot: where every ball was, sampled at the rate the
// host already broadcasts state, played back by interpolating between samples.
//
// It is deliberately a recording of positions, not of inputs to be re-simulated.
// Two JavaScript engines are not obliged to agree to the last bit on sin, cos or
// pow, and billiards is exactly the kind of system that amplifies a last-bit
// difference into a visibly different shot. Recorded positions look identical on
// every browser.
//
// A shared link carries one of these in its URL, so everything read back from
// one is treated as hostile input: bounded in size, bounded in range, and never
// used as anything but numbers.

export const MAX_FRAMES=1500          // a minute at the 25Hz the host sends
export const MAX_MS=120000
export const MAX_INFLATED=400000      // bytes; a compressed replay may not expand past this
export const MAX_PACKED=60000         // characters of link we are willing to even try to read

// ---- recording ----

export function createRecorder(mode,size){
 const frames=[]
 let ids=null,t0=null,last=0
 return {
  frame(now,balls){
   if(frames.length>=MAX_FRAMES)return
   if(t0===null){t0=now;ids=balls.map(b=>b.n)}
   const t=Math.max(last,Math.round(now-t0));last=t
   frames.push({t,b:balls.map(b=>b.on?[Math.round(b.x),Math.round(b.y)]:null)})
  },
  get length(){return frames.length},
  finish(){return frames.length<2?null:{mode:modeOf(mode),size:size||7,ids,frames}}
 }
}

// ---- wire format ----
// Positions as deltas from the previous frame, times as deltas too: a resting
// ball is a run of zeros, which is what makes the compressed link short.

export function toWire(r){
 const n=r.frames.length,balls=r.ids.length
 const t=[],x=r.ids.map(()=>[]),y=r.ids.map(()=>[])
 const px=r.ids.map(()=>0),py=r.ids.map(()=>0)
 for(let i=0;i<n;i++){
  t.push(i?r.frames[i].t-r.frames[i-1].t:r.frames[i].t)
  for(let k=0;k<balls;k++){
   const p=r.frames[i].b[k],ax=p?p[0]:-1,ay=p?p[1]:-1
   x[k].push(i?ax-px[k]:ax);y[k].push(i?ay-py[k]:ay)
   px[k]=ax;py[k]=ay
  }
 }
 return {v:1,m:r.mode,s:r.size,i:r.ids,t,x,y}
}

const int=v=>Number.isInteger(v)

// Rebuild and validate. Returns a replay, or throws.
export function fromWire(w){
 if(!w||typeof w!=='object'||w.v!==1)throw new Error('not a replay')
 const mode=w.m
 if(!MODES[mode])throw new Error('unknown game')
 const size=w.s
 if(!TABLE_SIZES[size])throw new Error('unknown table')
 const ids=w.i,balls=MODES[mode].balls
 if(!Array.isArray(ids)||ids.length!==balls)throw new Error('wrong number of balls')
 const top=mode==='9ball'?9:15
 if(!ids.every(v=>int(v)&&v>=0&&v<=top)||new Set(ids).size!==balls)throw new Error('bad ball numbers')
 if(!Array.isArray(w.t)||w.t.length<2||w.t.length>MAX_FRAMES)throw new Error('bad length')
 const n=w.t.length
 if(!w.t.every(v=>int(v)&&v>=0))throw new Error('bad times')
 if(w.t.reduce((a,b)=>a+b,0)>MAX_MS)throw new Error('too long')
 for(const axis of [w.x,w.y])
  if(!Array.isArray(axis)||axis.length!==balls||!axis.every(a=>Array.isArray(a)&&a.length===n&&a.every(int)))throw new Error('bad positions')
 const frames=[];let clock=0
 const ax=ids.map(()=>0),ay=ids.map(()=>0)
 for(let i=0;i<n;i++){
  clock+=w.t[i]
  const b=[]
  for(let k=0;k<balls;k++){
   ax[k]+=w.x[k][i];ay[k]+=w.y[k][i]
   if(ax[k]===-1&&ay[k]===-1){b.push(null);continue}
   if(ax[k]<0||ax[k]>W||ay[k]<0||ay[k]>H)throw new Error('ball off the table')
   b.push([ax[k],ay[k]])
  }
  frames.push({t:clock,b})
 }
 return {mode,size,ids,frames}
}

// ---- link encoding ----

const toB64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
const fromB64=str=>{
 if(!/^[A-Za-z0-9_-]*$/.test(str))throw new Error('not base64url')
 const s=atob(str.replace(/-/g,'+').replace(/_/g,'/'));const out=new Uint8Array(s.length)
 for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i)
 return out
}
async function run(stream,bytes,limit){
 const reader=new Blob([bytes]).stream().pipeThrough(stream).getReader()
 const parts=[];let total=0
 for(;;){
  const {done,value}=await reader.read()
  if(done)break
  total+=value.length
  if(total>limit){await reader.cancel();throw new Error('expands too far')}
  parts.push(value)
 }
 const out=new Uint8Array(total);let o=0
 for(const p of parts){out.set(p,o);o+=p.length}
 return out
}

// 'z' + deflated JSON where the browser can, 'j' + plain JSON where it cannot.
export async function pack(r){
 const json=new TextEncoder().encode(JSON.stringify(toWire(r)))
 if(typeof CompressionStream==='undefined')return 'j'+toB64(json)
 return 'z'+toB64(await run(new CompressionStream('deflate-raw'),json,Infinity))
}

export async function unpack(str){
 if(typeof str!=='string'||str.length<2||str.length>MAX_PACKED)throw new Error('bad link')
 const bytes=fromB64(str.slice(1))
 let json
 if(str[0]==='z'){
  if(typeof DecompressionStream==='undefined')throw new Error('this browser cannot open compressed replays')
  json=await run(new DecompressionStream('deflate-raw'),bytes,MAX_INFLATED)
 }else if(str[0]==='j'){
  if(bytes.length>MAX_INFLATED)throw new Error('too big')
  json=bytes
 }else throw new Error('unknown format')
 return fromWire(JSON.parse(new TextDecoder().decode(json)))
}

// ---- playback ----

export const duration=r=>r.frames[r.frames.length-1].t

// The balls at a moment, as the renderers expect them. Between samples a ball is
// interpolated; a ball goes off the table on the first sample that shows it gone.
export function ballsAt(r,ms){
 const f=r.frames,last=f.length-1
 const t=Math.max(0,Math.min(ms,f[last].t))
 let i=0
 // frames are few and time only moves forward, so a linear scan is fine
 while(i<last&&f[i+1].t<=t)i++
 const a=f[i],b=f[Math.min(i+1,last)]
 const u=b.t>a.t?(t-a.t)/(b.t-a.t):0
 return r.ids.map((n,k)=>{
  const p=a.b[k],q=b.b[k]
  const on=Boolean(p)
  const x=on?(q?p[0]+(q[0]-p[0])*u:p[0]):0
  const y=on?(q?p[1]+(q[1]-p[1])*u:p[1]):0
  return {id:n,n,k:n===0?'cue':kind(n),x,y,on,vx:0,vy:0,wx:0,wy:0,wz:0}
 })
}
