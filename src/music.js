// Pool Masters Radio is deliberately generated in the browser.  A track is a
// tiny score, rather than a downloaded recording, which keeps the Pages build
// small and lets the game offer a large, offline-friendly catalogue.
const roots=[48,50,52,53,55,57,59,60]
const scales={minor:[0,3,7,10],dorian:[0,3,5,7,10],major:[0,4,7,9],blues:[0,3,5,6,7,10],pentatonic:[0,3,5,7,10]}
const moods=[
 ['Green Felt','dorian',82,'triangle','ooh'],['Corner Lounge','minor',74,'sine','piano'],['Neon Break','blues',100,'square','bell'],
 ['Blue Chalk','pentatonic',88,'triangle','ooh'],['Last Call','minor',68,'sine','bass'],['Rail Runner','major',108,'triangle','bell'],
 ['Quiet Pocket','dorian',76,'sine','ooh'],['Side Spin','blues',96,'square','bass'],['Lucky Eight','minor',90,'triangle','piano'],
 ['Midnight Rack','pentatonic',72,'sine','ooh'],['Cue Ball Waltz','major',84,'triangle','piano'],['After Hours','dorian',78,'sine','bell']
]
const hooks={
 'Green Felt':'“Green felt, slow night, make the corner light.”',
 'Corner Lounge':'“Meet me where the corner pockets glow.”',
 'Neon Break':'“Neon on the rail, let the good roll find us.”',
 'Blue Chalk':'“Blue chalk on my hand, steady on the line.”',
 'Last Call':'“One more rack before the lights come up.”',
 'Rail Runner':'“Run that rail, let the whole room sing.”',
 'Quiet Pocket':'“Keep it low, keep it close, let the table talk.”',
 'Side Spin':'“A little side spin, a little luck tonight.”',
 'Lucky Eight':'“Lucky eight, stay in sight.”',
 'Midnight Rack':'“Midnight rack, moonlight on the cue.”',
 'Cue Ball Waltz':'“Round and round, the cue ball knows the way.”',
 'After Hours':'“After hours, every pocket has a story.”'
}
// Four variations per mood make 48 distinct stations without copying a song.
export const MUSIC_PRESETS=moods.flatMap(([name,scale,bpm,wave,lead])=>[0,1,2,3].map(variation=>({
 name:`${name} ${['I','II','III','IV'][variation]}`,lyric:hooks[name],scale,bpm:bpm+variation*3,wave,lead,root:roots[(moods.findIndex(m=>m[0]===name)+variation*2)%roots.length],variation
})))

