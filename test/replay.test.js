import test from 'node:test';import assert from 'node:assert/strict'
import {createRecorder,toWire,fromWire,pack,unpack,ballsAt,duration,MAX_FRAMES,MAX_PACKED} from '../src/replay.js'
import {rack} from '../src/rules.js'
import {stepCosmetic,STEP} from '../src/predict.js'
import {substeps,strike} from '../src/physics.js'
import {deflateRawSync} from 'node:zlib'

// A real shot through the real physics, sampled every 40ms like the host's sync.
function record(mode='8ball',speed=3000,angle=0.02){
 const balls=rack(mode),rec=createRecorder(mode,7)
 strike(balls[0],Math.cos(angle)*speed,Math.sin(angle)*speed)
 let now=0,nextSample=0
 for(let i=0;i<1200;i++){
  const n=substeps(balls,STEP)
  for(let k=0;k<n;k++)stepCosmetic(balls,STEP/n)
  now+=STEP*1000
  if(now>=nextSample){rec.frame(now,balls);nextSample+=40}
 }
 return rec.finish()
}
const wire=r=>JSON.parse(JSON.stringify(toWire(r)))

test('a recorded shot survives packing and unpacking exactly',async()=>{
 for(const mode of ['8ball','9ball']){
  const r=record(mode)
  const back=await unpack(await pack(r))
  assert.deepEqual(back,r)
 }
})

test('packing is deterministic',async()=>{
 const r=record()
 assert.equal(await pack(r),await pack(r))
})

test('a break fits comfortably in a link, and a simple shot is much shorter',async()=>{
 const brk=await pack(record('8ball',3200))
 assert.ok(brk.length<6000,`a full break took ${brk.length} characters`)
 assert.ok(brk.length<MAX_PACKED)
 const balls=[{n:0,x:300,y:190,on:true},{n:1,x:420,y:190,on:true}],rec=createRecorder('8ball',7)
 for(let i=0;i<30;i++){balls[0].x+=6;rec.frame(i*40,balls.concat(rack('8ball').slice(2).map((b,j)=>({n:b.n,x:b.x,y:b.y,on:true}))))}
 const simple=await pack(rec.finish())
 assert.ok(simple.length<brk.length/2,`simple ${simple.length} vs break ${brk.length}`)
})

test('the recorder keeps time monotonic, caps its length, and yields nothing for a single frame',()=>{
 const balls=rack('8ball'),rec=createRecorder('8ball',7)
 rec.frame(1000,balls);rec.frame(990,balls);rec.frame(1200,balls)
 const r=rec.finish()
 assert.deepEqual(r.frames.map(f=>f.t),[0,0,200],'time never runs backwards')
 const long=createRecorder('8ball',7)
 for(let i=0;i<MAX_FRAMES+50;i++)long.frame(i*40,balls)
 assert.equal(long.length,MAX_FRAMES)
 const one=createRecorder('8ball',7);one.frame(0,balls)
 assert.equal(one.finish(),null)
})

test('the recorder rounds positions and records a pocketed ball as gone',()=>{
 const balls=rack('8ball'),rec=createRecorder('8ball',7)
 balls[3].x=100.6;balls[3].y=99.4
 rec.frame(0,balls)
 balls[3].on=false
 rec.frame(40,balls)
 const r=rec.finish()
 assert.deepEqual(r.frames[0].b[3],[101,99])
 assert.equal(r.frames[1].b[3],null)
})

test('playback lands exactly on the samples and interpolates between them',()=>{
 const r=record()
 for(const f of [r.frames[0],r.frames[7],r.frames[r.frames.length-1]]){
  const at=ballsAt(r,f.t)
  f.b.forEach((p,k)=>{if(p){assert.equal(at[k].x,p[0]);assert.equal(at[k].y,p[1])}else assert.equal(at[k].on,false)})
 }
 const a=r.frames[3],b=r.frames[4],mid=ballsAt(r,(a.t+b.t)/2)
 a.b.forEach((p,k)=>{if(p&&b.b[k]){assert.ok(Math.abs(mid[k].x-(p[0]+b.b[k][0])/2)<1e-9);assert.ok(Math.abs(mid[k].y-(p[1]+b.b[k][1])/2)<1e-9)}})
})

test('playback clamps outside the recording and reports its length',()=>{
 const r=record()
 assert.deepEqual(ballsAt(r,-500).map(b=>[b.x,b.y]),ballsAt(r,0).map(b=>[b.x,b.y]))
 assert.deepEqual(ballsAt(r,duration(r)+9999).map(b=>[b.x,b.y]),ballsAt(r,duration(r)).map(b=>[b.x,b.y]))
 assert.ok(duration(r)>1000)
})

