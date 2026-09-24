import test from 'node:test';import assert from 'node:assert/strict'
import {detectEvents,snapshot,createSfx} from '../src/sfx.js'
import {R,MAXX} from '../src/table.js'

const ball=(x,y,on=true)=>({x,y,on,k:'solid',n:1})
const step=(a,b)=>detectEvents(snapshot(a),b)

test('two balls closing into contact make one sound, not one per frame',()=>{
 const a=[ball(100,190),ball(100+2*R+6,190)]
 const b=[ball(100,190),ball(100+2*R-.2,190)]      // just made contact
 const first=step(a,b)
 assert.equal(first.filter(e=>e.t==='ball').length,1,'contact should fire once')
 const still=step(b,[ball(100,190),ball(100+2*R-.4,190)])
 assert.equal(still.filter(e=>e.t==='ball').length,0,'already-touching balls stay quiet')
})

test('a harder collision is louder',()=>{
 // same geometry both times, only the distance travelled into contact differs
 const at=s=>[[ball(101.5-s,190),ball(120,190)],[ball(101.5,190),ball(120,190)]]
 const loud=w=>{const[p,c]=at(w);return step(p,c).find(e=>e.t==='ball').v}
 const soft=loud(1.5),hard=loud(20)
 assert.ok(hard>soft*3,`hard ${hard} should dwarf soft ${soft}`)
})

test('reaching a cushion makes a rail sound once',()=>{
 const approaching=[ball(MAXX-40,190)]
 const arrived=[ball(MAXX-1,190)]
 assert.equal(step(approaching,arrived).filter(e=>e.t==='rail').length,1)
 assert.equal(step(arrived,[ball(MAXX-2,190)]).filter(e=>e.t==='rail').length,0,'no repeat while sitting there')
})

test('a ball leaving the table is a pocket, and only once',()=>{
 const on=[ball(300,190,true)]
 const off=[ball(300,190,false)]
 assert.equal(step(on,off).filter(e=>e.t==='pocket').length,1)
 assert.equal(step(off,off).filter(e=>e.t==='pocket').length,0)
})

test('a still table is silent',()=>{
 const t=[ball(100,190),ball(400,120),ball(500,260)]
 assert.deepEqual(step(t,t),[])
})

test('the very first frame cannot invent events',()=>{
 assert.deepEqual(detectEvents(null,[ball(100,190)]),[])
})

// A minimal fake AudioContext, just enough for the synthesised sting fallback
// to run without throwing.
function fakeAudioContextClass(){
 class Param{constructor(v=0){this.value=v}setValueAtTime(){}exponentialRampToValueAtTime(){}}
 class Node{connect(){}}
 return class{
  constructor(){this.currentTime=0;this.sampleRate=44100;this.state='running';this.destination={}}
  createGain(){const g=new Node();g.gain=new Param(1);return g}
  createBufferSource(){const s=new Node();s.buffer=null;s.start=()=>{};s.stop=()=>{};return s}
  createBiquadFilter(){const f=new Node();f.frequency=new Param();f.Q=new Param();return f}
  createOscillator(){const o=new Node();o.frequency=new Param();o.start=()=>{};o.stop=()=>{};return o}
  createBuffer(){return {getChannelData:()=>new Float32Array(10)}}
  resume(){this.state='running';return Promise.resolve()}
 }
}

test('when the browser will not construct an Audio element, the crowd clip is skipped and the result still plays',()=>{
 const realWindow=globalThis.window,realAudio=globalThis.Audio
 globalThis.window={AudioContext:fakeAudioContextClass()}
 globalThis.Audio=class{constructor(){throw new Error('media playback disabled')}}
 try{
  const sfx=createSfx()
  assert.doesNotThrow(()=>sfx.resume(),'preloading the crowd clip must not throw')
  assert.doesNotThrow(()=>sfx.result(true),'a win with no clip available should still play the synth sting')
  assert.doesNotThrow(()=>sfx.result(false))
 }finally{globalThis.window=realWindow;globalThis.Audio=realAudio}
})

test('when the crowd-clip element exists but cloning or playing it fails, the result falls back to the synth sting',()=>{
 const realWindow=globalThis.window,realAudio=globalThis.Audio
 globalThis.window={AudioContext:fakeAudioContextClass()}
 globalThis.Audio=class{
  constructor(){this.preload=''}
  cloneNode(){throw new Error('cloneNode unsupported in this webview')}
 }
 try{
  const sfx=createSfx()
  assert.doesNotThrow(()=>sfx.resume())
  assert.doesNotThrow(()=>sfx.result(true))
 }finally{globalThis.window=realWindow;globalThis.Audio=realAudio}
})
