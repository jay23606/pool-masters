import './style.css'
import { createClient } from '@supabase/supabase-js'
import { createFoyer } from '@jay23606/foyer'
import { PoolGame } from './pool.js'

const SUPABASE_URL='https://zbtgonklxweikgukzukg.supabase.co'
const SUPABASE_KEY='sb_publishable_Tpkd3FzWhsfldMll-gIqfg_74YVroef'
const sb=createClient(SUPABASE_URL,SUPABASE_KEY)
const foyer=createFoyer({supabase:sb,url:SUPABASE_URL,anonKey:SUPABASE_KEY,hostMigration:false,peerGraceMs:5000})
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const state={room:null,net:null,game:null,media:null,unsubs:[],mode:'lobby',opponent:null,rankings:[],profile:null}

document.querySelector('#app').innerHTML=`
<header><button class="brand" id="home">● Pool Masters</button><div class="identity"><span id="mini-rating"></span><button id="edit-name" class="ghost"></button></div></header>
<main>
 <section id="lobby" class="screen active"><div class="hero"><p class="eyebrow">THE TABLE IS OPEN</p><h1>Rack up.<br><em>Play anyone.</em></h1><p>Instant rooms, live chat, and calls. No account required.</p><div class="actions"><button id="quick" class="primary">Find a game</button><button id="practice">Practice vs AI</button></div><div class="join"><input id="code" maxlength="5" placeholder="ROOM CODE"><button id="join">Join</button></div></div><div class="lobby-side"><div class="panel"><div class="panel-title"><h2>Open tables</h2><button id="refresh" class="icon">↻</button></div><div id="rooms" class="room-list"></div><button id="create" class="wide">+ Create a private table</button></div><div class="panel leaderboard"><h2>League leaders</h2><div id="leaders"></div></div></div></section>
 <section id="game" class="screen"><div class="game-top"><div><button id="leave" class="ghost">← Lobby</button><span id="room-label"></span></div><div class="call-actions"><button id="copy" class="ghost">Copy invite</button><button id="call">Start call</button></div></div><div class="play-layout"><div class="table-card"><div id="versus"></div><div class="canvas-wrap"><canvas id="table" width="700" height="380"></canvas><div id="callout"></div></div><div class="shot-controls"><label>Power <input id="power" type="range" min="1" max="100" value="45"><output>45%</output></label><button id="shoot" class="primary" disabled>Shoot</button></div><div id="game-status"></div></div><aside><div id="video-panel"><video id="remote-video" autoplay playsinline></video><video id="local-video" autoplay playsinline muted></video><div class="media-controls"><button id="mute">Mic</button><button id="camera">Camera</button></div></div><div class="chat"><div id="messages"></div><form id="chat-form"><input id="message" maxlength="500" autocomplete="off" placeholder="Message the room"><button>Send</button></form></div></aside></div></section>
</main><dialog id="name-dialog"><form method="dialog"><h2>Choose your name</h2><p>This device remembers you. You can change it anytime.</p><input id="name" maxlength="24" placeholder="Pool player" required><div><button value="cancel" class="ghost">Cancel</button><button id="save-name" value="default" class="primary">Continue</button></div></form></dialog><div id="toast"></div>`

