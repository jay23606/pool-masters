import './style.css'
import { createClient } from '@supabase/supabase-js'
import { createFoyer } from '@jay23606/foyer'
import { PoolGame } from './pool.js'
import { createRenderer2D } from './render2d.js'
import { createSfx } from './sfx.js'
import { TABLE_SIZES,setTableSize } from './table.js'

const SUPABASE_URL='https://zbtgonklxweikgukzukg.supabase.co'
const SUPABASE_KEY='sb_publishable_Tpkd3FzWhsfldMll-gIqfg_74YVroef'
const sb=createClient(SUPABASE_URL,SUPABASE_KEY)
const foyer=createFoyer({supabase:sb,url:SUPABASE_URL,anonKey:SUPABASE_KEY,hostMigration:false,peerGraceMs:5000})
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const state={room:null,net:null,peers:new Map(),game:null,media:null,unsubs:[],mode:'lobby',opponent:null,rankings:[],profile:null}
// The table button cycles three views. Top-down 3D is the default: the plan
// view of the 2D renderer, but lit and shaded. New storage key: the old one
// was written on every load rather than on a deliberate switch, so a value
// stored under it says nothing about what the player actually chose.
const VIEWS=['top','3d','2d'],VIEW_LABEL={top:'TOP','3d':'3D','2d':'2D'}
const stored=localStorage.getItem('pool-masters:table-view')
const sfx=createSfx()
sfx.setEnabled(localStorage.getItem('pool-masters:muted')!=='1')
// an AudioContext may only start from a gesture, so take the first one going
addEventListener('pointerdown',()=>sfx.resume(),{once:true})
const view={mode:VIEWS.includes(stored)?stored:'top',renderer:null,switching:false}
const FELTS={green:'#17794b',blue:'#176c88',burgundy:'#712e3c',charcoal:'#34443d'}
const tablePrefs={size:Number(localStorage.getItem('pool-masters:table-size'))||7,felt:localStorage.getItem('pool-masters:felt')||FELTS.green}
if(!TABLE_SIZES[tablePrefs.size])tablePrefs.size=7
setTableSize(tablePrefs.size)