export function createMusic(){
 let ctx,master,limiter,enabled=false,volume=1,index=Math.floor(Math.random()*MUSIC_PRESETS.length),timer,step=0
 let stream=null,loading=false,remoteTitle='',remoteCredit='',remoteCreator='',remoteLicense='',queue=[],duckTimer
 const played=[],playedSet=new Set();let searchBag=[]
 const listeners=new Set()
 // Jamendo's music collection provides actual tracks; general Openverse audio
 // results also include pets, ambience, and sound effects.
 const searches=['indie rock','folk','hip hop','electronic','soul','jazz','latin','pop','vocal','ambient','funk','piano']
 const shuffled=items=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
 const nextSearch=()=>{if(!searchBag.length)searchBag=shuffled(searches);return searchBag.pop()}
 const remember=track=>{const id=track.foreign_landing_url||track.url;if(playedSet.has(id))return;played.push(id);playedSet.add(id);if(played.length>80)playedSet.delete(played.shift())}
 const current=()=>MUSIC_PRESETS[index]
 const context=()=>{
  if(ctx)return ctx
  const C=window.AudioContext||window.webkitAudioContext
  if(!C)return null
  ctx=new C();master=ctx.createGain();master.gain.value=0
  // Keep the full-volume setting musical when a bass, chord, and lead overlap.
  limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=12;limiter.ratio.value=12;limiter.attack.value=.004;limiter.release.value=.16
  master.connect(limiter);limiter.connect(ctx.destination);return ctx
 }
 const note=(at,duration,hz,gain,type,detune=0)=>{
  const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=hz;o.detune.value=detune
  g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(gain,at+.018);g.gain.exponentialRampToValueAtTime(.0001,at+duration)
  o.connect(g);g.connect(master);o.start(at);o.stop(at+duration+.03)
 }
 const vocal=(at,duration,pitch,gain)=>{
  // Two moving formants turn a pair of sine waves into a light, wordless ooh.
  // It is deliberately quiet: this is pool-hall atmosphere, not a vocal lead.
  for(const [ratio,formant] of [[1,510],[1.006,780]]){
   const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type='sine';o.frequency.value=pitch*ratio
   f.type='bandpass';f.frequency.value=formant;f.Q.value=5;g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(gain,at+.08);g.gain.exponentialRampToValueAtTime(.0001,at+duration)
   o.connect(f);f.connect(g);g.connect(master);o.start(at);o.stop(at+duration+.04)
  }
 }
 const lead=(at,duration,pitch,gain,preset)=>{
  if(preset.lead==='ooh')return vocal(at,duration,pitch,gain*.55)
  if(preset.lead==='bass')return note(at,duration*1.25,pitch/2,gain*.95,'sine')
  if(preset.lead==='bell'){
   note(at,duration*.72,pitch,gain*.72,'sine')
   return note(at,duration*.42,pitch*2.76,gain*.27,'sine')
  }
  // The second, quieter partial gives the piano station a felt-hammer edge.
  note(at,duration,pitch,gain*.82,'sine')
  note(at,duration*.36,pitch*2,gain*.18,'triangle')
 }
 const hz=n=>440*Math.pow(2,(n-69)/12)
 function schedule(){
  if(!enabled||!ctx||ctx.state!=='running')return
  const p=current(),beat=60/p.bpm,at=ctx.currentTime+.04,scale=scales[p.scale]
  // A quiet bass pulse, lounge chord tones, and a sparse melody make the music
  // feel like background atmosphere instead of competing with a shot.
  const chord=(Math.floor(step/4)+p.variation)%scale.length
  note(at,beat*.8,hz(p.root-12+(step%8===0?7:0)),.065,'sine')
  if(step%2===0){note(at,beat*.92,hz(p.root+scale[chord]),.035,p.wave);note(at,beat*.92,hz(p.root+scale[(chord+2)%scale.length]),.028,p.wave)}
  const melody=(step*3+p.variation*5)%11
  if(melody<6){const pitch=hz(p.root+12+scale[melody%scale.length]);if(p.lead!=='ooh'||step%4===1)lead(at+beat*.48,beat*.42,pitch,.048,p)}
  step=(step+1)%64
  timer=setTimeout(schedule,Math.max(80,beat*1000-20))
 }
 const startSynth=()=>{if(!enabled)return;const c=context();if(!c)return;c.resume().then(()=>{if(!enabled||timer)return;master.gain.cancelScheduledValues(c.currentTime);master.gain.linearRampToValueAtTime(volume,c.currentTime+.16);schedule()}).catch(()=>{})}
 const stopSynth=()=>{clearTimeout(timer);timer=null;if(ctx)master.gain.linearRampToValueAtTime(.0001,ctx.currentTime+.12)}
 const stop=()=>{
  stopSynth()
  if(stream){
   const old=stream;stream=null
   // Clearing src can emit an error. Detach the callbacks first so replacing a
   // track never starts an extra song in the background.
   old.onended=null;old.onerror=null;old.pause();old.removeAttribute('src');old.load()
  }
 }
 const playTrack=track=>{
  if(!enabled||!track)return
  const audio=new Audio(track.url);stream=audio;audio.volume=Math.min(1,volume);audio.preload='auto'
  remember(track)
  remoteTitle=track.title||'Pool Masters Radio';remoteCreator=track.creator||'Unknown artist';remoteLicense=`CC ${track.license?.toUpperCase()}`;remoteCredit=`${remoteCreator} · ${remoteLicense}`
  listeners.forEach(listener=>listener({title:remoteTitle,creator:remoteCreator,license:remoteLicense,url:track.foreign_landing_url||track.url}))
  audio.onended=()=>{if(stream!==audio||!enabled)return;stream=null;startRadio()}
  audio.onerror=()=>{if(stream!==audio||!enabled)return;stream=null;startRadio()}
  audio.play().catch(()=>{if(stream===audio){stream=null;startSynth()}})
 }
 async function startRadio(){
  if(!enabled||stream||loading)return
  const next=queue.pop();if(next)return playTrack(next)
  loading=true
  try{
   const query=nextSearch()
   const response=await fetch(`https://api.openverse.org/v1/audio/?q=${encodeURIComponent(query)}&source=jamendo&license=by,by-sa&page_size=20`)
   const data=await response.json()
   const candidates=(data.results||[]).filter(track=>track.source==='jamendo'&&track.url?.startsWith('https://')&&track.duration>=90000&&['by','by-sa'].includes(track.license))
   // Do not replay a song until 80 other selections have been remembered.
   queue=shuffled(candidates.filter(track=>!playedSet.has(track.foreign_landing_url||track.url)))
   if(!queue.length)queue=shuffled(candidates)
   if(queue.length)playTrack(queue.pop());else startSynth()
  }catch{startSynth()}finally{loading=false}
 }
 return {
  get enabled(){return enabled},get title(){return remoteTitle||current().name},get credit(){return remoteCredit},get lyric(){return current().lyric},get volume(){return volume},
  onTrack(listener){listeners.add(listener);return()=>listeners.delete(listener)},
  setEnabled(value){enabled=!!value;if(enabled)startRadio();else stop()},
  setVolume(value){volume=Math.max(.1,Math.min(1,Number(value)||1));if(stream)stream.volume=volume;if(enabled&&ctx)master.gain.linearRampToValueAtTime(volume,ctx.currentTime+.08)},
  duck(ms=1200){
   if(!enabled)return
   clearTimeout(duckTimer)
   if(stream)stream.volume=Math.min(.22,volume)
   if(ctx)master.gain.linearRampToValueAtTime(Math.min(.22,volume),ctx.currentTime+.04)
   duckTimer=setTimeout(()=>{if(stream)stream.volume=volume;if(ctx)master.gain.linearRampToValueAtTime(volume,ctx.currentTime+.12)},ms)
  },
  resume(){if(enabled)startRadio()},
  shuffle(){index=(index+1+Math.floor(Math.random()*(MUSIC_PRESETS.length-1)))%MUSIC_PRESETS.length;step=0;remoteTitle='';remoteCredit='';remoteCreator='';remoteLicense='';if(enabled){stop();startRadio()}return current().name},
  destroy(){enabled=false;stop();ctx?.close().catch(()=>{})}
 }
}