function toast(text){const e=$('#toast');e.textContent=text;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2200)}
async function boot(){
 let name=localStorage.getItem('pool-masters:name')||''
 if(!name){name=`Player ${Math.floor(100+Math.random()*900)}`;localStorage.setItem('pool-masters:name',name)}
 await foyer.signIn(name); $('#edit-name').textContent=foyer.player.name; await ensureLeagueProfile(); bind(); await refresh();
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
 $('#copy').onclick=async()=>{await navigator.clipboard.writeText(location.href);toast('Invite link copied')};$('#call').onclick=startCall;$('#mute').onclick=()=>{state.media?.toggleMuted();$('#mute').classList.toggle('on')};$('#camera').onclick=()=>{state.media?.toggleCamera();$('#camera').classList.toggle('on')}
 $('#chat-form').onsubmit=async e=>{e.preventDefault();const input=$('#message'),body=input.value.trim();if(!body||!state.room)return;input.value='';await state.room.say(body)}
 window.addEventListener('popstate',()=>{if(!new URLSearchParams(location.search).get('room'))leaveRoom(false)})
}
async function createRoom(){try{const room=await foyer.createRoom({name:`${foyer.player.name}'s table`,metadata:{game:'pool',ranked:true},maxPlayers:2,status:'waiting'});await enterRoom(room)}catch(e){toast(e.message)}}
async function quickPlay(){
 const rooms=(await foyer.listRooms()).filter(r=>r.metadata?.game==='pool'&&r.playerCount<2)
 if(rooms[0])return joinRoom(rooms[0].code);await createRoom()
}
async function joinRoom(code){code=String(code||'').trim().toUpperCase();if(!code)return toast('Enter a room code');try{await enterRoom(await foyer.join(code))}catch(e){toast(e.message||'Could not join that room')}}
async function enterRoom(room){
 state.room=room;state.mode='online';showGame();history.replaceState({},'',`?room=${room.code}`);$('#room-label').textContent=`Room ${room.code}`
 state.unsubs.push(room.on('players',players=>onPlayers(players)),room.on('message',appendMessage),room.on('closed',()=>{toast('The table closed');leaveRoom()}))
 ;(await room.history(80)).forEach(appendMessage);state.net=room.connect({topology:'star'});state.net.on('data',({data})=>{try{state.game?.receive(JSON.parse(data))}catch{}});state.net.on('peer',()=>state.game?.sync())
 state.game=new PoolGame({canvas:$('#table'),status:$('#game-status'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),host:room.isHost,practice:false,send:broadcastGame,onFinish:finishRanked})
 onPlayers(room.players);await room.update?.({status:room.players.length>=2?'playing':'waiting'}).catch(()=>{})
}
function broadcastGame(data){state.net?.peers?.forEach(p=>p.send(JSON.stringify(data)))}
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
function startPractice(){state.mode='practice';state.room=null;state.opponent={name:'AI Coach'};showGame();history.replaceState({},'',location.pathname);$('#room-label').textContent='Unranked practice';$('#versus').innerHTML=`<span><b>${esc(foyer.player.name)}</b><small>You</small></span><i>vs</i><span><b>AI Coach</b><small>Practice</small></span>`;state.game=new PoolGame({canvas:$('#table'),status:$('#game-status'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),host:true,practice:true,send:()=>{},onFinish:()=>{}});$('#video-panel').hidden=true;$('.chat').hidden=true}
function showGame(){$('#lobby').classList.remove('active');$('#game').classList.add('active');$('#messages').innerHTML='';$('#video-panel').hidden=false;$('.chat').hidden=false}
async function startCall(){if(!state.room)return;try{if(!state.media){state.media=state.room.media();state.media.onStream((_,s)=>{$('#remote-video').srcObject=s;$('#video-panel').classList.add('live')});state.media.onLeave(()=>{$('#remote-video').srcObject=null});const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});$('#local-video').srcObject=stream;await state.media.start(stream);$('#call').textContent='End call';return}state.media.stop();state.media=null;$('#local-video').srcObject=null;$('#remote-video').srcObject=null;$('#call').textContent='Start call'}catch(e){toast('Camera or microphone unavailable')}}
async function leaveRoom(push=true){state.game?.destroy();state.game=null;state.media?.stop();state.media=null;state.net?.close();state.net=null;state.unsubs.splice(0).forEach(fn=>fn?.());if(state.room)await state.room.leave().catch(()=>{});state.room=null;state.mode='lobby';$('#game').classList.remove('active');$('#lobby').classList.add('active');if(push)history.pushState({},'',location.pathname);await refresh()}
boot().catch(e=>{console.error(e);toast('Could not connect. Reload to try again.')})