document.querySelector('#app').innerHTML=`
<header><button class="brand" id="home">● Pool Masters</button><div class="identity"><span id="mini-rating"></span><button id="edit-name" class="ghost"></button></div></header>
<main>
 <section id="lobby" class="screen active"><div class="hero"><p class="eyebrow">THE TABLE IS OPEN</p><h1>Rack up.<br><em>Play anyone.</em></h1><p>Instant rooms, live chat, and calls. No account required.</p><div class="actions"><button id="quick" class="primary">Find a game</button><button id="practice">Practice vs AI</button></div><div class="join"><input id="code" maxlength="5" placeholder="ROOM CODE"><button id="join">Join</button></div></div><div class="lobby-side"><div class="panel"><div class="panel-title"><h2>Open tables</h2><button id="refresh" class="icon">↻</button></div><div id="rooms" class="room-list"></div><button id="create" class="wide">+ Create a private table</button></div><div class="panel leaderboard"><h2>League leaders</h2><div id="leaders"></div></div></div></section>
 <section id="game" class="screen"><div class="game-top"><div><button id="leave" class="ghost">← Leave room</button><span id="room-label"></span><button id="rename-room" class="ghost" hidden>Rename</button></div><div class="call-actions"><button id="focus-table" class="ghost">Focus table</button><button id="copy" class="ghost">Copy invite</button><button id="call">Start call</button></div></div><div class="play-layout"><div class="table-card"><div id="versus"></div><div class="table-bar"><div id="groups"></div><div class="view-buttons"><button id="mute-sfx" class="view-toggle sfx-toggle" title="Table sound"></button><button id="view-3d" class="view-toggle" title="Switch table view: top-down 3D, angled 3D, flat 2D">TOP</button></div></div><div class="canvas-wrap"><canvas id="table" width="700" height="380"></canvas><canvas id="table3d" hidden></canvas><div id="callout"></div></div><div class="shot-controls"><div id="spin" class="spin" title="Cue tip contact point. Drag for draw, follow and English; double-click to centre."><i></i></div><label>Power <input id="power" type="range" min="1" max="100" value="45"><output>45%</output></label><button id="shoot" class="primary" disabled>Shoot</button><button id="next-rack" hidden>Next rack</button><button id="move-cue" class="redo" hidden>Move cue ball</button><button id="change-pocket" class="redo" hidden>Change 8-ball pocket</button></div><div id="game-status"></div><div id="practice-record" hidden></div></div><aside id="room-sidebar"><div id="video-panel"><video id="remote-video" autoplay playsinline></video><video id="local-video" autoplay playsinline muted></video><div class="media-controls"><button id="mute">Mic</button><button id="camera">Camera</button></div></div><div class="chat"><div id="messages"></div><form id="chat-form"><input id="message" maxlength="500" autocomplete="off" placeholder="Message the room"><button>Send</button></form></div></aside></div></section>
</main><dialog id="name-dialog"><form method="dialog"><h2>Choose your name</h2><p>This device remembers you. You can change it anytime.</p><input id="name" maxlength="24" placeholder="Pool player" required><div><button value="cancel" class="ghost">Cancel</button><button id="save-name" value="default" class="primary">Continue</button></div></form></dialog><dialog id="room-dialog"><form method="dialog"><h2>Name this table</h2><p>Players will see this name in the open-table list.</p><input id="room-name" maxlength="48" placeholder="Friday night pool" required><div><button value="cancel" class="ghost">Cancel</button><button id="save-room-name" value="default" class="primary">Save</button></div></form></dialog><div id="toast"></div>`
$('.view-buttons').insertAdjacentHTML('afterbegin','<button id="table-settings" class="view-toggle" title="Table size and felt">TABLE</button>')
document.body.insertAdjacentHTML('beforeend','<dialog id="table-dialog"><form method="dialog"><h2>Set up the table</h2><p>Table size changes the ball-to-table proportion. Changing it starts a fresh rack.</p><label>Table size <select id="table-size"><option value="7">7 ft · bar</option><option value="8">8 ft · home</option><option value="9">9 ft · league</option></select></label><label>Felt <select id="felt"><option value="green">Classic green</option><option value="blue">Tournament blue</option><option value="burgundy">Burgundy</option><option value="charcoal">Charcoal</option></select></label><div><button value="cancel" class="ghost">Cancel</button><button id="save-table" value="default" class="primary">Apply</button></div></form></dialog>')

// The renderer is swappable at any time: the game owns the simulation, the
// renderer only draws it and maps pointer events back to table coordinates.
const cameraFor=m=>m==='3d'?'angled':'top'
async function buildRenderer(){
 if(view.mode!=='2d'){
  try{const{createRenderer3D}=await import('./render3d.js');return await createRenderer3D($('#table3d'),cameraFor(view.mode),tablePrefs)}
  catch(e){console.warn('3D renderer unavailable',e);view.mode='2d';toast('3D is unavailable on this device')}
 }
 return createRenderer2D($('#table'),tablePrefs)
}
async function rebuildRenderer(){view.renderer?.destroy();view.renderer=null;await applyView(false)}
async function applyTablePrefs(size=tablePrefs.size,felt=tablePrefs.felt,{fresh=true,remote=false}={}){
 tablePrefs.size=setTableSize(size);tablePrefs.felt=felt
 localStorage.setItem('pool-masters:table-size',tablePrefs.size);localStorage.setItem('pool-masters:felt',felt)
 await rebuildRenderer()
 if(fresh&&state.game){state.game.resetRack();state.game.sync()}
 if(!remote)toast(`${TABLE_SIZES[tablePrefs.size].label} table ready`)
}
async function applyView(persist){
 if(view.switching)return
 view.switching=true
 try{
  if(view.mode!=='2d'&&view.renderer?.mode==='3d')view.renderer.setCamera(cameraFor(view.mode))
  else{
   const next=await buildRenderer()
   view.renderer?.destroy();view.renderer=next
   state.game?.setRenderer(next)
  }
  const r=view.renderer
  $('#table').hidden=r.mode!=='2d';$('#table3d').hidden=r.mode!=='3d'
  $('#view-3d').textContent=VIEW_LABEL[view.mode]
  $('#view-3d').classList.toggle('on',r.mode==='3d')
  if(persist)localStorage.setItem('pool-masters:table-view',view.mode)
  r.resize()
 }finally{view.switching=false}
}
async function ensureRenderer(){if(!view.renderer)await applyView();return view.renderer}

