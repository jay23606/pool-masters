import test from 'node:test'
import assert from 'node:assert/strict'
import {MUSIC_PRESETS,createMusic} from '../src/music.js'

test('Pool Masters Radio has a varied catalogue of original stations',()=>{
 assert.ok(MUSIC_PRESETS.length>=48)
 assert.equal(new Set(MUSIC_PRESETS.map(track=>track.name)).size,MUSIC_PRESETS.length)
 assert.ok(MUSIC_PRESETS.every(track=>track.lyric&&track.lead&&track.bpm>60&&track.bpm<130))
 assert.ok(new Set(MUSIC_PRESETS.map(track=>track.lead)).size>=4)
})

// A minimal fake AudioContext, just enough for the synth fallback path to run
// without throwing. Constructor call count doubles as "did the synth engage?".
function fakeAudioContextClass(){
 class Param{constructor(v=0){this.value=v}setValueAtTime(){}exponentialRampToValueAtTime(){}linearRampToValueAtTime(){}cancelScheduledValues(){}}
 class Node{connect(){}}
 return class{
  constructor(){this.currentTime=0;this.sampleRate=44100;this.state='running';this.destination={}}
  createGain(){const g=new Node();g.gain=new Param(1);return g}
  createDynamicsCompressor(){const c=new Node();c.threshold=new Param();c.knee=new Param();c.ratio=new Param();c.attack=new Param();c.release=new Param();return c}
  createBufferSource(){const s=new Node();s.start=()=>{};s.stop=()=>{};return s}
  createBiquadFilter(){const f=new Node();f.frequency=new Param();f.Q=new Param();return f}
  createOscillator(){const o=new Node();o.frequency=new Param();o.start=()=>{};o.stop=()=>{};return o}
  createBuffer(){return {getChannelData:()=>new Float32Array(10)}}
  resume(){this.state='running';return Promise.resolve()}
  close(){return Promise.resolve()}
 }
}
const tick=(ms=15)=>new Promise(r=>setTimeout(r,ms))

test('when Jamendo/Openverse is unreachable, the radio falls back to the synth instead of throwing',async()=>{
 const realWindow=globalThis.window,realFetch=globalThis.fetch
 globalThis.window={AudioContext:fakeAudioContextClass()}
 globalThis.fetch=()=>Promise.reject(new Error('network down'))
 try{
  const m=createMusic()
  assert.doesNotThrow(()=>m.setEnabled(true))
  await tick()
  assert.equal(m.enabled,true,'should still report enabled -- the failure is invisible to the caller')
 }finally{globalThis.window=realWindow;globalThis.fetch=realFetch}
})

test('when the browser refuses to construct an Audio element for a fetched track, the radio still falls back',async()=>{
 const realWindow=globalThis.window,realFetch=globalThis.fetch,realAudio=globalThis.Audio
 globalThis.window={AudioContext:fakeAudioContextClass()}
 globalThis.fetch=()=>Promise.resolve({json:async()=>({results:[{source:'jamendo',url:'https://example.test/track.mp3',duration:120000,license:'by',title:'Test Track',creator:'Someone',foreign_landing_url:'https://example.test/track'}]})})
 globalThis.Audio=class{constructor(){throw new Error('media playback disabled')}}
 try{
  const m=createMusic()
  assert.doesNotThrow(()=>m.setEnabled(true))
  await tick()
 }finally{globalThis.window=realWindow;globalThis.fetch=realFetch;globalThis.Audio=realAudio}
})

const oneTrack={source:'jamendo',url:'https://example.test/track.mp3',duration:120000,license:'by',title:'Test Track',creator:'Someone',foreign_landing_url:'https://example.test/track'}

test('a failed request is retried on another genre before the radio gives up on real songs',async()=>{
 const realWindow=globalThis.window,realFetch=globalThis.fetch,realAudio=globalThis.Audio
 globalThis.window={AudioContext:fakeAudioContextClass()}
 const urls=[]
 globalThis.fetch=url=>{urls.push(url);return urls.length<3?Promise.reject(new Error('flaky')):Promise.resolve({ok:true,json:async()=>({results:[oneTrack]})})}
 let made=0
 globalThis.Audio=class{constructor(){made++;this.volume=1}play(){return Promise.resolve()}pause(){}removeAttribute(){}load(){}}
 try{
  const m=createMusic();m.setEnabled(true);await tick(40);m.setEnabled(false)
  assert.equal(urls.length,3,'two failures, then a success')
  assert.equal(new Set(urls.map(u=>new URL(u).searchParams.get('q'))).size,3,'each attempt used a different genre')
  assert.equal(made,1,'and the real track played')
 }finally{globalThis.window=realWindow;globalThis.fetch=realFetch;globalThis.Audio=realAudio}
})

test('a browser that blocks autoplay gets the real song on the first touch, not the synth',async()=>{
 const realWindow=globalThis.window,realFetch=globalThis.fetch,realAudio=globalThis.Audio,realAdd=globalThis.addEventListener
 globalThis.window={AudioContext:fakeAudioContextClass()}
 globalThis.fetch=()=>Promise.resolve({ok:true,json:async()=>({results:[oneTrack]})})
 let made=0,blocked=true
 globalThis.Audio=class{constructor(){made++;this.volume=1}play(){return blocked?Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'})):Promise.resolve()}pause(){}removeAttribute(){}load(){}}
 const handlers={}
 globalThis.addEventListener=(type,fn)=>{handlers[type]=fn}
 try{
  const m=createMusic();m.setEnabled(true);await tick(40)
  assert.equal(made,1);assert.ok(handlers.pointerdown,'waiting for a touch')
  blocked=false;handlers.pointerdown();await tick()
  assert.equal(made,2,'played once the player touched the page')
  m.setEnabled(false)
 }finally{globalThis.window=realWindow;globalThis.fetch=realFetch;globalThis.Audio=realAudio;globalThis.addEventListener=realAdd}
})