test('a ball is on the table until the first sample that shows it gone',()=>{
 const balls=rack('8ball'),rec=createRecorder('8ball',7)
 rec.frame(0,balls);rec.frame(100,balls)
 balls[5].on=false
 rec.frame(200,balls)
 const r=rec.finish()
 assert.equal(ballsAt(r,150)[5].on,true,'still on between the last sample it was seen and the one it was gone')
 assert.equal(ballsAt(r,200)[5].on,false)
})

test('playback balls have what the renderers need',()=>{
 const b=ballsAt(record(),0)
 assert.equal(b[0].k,'cue');assert.equal(b[0].n,0)
 assert.ok(b.every(x=>x.id===x.n&&typeof x.k==='string'&&'x' in x&&'y' in x&&'on' in x))
 assert.ok(b.some(x=>x.k==='solid')&&b.some(x=>x.k==='stripe')&&b.some(x=>x.k==='eight'))
})

test('a nine-ball replay plays back ten balls',async()=>{
 const r=await unpack(await pack(record('9ball')))
 assert.equal(r.mode,'9ball');assert.equal(ballsAt(r,0).length,10)
})

// ---- hostile input ----

const bad=(name,mutate)=>test(`a link is refused when ${name}`,async()=>{
 const w=wire(record());mutate(w)
 const json=JSON.stringify(w)
 const link='z'+Buffer.from(deflateRawSync(Buffer.from(json))).toString('base64url')
 await assert.rejects(()=>unpack(link))
})
bad('it names a game that does not exist',w=>{w.m='11ball'})
bad('the table size is unknown',w=>{w.s=12})
bad('the ball count is wrong for the game',w=>{w.i=w.i.slice(1);w.x=w.x.slice(1);w.y=w.y.slice(1)})
bad('two balls share a number',w=>{w.i[2]=w.i[1]})
bad('a ball number is out of range',w=>{w.i[2]=99})
bad('a position is not a whole number',w=>{w.x[1][3]=1.5})
bad('a position is not a number at all',w=>{w.x[1][3]='ha'})
bad('a ball is placed far off the table',w=>{w.x[1][3]=100000})
bad('the times are negative',w=>{w.t[2]=-5})
bad('it claims to last an hour',w=>{w.t[3]=3600000})
bad('the frame lists disagree in length',w=>{w.x[0].pop()})
bad('the version is wrong',w=>{w.v=2})
bad('there is only one frame',w=>{w.t=[0];w.x=w.x.map(a=>[a[0]]);w.y=w.y.map(a=>[a[0]])})

test('links that are not replays at all are refused',async()=>{
 for(const junk of ['','z','q123','zzzz!!!!','j' ,'j@@@','z'+'A'.repeat(40),null,undefined,42,{}])
  await assert.rejects(()=>unpack(junk),undefined,`should refuse ${JSON.stringify(junk)}`)
})

test('an over-long link is refused before anything is decoded',async()=>{
 await assert.rejects(()=>unpack('z'+'A'.repeat(MAX_PACKED+1)),/bad link/)
})

test('a compression bomb is refused: a small link may not inflate without limit',async()=>{
 // forty megabytes of zeros deflates to a few tens of kilobytes
 const bomb=deflateRawSync(Buffer.alloc(40*1024*1024,'0'),{level:9})
 const link='z'+bomb.toString('base64url')
 assert.ok(link.length<MAX_PACKED,`the bomb must fit under the link limit to be a real test (${link.length})`)
 await assert.rejects(()=>unpack(link),/expands too far/)
})

test('an uncompressed replay still opens where compression is unavailable',async()=>{
 const r=record()
 const saved=[globalThis.CompressionStream,globalThis.DecompressionStream]
 delete globalThis.CompressionStream;delete globalThis.DecompressionStream
 try{
  const link=await pack(r)
  assert.equal(link[0],'j')
  assert.deepEqual(await unpack(link),r)
 }finally{globalThis.CompressionStream=saved[0];globalThis.DecompressionStream=saved[1]}
})

test('a replay is plain data: nothing in a decoded replay can carry code',async()=>{
 const r=await unpack(await pack(record()))
 const walk=v=>{
  if(v===null)return
  if(typeof v==='number'||typeof v==='string')return
  assert.ok(Array.isArray(v)||Object.getPrototypeOf(v)===Object.prototype,'only arrays and plain objects')
  for(const x of Object.values(v))walk(x)
 }
 walk(r)
})

test('fromWire is what enforces the rules, whatever produced the object',()=>{
 assert.throws(()=>fromWire(null))
 assert.throws(()=>fromWire([]))
 assert.throws(()=>fromWire({v:1}))
})