function toast(text){const e=$('#toast');e.textContent=text;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2200)}
async function boot(){
 let name=localStorage.getItem('pool-masters:name')||''
 if(!name){name=`Player ${Math.floor(100+Math.random()*900)}`;localStorage.setItem('pool-masters:name',name)}
 await foyer.signIn(name); $('#edit-name').textContent=foyer.player.name; await ensureLeagueProfile(); bind(); await ensureRenderer(); await refresh();
 const code=new URLSearchParams(location.search).get('room'); if(code) await joinRoom(code)
}
async function ensureLeagueProfile(){
 await sb.rpc('pm_upsert_profile',{p_username:foyer.player.name})
 const {data}=await sb.from('pm_profiles').select('*').eq('id',foyer.player.id).single();state.profile=data;renderIdentity()
}
function renderIdentity(){const p=state.profile;$('#edit-name').textContent=p?.username||foyer.player.name;$('#mini-rating').textContent=p?`${p.rating} Elo · ${p.wins}W ${p.losses}L`:''}
async function refresh(){
 const [rooms,leaders]=await Promise.all([foyer.listRooms(),sb.from('pm_profiles').select('id,username,rating,wins,losses,current_streak').gt('wins','0').order('rating',{ascending:false}).limit(10)])
 state.rankings=leaders.data||[];renderRooms(rooms.filter(r=>r.metadata?.game==='pool'));renderLeaders()
}
function renderRooms(rooms){$('#rooms').innerHTML=rooms.length?rooms.map(r=>`<button class="room" data-code="${r.code}"><span><b>${esc(r.name||r.hostName+"'s table")}</b><small>${esc(r.hostName)} · ${r.playerCount}/2</small></span><strong>${r.code}</strong></button>`).join(''):'<div class="empty">No open tables yet.<br>Create one or practice while you wait.</div>'}
function renderLeaders(){const rows=state.rankings;$('#leaders').innerHTML=rows.length?rows.map((p,i)=>`<div class="leader"><i>${i+1}</i><span>${esc(p.username)}</span><b>${p.rating}</b><small>${p.wins+p.losses?Math.round(p.wins/(p.wins+p.losses)*100):0}%</small></div>`).join(''):'<div class="empty">The first match sets the board.</div>'}
function bind(){
 $('#home').onclick=()=>leaveRoom();$('#leave').onclick=()=>leaveRoom();$('#refresh').onclick=refresh
 $('#create').onclick=createRoom;$('#quick').onclick=quickPlay;$('#practice').onclick=()=>startPractice();$('#join').onclick=()=>joinRoom($('#code').value)
 $('#code').oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'');$('#rooms').onclick=e=>{const b=e.target.closest('[data-code]');if(b)joinRoom(b.dataset.code)}
 $('#edit-name').onclick=()=>{$('#name').value=foyer.player.name;$('#name-dialog').showModal()}
 $('#save-name').onclick=async e=>{e.preventDefault();const n=$('#name').value.trim().slice(0,24);if(!n)return;await foyer.signIn(n);localStorage.setItem('pool-masters:name',n);await ensureLeagueProfile();$('#name-dialog').close();toast('Name saved')}
 $('#rename-room').onclick=()=>{if(!state.room?.isHost)return;$('#room-name').value=state.room.name||'';$('#room-dialog').showModal()}
 $('#save-room-name').onclick=async e=>{e.preventDefault();const name=$('#room-name').value.trim().slice(0,48);if(!name||!state.room?.isHost)return;try{await state.room.update({name});$('#room-label').textContent=name;$('#room-dialog').close();toast('Table name saved')}catch(err){toast(err.message||'Could not rename table')}}
 $('#next-rack').onclick=()=>{if(state.mode==='practice'){state.game?.newRack();$('#next-rack').hidden=true}}
 $('#focus-table').onclick=()=>{const focused=$('#game').classList.toggle('focus');$('#focus-table').textContent=focused?'Show chat':'Focus table';view.renderer?.resize()}
 $('#table-settings').onclick=()=>{$('#table-size').value=tablePrefs.size;$('#felt').value=Object.entries(FELTS).find(([,v])=>v===tablePrefs.felt)?.[0]||'green';$('#table-dialog').showModal()}
 $('#save-table').onclick=async e=>{e.preventDefault();await applyTablePrefs(Number($('#table-size').value),FELTS[$('#felt').value]);$('#table-dialog').close()}
 const paintSfx=()=>{$('#mute-sfx').textContent=sfx.enabled?'♪':'✕';$('#mute-sfx').classList.toggle('on',sfx.enabled)}
 $('#mute-sfx').onclick=()=>{sfx.setEnabled(!sfx.enabled);localStorage.setItem('pool-masters:muted',sfx.enabled?'0':'1');paintSfx()}
 paintSfx()
 $('#view-3d').onclick=()=>{view.mode=VIEWS[(VIEWS.indexOf(view.mode)+1)%VIEWS.length];applyView(true)}
 $('#copy').onclick=async()=>{await navigator.clipboard.writeText(location.href);toast('Invite link copied')};$('#call').onclick=startCall;$('#mute').onclick=()=>{state.media?.toggleMuted();$('#mute').classList.toggle('on')};$('#camera').onclick=()=>{state.media?.toggleCamera();$('#camera').classList.toggle('on')}
 $('#chat-form').onsubmit=async e=>{e.preventDefault();const input=$('#message'),body=input.value.trim();if(!body||!state.room)return;input.value='';await state.room.say(body)}
 window.addEventListener('popstate',()=>{if(!new URLSearchParams(location.search).get('room'))leaveRoom(false)})
}
async function createRoom(){try{const room=await foyer.createRoom({name:`${foyer.player.name}'s table`,metadata:{game:'pool',ranked:true},maxPlayers:2,status:'waiting'});await enterRoom(room);$('#room-name').value=room.name;$('#room-dialog').showModal()}catch(e){toast(e.message)}}
async function quickPlay(){
 const rooms=(await foyer.listRooms()).filter(r=>r.metadata?.game==='pool'&&r.playerCount<2)
 if(rooms[0])return joinRoom(rooms[0].code);await createRoom()
}
async function joinRoom(code){code=String(code||'').trim().toUpperCase();if(!code)return toast('Enter a room code');try{await enterRoom(await foyer.join(code))}catch(e){toast(e.message||'Could not join that room')}}
async function enterRoom(room){
 state.game?.destroy();state.game=null;state.room=room;state.mode='online';showGame();$('.call-actions').hidden=false;$('#rename-room').hidden=!room.isHost;history.replaceState({},'',`?room=${room.code}`);$('#room-label').textContent=room.name||`Room ${room.code}`
 state.unsubs.push(room.on('players',players=>onPlayers(players)),room.on('message',appendMessage),room.on('closed',()=>{toast('The table closed');leaveRoom()}))
 ;(await room.history(80)).forEach(appendMessage);state.net=await room.connect({topology:'star'});state.net.on('data',({data})=>{try{state.game?.receive(JSON.parse(data))}catch{}});state.net.on('peer',peer=>{state.peers.set(peer.id,peer);state.game?.sync()});state.net.on('leave',id=>state.peers.delete(id))
 state.game=new PoolGame({renderer:await ensureRenderer(),surface:$('.canvas-wrap'),status:$('#game-status'),groupStatus:$('#groups'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),spinPad:$('#spin'),moveCue:$('#move-cue'),changePocket:$('#change-pocket'),sfx,host:room.isHost,practice:false,send:broadcastGame,onFinish:finishRanked})
 onPlayers(room.players);await room.update?.({status:room.players.length>=2?'playing':'waiting'}).catch(()=>{})
}
function broadcastGame(data){state.peers.forEach(p=>p.send(JSON.stringify(data)))}
function onPlayers(players){
 const mine=players.find(p=>p.id===foyer.player.id),other=players.find(p=>p.id!==foyer.player.id);state.opponent=other||null
 $('#versus').innerHTML=`<span><b>${esc(mine?.name||foyer.player.name)}</b><small>You</small></span><i>vs</i><span><b>${esc(other?.name||'Waiting…')}</b><small>${other?'Opponent':'Share the code'}</small></span>`
 state.game?.setReady(Boolean(other));if(other&&state.room?.isHost)state.room.update({status:'playing',isOpen:false}).catch(()=>{})
}
function appendMessage(m){const log=$('#messages');if(document.getElementById(`msg-${m.id}`))return;const row=document.createElement('div');row.id=`msg-${m.id}`;row.className=m.system?'system':'message';row.innerHTML=m.system?esc(m.body):`<b>${esc(m.playerName)}</b><span>${esc(m.body)}</span>`;log.append(row);log.scrollTop=log.scrollHeight}
async function finishRanked(result){
 if(state.mode!=='online'||!state.room||!state.opponent)return
 const winner=result==='a'?(state.room.isHost?foyer.player.id:state.opponent.id):(state.room.isHost?state.opponent.id:foyer.player.id)
 const gameId=`${state.room.id}:${result.round}`;const {error}=await sb.rpc('pm_report_result',{p_game_id:gameId,p_room_id:state.room.id,p_winner:winner,p_loser:winner===foyer.player.id?state.opponent.id:foyer.player.id})
 if(error)console.warn(error);setTimeout(async()=>{await ensureLeagueProfile();await refresh()},900)
}
function aiRecord(){try{return JSON.parse(localStorage.getItem('pool-masters:ai-record'))||{wins:0,losses:0}}catch{return{wins:0,losses:0}}}
function renderAiRecord(){const r=aiRecord(),games=r.wins+r.losses;$('#practice-record').hidden=false;$('#practice-record').textContent=`Against AI · ${r.wins}W–${r.losses}L${games?` · ${Math.round(r.wins/games*100)}% wins`:''}`}
function recordAiResult(won){const r=aiRecord();r[won?'wins':'losses']=(r[won?'wins':'losses']||0)+1;localStorage.setItem('pool-masters:ai-record',JSON.stringify(r));renderAiRecord()}
async function startPractice(){state.game?.destroy();state.mode='practice';state.room=null;state.opponent={name:'AI Coach'};showGame();$('#game').classList.add('focus');history.replaceState({},'',location.pathname);$('#room-label').textContent='Unranked practice';$('#versus').innerHTML=`<span><b>${esc(foyer.player.name)}</b><small>You</small></span><i>vs</i><span><b>AI Coach</b><small>Practice</small></span>`;renderAiRecord();state.game=new PoolGame({renderer:await ensureRenderer(),surface:$('.canvas-wrap'),status:$('#game-status'),groupStatus:$('#groups'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),spinPad:$('#spin'),moveCue:$('#move-cue'),changePocket:$('#change-pocket'),sfx,host:true,practice:true,send:()=>{},onFinish:result=>{recordAiResult(result.winner==='a');$('#next-rack').hidden=false}});$('.call-actions').hidden=true;$('#room-sidebar').hidden=true}
function showGame(){$('#lobby').classList.remove('active');$('#game').classList.add('active');$('#game').classList.remove('focus');$('#focus-table').textContent='Focus table';$('#messages').innerHTML='';$('#room-sidebar').hidden=false;$('#practice-record').hidden=true;$('#next-rack').hidden=true}
async function startCall(){if(!state.room)return;try{if(!state.media){state.media=state.room.media();state.media.onStream((_,s)=>{$('#remote-video').srcObject=s;$('#video-panel').classList.add('live')});state.media.onLeave(()=>{$('#remote-video').srcObject=null});const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});$('#local-video').srcObject=stream;await state.media.start(stream);$('#call').textContent='End call';return}state.media.stop();state.media=null;$('#local-video').srcObject=null;$('#remote-video').srcObject=null;$('#call').textContent='Start call'}catch(e){toast('Camera or microphone unavailable')}}
async function leaveRoom(push=true){state.game?.destroy();state.game=null;state.media?.stop();state.media=null;state.net?.close?.();state.net=null;state.peers.clear();state.unsubs.splice(0).forEach(fn=>fn?.());const oldRoom=state.room;state.room=null;state.mode='lobby';$('#game').classList.remove('active');$('#lobby').classList.add('active');if(push)history.pushState({},'',location.pathname);if(oldRoom)await oldRoom.leave().catch(()=>{});await refresh()}
// Registered after boot so it never delays first paint, and only in a build:
// a worker in dev would just cache things you are actively editing.
if(import.meta.env.PROD&&'serviceWorker'in navigator)
 addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('service worker not registered',e)))

boot().catch(e=>{console.error(e);toast('Could not connect. Reload to try again.')})
