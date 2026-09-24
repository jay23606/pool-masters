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
 let ctx,master,enabled=false,volume=.28,index=Math.floor(Math.random()*MUSIC_PRESETS.length),timer,step=0
 const current=()=>MUSIC_PRESETS[index]
 const context=()=>{
  if(ctx)return ctx
  const C=window.AudioContext||window.webkitAudioContext
  if(!C)return null
  ctx=new C();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);return ctx
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
 const hz=n=>440*Math.pow(2,(n-69)/12)
 function schedule(){
  if(!enabled||!ctx||ctx.state!=='running')return
  const p=current(),beat=60/p.bpm,at=ctx.currentTime+.04,scale=scales[p.scale]
  // A quiet bass pulse, lounge chord tones, and a sparse melody make the music
  // feel like background atmosphere instead of competing with a shot.
  const chord=(Math.floor(step/4)+p.variation)%scale.length
  note(at,beat*.8,hz(p.root-12+(step%8===0?7:0)),.025,'sine')
  if(step%2===0){note(at,beat*.92,hz(p.root+scale[chord]),.013,p.wave);note(at,beat*.92,hz(p.root+scale[(chord+2)%scale.length]),.01,p.wave)}
  const melody=(step*3+p.variation*5)%11
  if(melody<6){const pitch=hz(p.root+12+scale[melody%scale.length]);if(p.lead==='ooh'&&step%4===1)vocal(at+beat*.44,beat*.72,pitch,.008);else note(at+beat*.48,beat*.32,pitch,p.lead==='bell'?.012:.017,p.lead==='piano'?'sine':p.wave,(p.variation-1.5)*3)}
  step=(step+1)%64
  timer=setTimeout(schedule,Math.max(80,beat*1000-20))
 }
 const start=()=>{if(!enabled)return;const c=context();if(!c)return;c.resume().then(()=>{if(!enabled||timer)return;master.gain.cancelScheduledValues(c.currentTime);master.gain.linearRampToValueAtTime(volume,c.currentTime+.16);schedule()}).catch(()=>{})}
 const stop=()=>{clearTimeout(timer);timer=null;if(ctx)master.gain.linearRampToValueAtTime(.0001,ctx.currentTime+.12)}
 return {
  get enabled(){return enabled},get title(){return current().name},get lyric(){return current().lyric},get volume(){return volume},
  setEnabled(value){enabled=!!value;if(enabled)start();else stop()},
  setVolume(value){volume=Math.max(.04,Math.min(.6,Number(value)||.28));if(enabled&&ctx)master.gain.linearRampToValueAtTime(volume,ctx.currentTime+.08)},
  resume(){if(enabled)start()},
  shuffle(){index=(index+1+Math.floor(Math.random()*(MUSIC_PRESETS.length-1)))%MUSIC_PRESETS.length;step=0;if(enabled){stop();start()}return current().name},
  destroy(){enabled=false;stop();ctx?.close().catch(()=>{})}
 }
}
