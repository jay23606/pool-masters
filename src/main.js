import './style.css'
import { createClient } from '@supabase/supabase-js'
import { createFoyer } from '@jay23606/foyer'
import { PoolGame } from './pool.js'
import { createSfx } from './sfx.js'
import { createMusic } from './music.js'
import { setTableSize,tableSize,R as BALL_R } from './table.js'
import { FELTS,loadTablePrefs } from './preferences.js'
import { ofKind,isUnlocked,label as cosmeticLabel,usable,rewardsOf } from './cosmetics.js'
import { createViewManager } from './view-manager.js'
import { parseGameMessage } from './protocol.js'
import { snapshotOf } from './game-state.js'
import { winnerForResult } from './ranking.js'
import { AI_LEVELS } from './ai.js'
import { MODES,modeOf } from './rules.js'
import { pack,unpack } from './replay.js'
import { normalizeHouse,isDefault as houseIsDefault,describe as describeHouse,RACES,BALL_IN_HAND,BREAKERS,STRAIGHT_TARGETS,words as houseWords } from './house.js'
import { DRILLS,DRILL_TABLE,emptyProgress,recordDrill,doneCount,nextDrill } from './drills.js'
import { analyse,replayOf } from './coach.js'
import { record as recordRogue,emptyRecord as emptyRogue } from './rogue.js'
import { CHALLENGES,byId as challengeById,emptyResults,record as recordChallenge,format as formatChallenge } from './challenges.js'
import { LADDER,byId as opponentById,emptyCareer,isBeaten,isOpen,recordWin,summaryOf,nextOpponent,beatenCount } from './career.js'
import { dayNumber,dailyDrill,isDaily,dailyNumberOf,shareText } from './daily.js'
import { CONSTANTS,GROUPS as PHYS_GROUPS,valueOf,format as fmt,shotTable,tables as tableInfo,simulation } from './physics-info.js'
import { TROPHIES,GROUPS,emptyStats,applyEvent,newlyEarned,unlock,progressOf } from './trophies.js'
import { emptyScore,scoreRack,scoreLine,matchWinner,MATCH_TARGET } from './match-score.js'
import { occupancyLabel } from './room-summary.js'
import { emptyPerformance,recordPerformance,tableRecord } from './performance.js'
import { acceptsGameMessage } from './room-security.js'
import { spectatorMeta,roleFor,reconcileSpectators,admitSpectator,removeSpectator } from './spectators.js'

const SUPABASE_URL='https://zbtgonklxweikgukzukg.supabase.co'
const SUPABASE_KEY='sb_publishable_Tpkd3FzWhsfldMll-gIqfg_74YVroef'
const sb=createClient(SUPABASE_URL,SUPABASE_KEY)
// Phone browsers can suspend a WebRTC connection while switching to another
// app. Keep the seat and retry window long enough for an ordinary return; the
// authoritative host then sends the latest rack snapshot to the rejoined peer.
const foyer=createFoyer({supabase:sb,url:SUPABASE_URL,anonKey:SUPABASE_KEY,hostMigration:false,peerGraceMs:25000,reconnectAttempts:5,heartbeatMs:15000,staleSeconds:180})
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const state={room:null,net:null,peers:new Map(),game:null,media:null,unsubs:[],mode:'lobby',opponent:null,role:'pending',rankings:[],profile:null,matchScore:emptyScore(),saveTimer:null,pendingSave:null,lastSave:0}
document.documentElement.dataset.theme=localStorage.getItem('pool-masters:theme')||'dark'
const sfx=createSfx()
const music=createMusic()
sfx.setEnabled(localStorage.getItem('pool-masters:muted')!=='1')
sfx.setHaptics(localStorage.getItem('pool-masters:haptics')!=='0')
music.setVolume(localStorage.getItem('pool-masters:music-volume')||.2)
// an AudioContext may only start from a gesture, so take the first one going
addEventListener('pointerdown',()=>{sfx.resume();music.resume()},{once:true})
const tablePrefs=loadTablePrefs()
setTableSize(tablePrefs.size)

document.querySelector('#app').innerHTML=`
<header><button class="brand" id="home">● Pool Masters</button><div class="identity"><a class="ghost" href="feature.html" target="_blank" rel="noopener" title="How this compares to other pool games, and what is next">Roadmap</a><button id="theme-toggle" class="theme-toggle" title="Switch color theme">☼</button><span id="mini-rating"></span><button id="trophies" class="ghost" title="Trophies">🏆</button><button id="player-stats" class="ghost">Stats</button><button id="edit-name" class="ghost"></button></div></header>
<main>
 <section id="lobby" class="screen active"><div class="hero"><p class="eyebrow">THE TABLE IS OPEN</p><h1>Rack up.<br><em>Play anyone.</em></h1><p>Instant rooms, live chat, and calls. No account required.</p><div class="actions"><button id="quick" class="primary">Find a game</button><button id="practice">Practice vs AI</button><button id="career">Career</button><button id="house">House rules</button><button id="hotseat">Two players, one device</button><button id="daily">Daily shot</button><button id="challenges">Challenges</button><button id="rogue">Rogue Pool</button><button id="drills">Drills</button><select id="game-mode" aria-label="Game"><option value="8ball" selected>8-ball</option><option value="9ball">9-ball</option><option value="10ball">10-ball</option><option value="bank">Bank pool</option><option value="straight">Straight pool</option><option value="chaos">Chaos Pool</option><option value="onepocket">One-pocket</option></select><select id="ai-level" aria-label="AI difficulty"><option value="beginner">Beginner AI</option><option value="league" selected>League AI</option><option value="pro">Pro AI</option></select></div><div class="join"><input id="code" maxlength="5" placeholder="ROOM CODE"><button id="join">Join</button></div><div class="hero-art" aria-hidden="true"></div></div><div class="lobby-side"><div class="panel"><div class="panel-title"><h2>Open tables</h2><button id="refresh" class="icon">↻</button></div><div id="rooms" class="room-list"></div><button id="create" class="wide">+ Create a private table</button></div><div class="panel leaderboard"><h2>League leaders</h2><div id="leaders"></div></div></div></section>
 <section id="game" class="screen"><div class="game-top"><div><button id="leave" class="ghost">← Leave room</button><span id="room-label"></span><span id="match-score" class="match-score"></span><button id="rename-room" class="ghost" hidden>Rename</button></div><div id="spectator-requests"></div><div class="call-actions"><button id="focus-table" class="ghost">Focus table</button><button id="copy" class="ghost">Copy invite</button><button id="call">Start call</button></div></div><div class="play-layout"><div class="table-card"><div id="versus"></div><div class="table-bar"><div id="groups"></div><a id="music-credit" class="music-credit" target="_blank" rel="noopener" hidden></a><div class="view-buttons"><button id="music-toggle" class="view-toggle sfx-toggle" title="Background music"></button><input id="music-volume" class="music-volume" type="range" min="10" max="100" value="100" aria-label="Music volume" title="Music volume" hidden><button id="music-shuffle" class="view-toggle" title="Shuffle music">↻</button><button id="mute-sfx" class="view-toggle sfx-toggle" title="Table sound"></button><button id="view-3d" class="view-toggle" title="Switch table view: top-down 3D, angled 3D, flat 2D">TOP</button></div></div><div class="table-rot"><div class="canvas-wrap"><canvas id="table" width="700" height="380"></canvas><canvas id="table3d" hidden></canvas><div id="callout"></div></div></div><div class="table-side"><div class="shot-controls"><div id="spin" class="spin" title="Cue tip contact point. Drag for draw, follow and English; double-click to centre."><i></i></div><label>Power <input id="power" type="range" min="1" max="100" value="45"><output>45%</output></label><button id="jump" class="jump-toggle" type="button" hidden aria-pressed="false" title="Jump shot: the cue ball hops over balls in its way. Harder shots go further.">Jump</button><button id="shoot" class="primary" disabled>Shoot</button><button id="next-rack" hidden>Next rack</button><button id="move-cue" class="redo" hidden>Move cue ball</button><button id="change-pocket" class="redo" hidden>Change 8-ball pocket</button></div><div id="game-status"></div><div id="drill-bar" hidden><div id="drill-tip"></div><div id="drill-buttons"><button id="drill-hint" class="ghost" title="Set the aim, power and spin to a shot that works">Show me</button><button id="drill-retry" class="ghost">↺ Retry</button><button id="drill-next" class="ghost" hidden>Next drill →</button><button id="drill-share" class="ghost" hidden>Share result</button></div></div><div id="replay-bar" hidden><button id="replay-shot" class="ghost" title="Watch the last shot again">↺ Replay</button><button id="replay-slow" class="ghost" title="Watch it at a quarter of the speed">Slow motion</button><button id="share-replay" class="ghost" title="Copy a link that plays this shot for anyone">Copy replay link</button><button id="coach-open" class="ghost" title="What would a coach say about your last shot?">🎓 Coach</button><button id="replay-home" class="ghost" hidden>Play a game</button></div><div id="practice-record" hidden></div></div></div><aside id="room-sidebar"><div id="video-panel"><video id="remote-video" autoplay playsinline></video><video id="local-video" autoplay playsinline muted></video><div class="media-controls"><button id="mute" class="call-icon off" type="button" aria-label="Microphone is off. Turn it on" title="Microphone is off"></button><button id="camera" class="call-icon off" type="button" aria-label="Camera is off. Turn it on" title="Camera is off"></button></div></div><div class="chat"><div id="messages"></div><form id="chat-form"><input id="message" maxlength="500" autocomplete="off" placeholder="Message the room"><button>Send</button></form></div></aside></div></section>
</main><dialog id="name-dialog"><form method="dialog"><h2>Choose your name</h2><p>This device remembers you. You can change it anytime.</p><input id="name" maxlength="24" placeholder="Pool player" required><div><button value="cancel" class="ghost">Cancel</button><button id="save-name" value="default" class="primary">Continue</button></div></form></dialog><dialog id="room-dialog"><form method="dialog"><h2>Name this table</h2><p>Players will see this name in the open-table list.</p><input id="room-name" maxlength="48" placeholder="Friday night pool" required><div><button value="cancel" class="ghost">Cancel</button><button id="save-room-name" value="default" class="primary">Save</button></div></form></dialog><dialog id="stats-dialog"><form method="dialog"><h2>Your league record</h2><div id="stats-body"></div><div><button value="default" class="primary">Done</button></div></form></dialog><dialog id="result-dialog"><form method="dialog"><h2 id="result-title"></h2><p id="result-summary"></p><div><button id="share-result" type="button" class="ghost">Share result</button><button id="result-next" type="button" class="primary">Next rack</button><button value="default" class="ghost">Close</button></div></form></dialog><dialog id="trophies-dialog"><form method="dialog"><h2>Trophies</h2><p id="trophies-summary"></p><div id="trophy-list"></div><div><button value="default" class="primary">Done</button></div></form></dialog><dialog id="drills-dialog"><form method="dialog"><h2>Practice drills</h2><p id="drills-summary"></p><div id="drill-list"></div><div><button value="default" class="primary">Done</button></div></form></dialog><div id="toast"></div>`
$('.view-buttons').insertAdjacentHTML('beforeend','<button id="replay-menu" class="view-toggle" title="Replay the last shot" hidden aria-label=\"Replay the last shot\">⟲</button>')
$('.view-buttons').insertAdjacentHTML('afterbegin','<button id="table-settings" class="view-toggle" title="Table size and felt">TABLE</button>')
document.body.insertAdjacentHTML('beforeend','<dialog id="table-dialog"><form method="dialog"><h2>Set up the table</h2><p>Table size changes the ball-to-table proportion. Changing it starts a fresh rack.</p><label>Table size <select id="table-size"><option value="7">7 ft · bar</option><option value="8">8 ft · home</option><option value="9">9 ft · league</option></select></label><label>Felt <select id="felt"><option value="green">Classic green</option><option value="blue">Tournament blue</option><option value="burgundy">Burgundy</option><option value="charcoal">Charcoal</option></select></label><div><button value="cancel" class="ghost">Cancel</button><button id="save-table" value="default" class="primary">Apply</button></div></form></dialog>')
$('#table-dialog form').insertAdjacentHTML('beforeend','<label>Rails <select id="rails"></select></label><label>Cue finish <select id="cue-finish"><option value="classic">Classic maple</option><option value="ebony">Ebony</option><option value="midnight">Midnight blue</option></select></label><label>Room lighting <select id="lighting"><option value="hall">Pool hall</option><option value="warm">Warm lounge</option><option value="cool">Cool arena</option></select></label><label>Aim sensitivity <input id="aim-sensitivity" type="range" min="10" max="100" value="30"> <output id="aim-sensitivity-out"></output></label><label><input id="shot-cam" type="checkbox"> Follow the shot (3D views): swing the camera behind the cue while balls roll</label><label>Player height for the shot camera <input id="eye-height" type="range" min="16" max="160" step="2"> <output id="eye-height-out"></output></label><label><input id="snap-aim" type="checkbox"> Snap the aim to a pocket when it is close</label><label><input id="haptics" type="checkbox"> Haptic feedback</label><button type="button" id="open-physics" class="ghost">How the physics works…</button>')
// the settings above were added after the buttons; the buttons belong last
$('#table-dialog form').append($('#table-dialog form>div'))

function toast(text){const e=$('#toast');e.textContent=text;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2200)}
const viewManager=createViewManager({$,tablePrefs,toast,
 getGame:()=>state.game,broadcastGame:data=>broadcastGame(data),
 isOnlineHost:()=>state.mode==='online'&&Boolean(state.room?.isHost)})
const {view,ensureRenderer,applyTablePrefs}=viewManager
async function boot(){
 paintTrophies()
 let name=localStorage.getItem('pool-masters:name')||''
 if(!name){name=`Player ${Math.floor(100+Math.random()*900)}`;localStorage.setItem('pool-masters:name',name)}
 await foyer.signIn(name); $('#edit-name').textContent=foyer.player.name; await ensureLeagueProfile(); bind(); await ensureRenderer(); await refresh();
 const params=new URLSearchParams(location.search),shared=params.get('replay'),code=params.get('room')
 if(shared)await openReplay(shared);else if(code)await joinRoom(code)
}
async function ensureLeagueProfile(){
 await sb.rpc('pm_upsert_profile',{p_username:foyer.player.name})
 const {data}=await sb.from('pm_profiles').select('*').eq('id',foyer.player.id).single();state.profile=data;renderIdentity();checkTrophies()
}
function renderIdentity(){const p=state.profile;$('#edit-name').textContent=p?.username||foyer.player.name;$('#mini-rating').textContent=p?`${p.rating} Elo · ${p.wins}W ${p.losses}L`:''}
async function showStats(){const p=state.profile;if(!p)return;const perf=performance(),games=p.wins+p.losses,rate=games?Math.round(p.wins/games*100):0,summary=`<div class="stat-grid"><b>${p.rating}<small>Elo</small></b><b>${p.wins}–${p.losses}<small>Wins · losses</small></b><b>${rate}%<small>Win rate</small></b><b>${p.current_streak||0}<small>Current streak</small></b><b>${p.best_streak||0}<small>Best streak</small></b><b>${perf.breakRuns||0}<small>Break & runs</small></b></div>`,tables=[7,8,9].map(size=>{const r=tableRecord(perf,size);return `<li>${size} ft <small>${r.wins}W · ${r.losses}L · ${r.rate}%</small></li>`}).join('');$('#stats-body').innerHTML=summary+`<h3>By table size</h3><ul class="recent-results">${tables}</ul><p class="empty">Loading recent ranked racks…</p>`;$('#stats-dialog').showModal();const {data,error}=await sb.from('pm_matches').select('winner_id,created_at').or(`winner_id.eq.${foyer.player.id},loser_id.eq.${foyer.player.id}`).order('created_at',{ascending:false}).limit(8);if(error)return;const recent=(data||[]).map(m=>`<li class="${m.winner_id===foyer.player.id?'won':'lost'}">${m.winner_id===foyer.player.id?'Won':'Lost'} <small>${new Date(m.created_at).toLocaleDateString()}</small></li>`).join('');$('#stats-body').innerHTML=summary+`<h3>By table size</h3><ul class="recent-results">${tables}</ul><h3>Recent ranked racks</h3>${recent?`<ul class="recent-results">${recent}</ul>`:'<p class="empty">No ranked racks recorded yet.</p>'}`}
function performance(){try{return JSON.parse(localStorage.getItem('pool-masters:performance'))||emptyPerformance()}catch{return emptyPerformance()}}
const playing=()=>Boolean(state.game)&&(state.mode==='practice'||(state.mode==='online'&&(state.role==='host'||state.role==='player')))
function recordRackPerformance(result){const game=state.game;if(!playing())return;const won=result.winner===game.me,breakRun=won&&result.winner==='a'&&game.shots?.b===0;localStorage.setItem('pool-masters:performance',JSON.stringify(recordPerformance(performance(),{won,breakRun,tableSize:tablePrefs.size})))}
async function refresh(){
 const [rooms,leaders]=await Promise.all([foyer.listRooms(),sb.from('pm_profiles').select('id,username,rating,wins,losses,current_streak').gt('wins','0').order('rating',{ascending:false}).limit(10)])
 state.rankings=leaders.data||[];renderRooms(rooms.filter(r=>r.metadata?.game==='pool'));renderLeaders()
}
function renderRooms(rooms){$('#rooms').innerHTML=rooms.length?rooms.map(r=>`<div class="room"><button data-code="${r.code}"><span><b>${esc(r.name||r.hostName+"'s table")}</b><small>${esc(r.hostName)} · ${MODES[modeOf(r.metadata?.mode)].label} · ${occupancyLabel(r)}</small></span><strong>${r.code}</strong></button><button class="watch" data-watch="${r.code}">Watch</button></div>`).join(''):'<div class="empty">No open tables yet.<br>Create one or practice while you wait.</div>'}
function renderLeaders(){const rows=state.rankings;$('#leaders').innerHTML=rows.length?rows.map((p,i)=>`<div class="leader"><i>${i+1}</i><span>${esc(p.username)}</span><b>${p.rating} Elo</b><small>${p.wins}W · ${p.losses}L<br>${p.wins+p.losses?Math.round(p.wins/(p.wins+p.losses)*100):0}% wins</small></div>`).join(''):'<div class="empty">The first match sets the board.</div>'}
function bind(){
 const paintTheme=()=>{$('#theme-toggle').textContent=document.documentElement.dataset.theme==='dark'?'☼':'☾'}
 paintTheme()
 $('#theme-toggle').onclick=()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('pool-masters:theme',next);paintTheme()}
 $('#home').onclick=()=>leaveRoom();$('#leave').onclick=()=>leaveRoom();$('#refresh').onclick=refresh
 $('#create').onclick=createRoom;$('#quick').onclick=quickPlay;$('#practice').onclick=()=>startPractice($('#ai-level').value);$('#hotseat').onclick=()=>startHotSeat();$('#rogue').onclick=()=>startRogue();$('#house').onclick=openHouse;$('#challenges').onclick=openChallenges;$('#career').onclick=openCareer;$('#game-mode').value=modeOf(localStorage.getItem('pool-masters:game-mode'));$('#game-mode').onchange=e=>localStorage.setItem('pool-masters:game-mode',e.target.value);$('#ai-level').value=localStorage.getItem('pool-masters:ai-level')||'league';$('#ai-level').onchange=e=>localStorage.setItem('pool-masters:ai-level',e.target.value);$('#join').onclick=()=>joinRoom($('#code').value)
 $('#code').oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'');$('#rooms').onclick=e=>{const b=e.target.closest('[data-code]'),watch=e.target.closest('[data-watch]');if(watch)joinRoom(watch.dataset.watch,'spectator');else if(b)joinRoom(b.dataset.code)}
 $('#spectator-requests').onclick=async e=>{const admit=e.target.closest('[data-admit]'),remove=e.target.closest('[data-remove]');if(!state.room?.isHost)return;if(admit){await state.room.update({metadata:admitSpectator(state.room.metadata,admit.dataset.admit)});toast('Spectator admitted')}if(remove){await state.room.update({metadata:removeSpectator(state.room.metadata,remove.dataset.remove)});await state.room.kick(remove.dataset.remove);toast('Spectator removed')}}
 $('#edit-name').onclick=()=>{$('#name').value=foyer.player.name;$('#name-dialog').showModal()}
 $('#player-stats').onclick=showStats
 $('#save-name').onclick=async e=>{e.preventDefault();const n=$('#name').value.trim().slice(0,24);if(!n)return;await foyer.signIn(n);localStorage.setItem('pool-masters:name',n);await ensureLeagueProfile();$('#name-dialog').close();toast('Name saved')}
 $('#rename-room').onclick=()=>{if(!state.room?.isHost)return;$('#room-name').value=state.room.name||'';$('#room-dialog').showModal()}
 $('#save-room-name').onclick=async e=>{e.preventDefault();const name=$('#room-name').value.trim().slice(0,48);if(!name||!state.room?.isHost)return;try{await state.room.update({name});$('#room-label').textContent=name;$('#room-dialog').close();toast('Table name saved')}catch(err){toast(err.message||'Could not rename table')}}
 $('#next-rack').onclick=()=>{state.game?.requestRack();$('#next-rack').hidden=true}
 $('#result-next').onclick=()=>{state.game?.requestRack();$('#next-rack').hidden=true;$('#result-dialog').close()}
 $('#share-result').onclick=shareResult
 const watch=speed=>{const g=state.game;if(g?.lastReplay&&!g.startReplay(g.lastReplay,speed))toast('Wait for the shot to finish')}
 $('#replay-menu').onclick=e=>{e.stopPropagation();const bar=$('#replay-bar'),open=!bar.classList.contains('open');bar.classList.toggle('open',open);if(open){const r=e.currentTarget.getBoundingClientRect();bar.style.top=`${Math.round(r.bottom+6)}px`;bar.style.right=`${Math.max(8,Math.round(innerWidth-r.right))}px`}}
 document.addEventListener('click',e=>{const bar=$('#replay-bar');if(bar.classList.contains('open')&&e.target!==$('#replay-menu'))bar.classList.remove('open')})
 document.body.insertAdjacentHTML('beforeend','<dialog id="coach-dialog"><form method="dialog"><h2>Coach</h2><section id="coach-body"></section><div><button type="button" id="coach-yours" class="ghost">Watch your shot</button><button type="button" id="coach-best" class="ghost">Watch the coach’s shot</button><button class="primary">Done</button></div></form></dialog><dialog id="career-dialog"><form method="dialog"><h2>Career</h2><p id="career-summary"></p><section id="career-list"></section><div><button value="default" class="primary">Done</button></div></form></dialog><dialog id="challenges-dialog"><form method="dialog"><h2>Challenges</h2><p>Short scored games for one. Beat your best.</p><section id="challenge-list"></section><div><button value="default" class="primary">Done</button></div></form></dialog><dialog id="house-dialog"><form method="dialog"><h2>House rules</h2><p id="house-summary"></p><label>Race to <select id="house-race"></select></label><label>After a foul <select id="house-bih"></select></label><label>Who breaks <select id="house-breaker"></select></label><label>Straight pool is played to <select id="house-straight"></select></label><label><input id="house-jumps" type="checkbox"> Allow jump shots (the cue ball can hop over balls in its way)</label><p class="hint">These apply to practice, two-player games and tables you host. Ranked games always use the standard rules, and career opponents keep theirs.</p><div><button value="cancel" class="ghost">Cancel</button><button id="save-house" value="default" class="primary">Apply</button></div></form></dialog><dialog id="rogue-dialog"><form method="dialog"><h2>Choose an upgrade</h2><p id="rogue-summary"></p><section id="rogue-offer"></section></form></dialog><dialog id="physics-dialog"><form method="dialog"><h2>The physics</h2><p>Every number the simulation runs on, read live from the code. Read-only: the same values drive every game, so all players see the same shot.</p><section id="physics-body"></section><div><button class="primary">Done</button></div></form></dialog>')
 $('#coach-open').onclick=openCoach
 $('#coach-yours').onclick=()=>watchCoach('yours')
 $('#coach-best').onclick=()=>watchCoach('best')
 $('#replay-shot').onclick=()=>watch(1)
 $('#replay-slow').onclick=()=>watch(.25)
 $('#share-replay').onclick=shareReplay
 $('#drills').onclick=openDrills
 $('#daily').onclick=()=>startDrill(`daily-${dayNumber()}`)
 $('#drill-share').onclick=shareDaily
 paintDaily()
 $('#trophies').onclick=openTrophies
 $('#career-list').onclick=e=>{const b=e.target.closest('[data-opponent]');if(b&&!b.disabled)startCareer(b.dataset.opponent)}
 $('#challenge-list').onclick=e=>{const b=e.target.closest('[data-challenge]');if(b)startChallenge(b.dataset.challenge)}
 $('#eye-height').oninput=e=>{$('#eye-height-out').textContent=eyeLabel(Number(e.target.value))}
 $('#save-house').onclick=e=>{e.preventDefault();saveHouse();$('#house-dialog').close()}
 $('#rogue-offer').onclick=e=>{const b=e.target.closest('[data-upgrade]');if(b&&state.game?.pickUpgrade(b.dataset.upgrade))$('#rogue-dialog').close()}
 $('#rogue-dialog').addEventListener('cancel',e=>e.preventDefault())
 $('#open-physics').onclick=()=>{$('#table-dialog').close();openPhysics()}
 $('#drill-hint').onclick=()=>{if(!state.game?.applyHint())toast('Wait for the balls to stop')}
 $('#drill-retry').onclick=()=>state.game?.retryDrill()
 $('#drill-next').onclick=()=>{const n=nextDrill(state.drillId);if(n)startDrill(n.id);else{toast('That was the last drill');leaveRoom().then(openDrills)}}
 $('#drill-list').onclick=e=>{const b=e.target.closest('[data-drill]');if(b)startDrill(b.dataset.drill)}
 $('#replay-home').onclick=()=>leaveRoom()
 $('#focus-table').onclick=()=>{const focused=$('#game').classList.toggle('focus');$('#focus-table').textContent=focused?'Show chat':'Focus table';view.renderer?.resize()}
 // Felt, cue and rails choices come from the catalogue: what a trophy has not yet unlocked is shown, locked, with the trophy that unlocks it.
 const paintCosmetics=()=>{
  const earned=loadUnlocked()
  const fill=(sel,kind,keyOf)=>{$(sel).innerHTML=ofKind(kind).map(c=>`<option value="${c.key}"${isUnlocked(c,earned)?'':' disabled'}>${esc(cosmeticLabel(c,earned))}</option>`).join('')}
  fill('#felt','felt');fill('#cue-finish','cue');fill('#rails','rails')
 }
 $('#table-settings').onclick=()=>{paintCosmetics();$('#rails').value=usable('rails',tablePrefs.rails,loadUnlocked());$('#table-size').value=tablePrefs.size;$('#felt').value=Object.entries(FELTS).find(([,v])=>v===tablePrefs.felt)?.[0]||'green';$('#cue-finish').value=tablePrefs.cue;$('#lighting').value=tablePrefs.lighting;$('#aim-sensitivity').value=Math.round(tablePrefs.aimSensitivity*100);$('#aim-sensitivity-out').textContent=`${$('#aim-sensitivity').value}%`;$('#haptics').checked=sfx.haptics;$('#shot-cam').checked=tablePrefs.shotCam!==false;$('#snap-aim').checked=tablePrefs.snap!==false;$('#eye-height').value=tablePrefs.eyeHeight;$('#eye-height-out').textContent=eyeLabel(tablePrefs.eyeHeight);$('#table-dialog').showModal()}
 $('#aim-sensitivity').oninput=e=>$('#aim-sensitivity-out').textContent=`${e.target.value}%`
 $('#save-table').onclick=async e=>{e.preventDefault();tablePrefs.cue=usable('cue',$('#cue-finish').value,loadUnlocked());tablePrefs.rails=usable('rails',$('#rails').value,loadUnlocked());tablePrefs.lighting=$('#lighting').value;tablePrefs.aimSensitivity=Number($('#aim-sensitivity').value)/100;tablePrefs.shotCam=$('#shot-cam').checked;tablePrefs.snap=$('#snap-aim').checked;tablePrefs.eyeHeight=Number($('#eye-height').value);const resized=Number($('#table-size').value)!==tablePrefs.size;state.game&&(state.game.aimSensitivity=tablePrefs.aimSensitivity);sfx.setHaptics($('#haptics').checked);localStorage.setItem('pool-masters:haptics',sfx.haptics?'1':'0');await applyTablePrefs(Number($('#table-size').value),FELTS[$('#felt').value],{fresh:resized});$('#table-dialog').close()}
 const paintSfx=()=>{$('#mute-sfx').textContent=sfx.enabled?'♪':'✕';$('#mute-sfx').classList.toggle('on',sfx.enabled)}
 $('#mute-sfx').onclick=()=>{sfx.setEnabled(!sfx.enabled);localStorage.setItem('pool-masters:muted',sfx.enabled?'0':'1');paintSfx()}
 paintSfx()
 const paintMusic=()=>{$('#music-toggle').textContent=music.enabled?'♫':'♩';$('#music-toggle').classList.toggle('on',music.enabled);$('#music-toggle').title=`Background music: ${music.title}`;$('#music-volume').hidden=!music.enabled;$('#music-volume').value=Math.round(music.volume*100)}
 state.paintMusic=paintMusic
 music.onTrack(track=>{const credit=$('#music-credit');credit.hidden=false;credit.href=track.url;credit.textContent=`♫ ${track.title} — ${track.creator}`;credit.title=`${track.license} · Open the track source`})
 $('#music-toggle').onclick=()=>{music.setEnabled(!music.enabled);localStorage.setItem('pool-masters:music',music.enabled?'1':'0');paintMusic()}
 $('#music-volume').oninput=e=>{music.setVolume(Number(e.target.value)/100);localStorage.setItem('pool-masters:music-volume',music.volume)}
 $('#music-shuffle').onclick=()=>{const title=music.shuffle();toast(`Now playing: ${title}`);paintMusic()}
 paintMusic()
 $('#view-3d').onclick=()=>viewManager.cycle()
 $('#copy').onclick=copyInvite;$('#call').onclick=startCall;$('#mute').onclick=()=>{if(!state.media)return startCall();state.media.toggleMuted();paintCall()};$('#camera').onclick=()=>{if(!state.media)return startCall();state.media.toggleCamera();paintCall()};paintCall()
 $('#chat-form').onsubmit=async e=>{e.preventDefault();const input=$('#message'),body=input.value.trim();if(!body||!state.room)return;input.value='';await state.room.say(body)}
 window.addEventListener('popstate',()=>{if(!new URLSearchParams(location.search).get('room'))leaveRoom(false)})
}
const resumeExpiry=()=>new Date(Date.now()+4*60*60*1000).toISOString()
async function persistMatch(snapshot,force=false){
 // Network snapshots intentionally omit velocity. Saving during a rolling shot
 // would restore balls with no motion, so persist stable between-shot states.
 if(state.mode!=='online'||!state.room?.isHost||!snapshot||snapshot.phase!=='aim')return
 state.pendingSave=snapshot
 const write=async()=>{state.saveTimer=null;const saved=state.pendingSave;state.pendingSave=null;state.lastSave=Date.now()
  try{await state.room.update({metadata:{...state.room.metadata,game:'pool',saved_state:saved,resume_until:resumeExpiry()}})}catch(error){console.warn('match save failed',error)}
 }
 if(force){clearTimeout(state.saveTimer);return write()}
 if(state.saveTimer||Date.now()-state.lastSave<1000){if(!state.saveTimer)state.saveTimer=setTimeout(write,1000-(Date.now()-state.lastSave));return}
 return write()
}
const chosenMode=()=>modeOf($('#game-mode')?.value)
async function createRoom(){try{const mode=chosenMode();const house=houseRules(),room=await foyer.createRoom({name:`${foyer.player.name}'s table`,metadata:{game:'pool',mode,house,ranked:mode==='8ball'&&houseIsDefault(house),resume_until:resumeExpiry(),match_score:emptyScore(),match_target:house.race,...spectatorMeta(foyer.player.id)},maxPlayers:10,status:'waiting'});await enterRoom(room,'player');$('#room-name').value=room.name;$('#room-dialog').showModal()}catch(e){toast(e.message)}}
async function quickPlay(){
 const mode=chosenMode()
 const rooms=(await foyer.listRooms()).filter(r=>r.metadata?.game==='pool'&&modeOf(r.metadata?.mode)===mode&&houseIsDefault(r.metadata?.house)&&!r.metadata?.seats?.b)
 if(rooms[0])return joinRoom(rooms[0].code);await createRoom()
}
async function joinRoom(code,intent='player'){code=String(code||'').trim().toUpperCase();if(!code)return toast('Enter a room code');try{const room=await foyer.join(code);if(intent==='player'&&room.metadata?.seats?.b){intent='spectator';toast('The table is full — requesting spectator access')}await enterRoom(room,intent)}catch(e){toast(e.message||'Could not join that room')}}
async function enterRoom(room,intent='player'){
 // Do the fallible work first. A bad/expired invite must not tear down a game
 // the player is already in.
 let roomHistory,net
 try{roomHistory=await room.history(80);net=await room.connect({topology:'star'})}
 catch(error){net?.close?.();await room.leave?.().catch(()=>{});throw error}
 const oldRoom=state.room
 state.game?.destroy();state.game=null;state.media?.stop();state.media=null;paintCall();state.net?.close?.();state.net=null;state.peers.clear();state.unsubs.splice(0).forEach(fn=>fn?.())
 state.room=room;state.net=net;state.mode='online';state.matchScore={a:0,b:0};state.role=room.metadata?.seats?roleFor(room.metadata,foyer.player.id):(room.isHost?'host':'player');showGame();state.raceTo=normalizeHouse(room.metadata?.house).race;$('.call-actions').hidden=false;$('#rename-room').hidden=!room.isHost;history.replaceState({},'',`?room=${room.code}`);$('#room-label').textContent=room.name||`Room ${room.code}`
 state.unsubs.push(room.on('players',players=>onPlayers(players)),room.on('metadata',meta=>onMetadata(meta)),room.on('message',appendMessage),room.on('closed',()=>{toast('The table closed');leaveRoom()}))
 roomHistory.forEach(appendMessage);net.on('data',({from,data})=>{const message=parseGameMessage(data);if(message&&acceptsGameMessage({isHost:room.isHost,from,seatB:room.metadata?.seats?.b}))state.game?.receive(message)});net.on('peer',peer=>{state.peers.set(peer.id,peer);state.game?.sync()});net.on('leave',id=>state.peers.delete(id))
 await room.setPlayerState({poolRole:intent})
 state.game=new PoolGame({mode:modeOf(room.metadata?.mode),house:room.metadata?.house,renderer:await ensureRenderer(),surface:$('.canvas-wrap'),status:$('#game-status'),groupStatus:$('#groups'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),jumpBtn:$('#jump'),spinPad:$('#spin'),moveCue:$('#move-cue'),changePocket:$('#change-pocket'),sfx,onReplay:paintReplayBar,onShot:trackShot,aimSensitivity:tablePrefs.aimSensitivity,prefs:tablePrefs,host:room.isHost,spectator:state.role!=='host'&&state.role!=='player',practice:false,send:broadcastGame,onSave:persistMatch,onTable:m=>applyTablePrefs(m.size,m.felt,{fresh:false,remote:true}),onRack:()=>$('#next-rack').hidden=true,onFinish:result=>{music.duck();sfx.result(result.winner===state.game?.me);finishRanked(result);recordRackPerformance(result);trackRack(result);showRackResult(result);$('#next-rack').hidden=!canStartRack()}})
 if(room.isHost&&state.game.restore(room.metadata?.saved_state))toast('Saved rack restored')
 onPlayers(room.players);await room.update?.({status:room.players.length>=2?'playing':'waiting'}).catch(()=>{})
 if(oldRoom&&oldRoom.id!==room.id)await oldRoom.leave().catch(()=>{})
}
async function copyInvite(){
 if(!state.room?.code)return toast('Create or join a room first')
 const url=new URL(location.href);url.search='';url.searchParams.set('room',state.room.code)
 try{await navigator.clipboard.writeText(url.href);toast(`Invite for ${state.room.code} copied`)}catch{toast('Could not copy the invite')}
}
function broadcastGame(data){state.peers.forEach(p=>p.send(JSON.stringify(data)))}
function onPlayers(players){
 if(state.room?.isHost){const current=state.room.metadata?.seats?state.room.metadata:{...state.room.metadata,...spectatorMeta(foyer.player.id)};const next=reconcileSpectators(current,players);if(JSON.stringify(next)!==JSON.stringify(state.room.metadata))state.room.update({metadata:next}).catch(console.warn)}
 const seats=state.room?.metadata?.seats||{},mine=players.find(p=>p.id===foyer.player.id),host=players.find(p=>p.id===seats.a),guest=players.find(p=>p.id===seats.b),other=players.find(p=>p.id===(state.room?.isHost?seats.b:seats.a));state.opponent=(state.role==='host'||state.role==='player')?other||null:null
 if(state.role==='spectator'||state.role==='pending')$('#versus').innerHTML=`<span><b>${esc(host?.name||'Host')}</b><small>Host</small></span><i>vs</i><span><b>${esc(guest?.name||'Waiting…')}</b><small>${state.role==='spectator'?'You are watching':'Spectator request pending'}</small></span>`
 else $('#versus').innerHTML=`<span><b>${esc(mine?.name||foyer.player.name)}</b><small>You</small></span><i>vs</i><span><b>${esc(other?.name||'Waiting…')}</b><small>${other?'Opponent':'Share the code'}</small></span>`
 // In Foyer, changing isOpen from true to false emits the terminal `closed`
 // event. A full table is still a live room, so mark its phase only.
 state.game?.setReady(state.role==='host'||state.role==='player'?Boolean(other):false);if(other&&state.room?.isHost)state.room.update({status:'playing'}).catch(()=>{})
}
function onMetadata(meta){if(meta?.match_score){state.matchScore=meta.match_score;renderMatchScore()}state.role=meta?.seats?roleFor(meta,foyer.player.id):(state.room?.isHost?'host':'player');state.game?.setSpectator(state.role!=='host'&&state.role!=='player');if(state.role==='spectator'&&view.mode==='top')viewManager.forceView('3d');onPlayers(state.room?.players||[]);const requests=(meta.spectatorRequests||[]).map(id=>state.room?.players.find(p=>p.id===id)).filter(Boolean),watchers=(meta.spectators||[]).map(id=>state.room?.players.find(p=>p.id===id)).filter(Boolean);$('#spectator-requests').innerHTML=state.room?.isHost?(requests.map(p=>`<button class="ghost admit" data-admit="${p.id}">Admit ${esc(p.name)}</button>`).join('')+watchers.map(p=>`<button class="ghost remove" data-remove="${p.id}">Remove ${esc(p.name)}</button>`).join('')):state.role==='pending'?'<small>Waiting for the host to admit you as a spectator.</small>':state.role==='spectator'?'<small>Watching live · angled camera</small>':''}
function appendMessage(m){const log=$('#messages');if(document.getElementById(`msg-${m.id}`))return;const row=document.createElement('div');row.id=`msg-${m.id}`;row.className=m.system?'system':'message';row.innerHTML=m.system?esc(m.body):`<b>${esc(m.playerName)}</b><span>${esc(m.body)}</span>`;log.append(row);log.scrollTop=log.scrollHeight}
function renderMatchScore(){const game=state.game;if(!game)return;if(state.mode==='hotseat'){$('#match-score').textContent=`Race to ${state.raceTo||MATCH_TARGET} · ${game.nameOf('a')} ${state.matchScore.a}–${state.matchScore.b} ${game.nameOf('b')}`;return}const theirs=game.me==='a'?'b':'a';$('#match-score').textContent=`Race to ${state.raceTo||MATCH_TARGET} · ${state.matchScore[game.me]}–${state.matchScore[theirs]}`}
function showRackResult(result){const game=state.game;if(!game||game.finishedResult===result.round)return;game.finishedResult=result.round;state.matchScore=scoreRack(state.matchScore,result.winner);if(state.mode==='hotseat')return showHotSeatResult(game,result);const winner=matchWinner(state.matchScore,state.raceTo||MATCH_TARGET),won=result.winner===game.me,opponent=state.opponent?.name||'AI Coach';renderMatchScore();if(winner&&winner===game.me)track({type:'match',won:true});$('#result-title').textContent=winner?(winner===game.me?'Match won!':'Match lost'):(won?'Rack won':'Rack lost');$('#result-summary').textContent=`Race to ${state.raceTo||MATCH_TARGET} · ${scoreLine(state.matchScore,game.me,foyer.player.name,opponent)}`;$('#result-next').hidden=Boolean(winner)||!canStartRack();$('#result-next').textContent=state.mode==='practice'?'Next rack':'Play next rack';$('#result-dialog').showModal();if(state.career&&winner)careerMatchDone(winner===game.me);if(state.room?.isHost)state.room.update({metadata:{...state.room.metadata,match_score:state.matchScore}}).catch(console.warn)}
async function shareResult(){const title=$('#result-title').textContent,text=`${title} · ${$('#result-summary').textContent} · Pool Masters`;try{if(navigator.share)await navigator.share({title:'Pool Masters',text});else await navigator.clipboard.writeText(text);toast('Result shared')}catch{}}
async function finishRanked(result){
 if(state.room?.metadata?.ranked===false)return
 if(state.mode!=='online'||!state.room||state.role==='spectator'||state.role==='pending'||!state.opponent)return
 const winner=winnerForResult(result,state.room.isHost,foyer.player.id,state.opponent.id)
 if(!winner)return
 const gameId=`${state.room.id}:${result.round}`;const {error}=await sb.rpc('pm_report_result',{p_game_id:gameId,p_room_id:state.room.id,p_winner:winner,p_loser:winner===foyer.player.id?state.opponent.id:foyer.player.id})
 if(error)console.warn(error);setTimeout(async()=>{await ensureLeagueProfile();await refresh()},900)
}
function aiRecord(){try{return JSON.parse(localStorage.getItem('pool-masters:ai-record'))||{wins:0,losses:0}}catch{return{wins:0,losses:0}}}
function renderAiRecord(){const r=aiRecord(),games=r.wins+r.losses;$('#practice-record').hidden=false;$('#practice-record').textContent=`Against AI · ${r.wins}W–${r.losses}L${games?` · ${Math.round(r.wins/games*100)}% wins`:''}`}
function recordAiResult(won){const r=aiRecord();r[won?'wins':'losses']=(r[won?'wins':'losses']||0)+1;localStorage.setItem('pool-masters:ai-record',JSON.stringify(r));renderAiRecord()}
async function startPractice(level='league',mode=chosenMode(),career=null){state.aiLevel=level;state.game?.destroy();state.mode='practice';state.room=null;state.opponent={name:career?career.name:`${AI_LEVELS[level].label} AI`};showGame();state.career=career;const house=career?normalizeHouse(null):houseRules();state.raceTo=career?career.race:house.race;state.matchScore={a:0,b:0};$('#game').classList.add('focus');history.replaceState({},'',location.pathname);$('#room-label').textContent=career?`Career · ${career.venue} · ${MODES[mode].label}`:`Unranked practice · ${MODES[mode].label}${houseTag(house)}`;$('#versus').innerHTML=`<span><b>${esc(foyer.player.name)}</b><small>You</small></span><i>vs</i><span><b>${esc(state.opponent.name)}</b><small>${career?`Race to ${career.race}`:'Practice'}</small></span>`;renderMatchScore();renderAiRecord();state.game=new PoolGame({mode,house,renderer:await ensureRenderer(),surface:$('.canvas-wrap'),status:$('#game-status'),groupStatus:$('#groups'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),jumpBtn:$('#jump'),spinPad:$('#spin'),moveCue:$('#move-cue'),changePocket:$('#change-pocket'),sfx,onReplay:paintReplayBar,onShot:trackShot,aimSensitivity:tablePrefs.aimSensitivity,prefs:tablePrefs,host:true,practice:true,aiLevel:level,send:()=>{},onFinish:result=>{music.duck();sfx.result(result.winner==='a');recordAiResult(result.winner==='a');recordRackPerformance(result);trackRack(result);showRackResult(result);$('#next-rack').hidden=false}});renderMatchScore();$('.call-actions').hidden=true;$('#room-sidebar').hidden=true}
// ---- trophies ----
function loadStats(){try{return {...emptyStats(),...JSON.parse(localStorage.getItem('pool-masters:stats'))}}catch{return emptyStats()}}
function loadUnlocked(){try{return JSON.parse(localStorage.getItem('pool-masters:trophies'))||{}}catch{return {}}}
function track(e){
 localStorage.setItem('pool-masters:stats',JSON.stringify(applyEvent(loadStats(),e)))
 checkTrophies()
}
// A finished shot, as either side sees it. Only games you are playing count.
function trackShot(e){
 const g=state.game;if(!playing())return
 track({type:'shot',mine:e.by===g.me,potted:e.potted,foul:e.foul,brk:e.brk,mode:e.mode,won:e.winner===g.me,over:Boolean(e.winner)})
}
function trackRack(result){
 const g=state.game;if(!playing())return
 const won=result.winner===g.me
 track({type:'rack',won,mode:g.mode,size:tablePrefs.size,ai:state.mode==='practice'?state.aiLevel:null,
  human:state.mode==='online',breakRun:won&&result.winner==='a'&&g.shots?.b===0})
}
function checkTrophies(){
 const unlocked=loadUnlocked()
 const fresh=newlyEarned({stats:loadStats(),drills:drillProgress(),career:careerProgress(),challenges:challengeResults(),rogue:rogueRecord(),profile:state.profile},unlocked)
 if(!fresh.length)return
 localStorage.setItem('pool-masters:trophies',JSON.stringify(unlock(unlocked,fresh)))
 // a toast holds one message, so stagger a couple and summarise a crowd
 if(fresh.length<=2)fresh.forEach((t,i)=>setTimeout(()=>toast(`${t.icon} ${t.name} · ${rewardsOf(t.id).length?`unlocked ${rewardsOf(t.id).map(r=>r.name).join(', ')}`:t.desc}`),1800+i*2600))
 else setTimeout(()=>toast(`🏆 ${fresh.length} trophies earned`),1800)
 paintTrophies()
}
function paintTrophies(){const n=Object.keys(loadUnlocked()).length;$('#trophies').textContent=n?`🏆 ${n}`:'🏆';$('#trophies').title=`Trophies: ${n} of ${TROPHIES.length}`}
function openTrophies(){
 const unlocked=loadUnlocked(),c={stats:loadStats(),drills:drillProgress(),career:careerProgress(),challenges:challengeResults(),rogue:rogueRecord(),profile:state.profile}
 $('#trophies-summary').textContent=`${TROPHIES.filter(t=>unlocked[t.id]).length} of ${TROPHIES.length} earned. Kept on this device.`
 $('#trophy-list').innerHTML=GROUPS.map(g=>`<h3>${g}</h3>`+TROPHIES.filter(t=>t.group===g).map(t=>{
  const u=unlocked[t.id],p=progressOf(t,c),gives=rewardsOf(t.id).map(r=>r.name).join(', ')
  return `<div class="trophy${u?' earned':''}"><span class="icon">${t.icon}</span><span class="what"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small>${gives?`<small class="reward">🎁 ${u?'Unlocked':'Unlocks'}: ${esc(gives)}</small>`:''}${u?'':`<i class="bar"><b style="width:${Math.round(p.value/p.target*100)}%"></b></i>`}</span><span class="when">${u?new Date(u.at).toLocaleDateString():`${p.value} / ${p.target}`}</span></div>`
 }).join('')).join('')
 $('#trophies-dialog').showModal()
}

// ---- drills ----
function drillProgress(){try{return JSON.parse(localStorage.getItem('pool-masters:drills'))||emptyProgress()}catch{return emptyProgress()}}
function openDrills(){
 const p=drillProgress()
 $('#drills-summary').textContent=`One shot at a time, on a fixed table. ${doneCount(p)} of ${DRILLS.length} done.`
 $('#drill-list').innerHTML=DRILLS.map(d=>{
  const r=p[d.id]
  return `<button type="button" class="drill" data-drill="${d.id}"><span class="dots" title="Level ${d.level}">${'●'.repeat(d.level)}${'○'.repeat(3-d.level)}</span><span class="what"><b>${esc(d.name)}</b><small>${esc(d.goal)}</small></span><span class="done">${r?.done?(r.best==null?'✓ with a hint':`✓ ${r.best===1?'first go':r.best+' tries'}`):''}</span></button>`
 }).join('')
 $('#drills-dialog').showModal()
}
async function startDrill(id){
 const d=isDaily(id)?dailyDrill(dailyNumberOf(id)):DRILLS.find(x=>x.id===id);if(!d)return
 if($('#drills-dialog').open)$('#drills-dialog').close()
 state.game?.destroy();state.game=null
 // the shots are proven on one table: play them there, and put the player's own back afterwards
 if(tablePrefs.size!==DRILL_TABLE){await viewManager.previewTable(DRILL_TABLE);state.previewedTable=true;toast(`Drills use the ${DRILL_TABLE} ft table`)}
 state.mode='drill';state.room=null;state.opponent=null;state.drillId=id
 showGame()
 $('#game').classList.add('focus','solo');$('.call-actions').hidden=true;$('#room-sidebar').hidden=true
 history.replaceState({},'',location.pathname)
 $('#room-label').textContent=`Drill · ${d.name}`;$('#match-score').textContent=''
 $('#versus').innerHTML=`<span style="grid-column:1/-1;text-align:center"><b>${esc(d.name)} <small>${'●'.repeat(d.level)}${'○'.repeat(3-d.level)}</small></b><small>${esc(d.goal)}</small></span>`
 $('#drill-tip').textContent=d.tip
 state.game=new PoolGame({drill:d,drillLabel:d.daily?`DAILY #${d.daily}`:`${DRILLS.indexOf(d)+1} OF ${DRILLS.length}`,mode:'8ball',renderer:await ensureRenderer(),surface:$('.canvas-wrap'),status:$('#game-status'),groupStatus:$('#groups'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),jumpBtn:$('#jump'),spinPad:$('#spin'),moveCue:$('#move-cue'),changePocket:$('#change-pocket'),sfx,onReplay:paintReplayBar,onDrill:onDrillResult,aimSensitivity:tablePrefs.aimSensitivity,prefs:tablePrefs,host:true,practice:false,spectator:false,send:()=>{}})
 state.game.setReady(true)
 $('#drill-bar').hidden=false;$('#drill-next').hidden=true;$('#drill-share').hidden=true
}
function onDrillResult(e){
 if(!e){$('#drill-next').hidden=true;$('#drill-share').hidden=true;return}
 localStorage.setItem('pool-masters:drills',JSON.stringify(recordDrill(drillProgress(),e.drill.id,{ok:e.ok,attempts:e.attempts,hinted:e.hinted})))
 if(e.ok){toast('Drill complete!');sfx.result(true);$('#drill-next').hidden=!nextDrill(e.drill.id);$('#drill-share').hidden=!isDaily(e.drill.id);paintDaily();setTimeout(checkTrophies,1800)}
}

// The bar shows once a shot has been recorded, and goes again when the next begins.
function paintReplayBar(r){$('#coach-open').hidden=!state.game?.lastCoach||state.mode==='replay';$('#replay-bar').hidden=!r;$('#replay-menu').hidden=!r||!$('#replay-bar').classList.contains('pop');if(!r)$('#replay-bar').classList.remove('open')}
async function shareReplay(){
 const rec=state.game?.lastReplay
 if(!rec)return toast('Take a shot first')
 try{
  const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('replay',await pack(rec))
  // the share sheet is right on a phone; on a desktop a copied link is what people expect
  if(navigator.share&&matchMedia('(pointer:coarse)').matches)await navigator.share({title:'A Pool Masters shot',text:'Watch this shot',url:url.href})
  else{await navigator.clipboard.writeText(url.href);toast('Replay link copied')}
  track({type:'share'})
 }catch(e){if(e?.name!=='AbortError')toast('Could not share the replay')}
}
// A shared link opens a table that does nothing but play one recorded shot.
async function openReplay(link){
 let rec
 try{rec=await unpack(link)}catch{toast('That replay link is not valid');return false}
 state.game?.destroy();state.game=null
 state.mode='replay';state.room=null;state.opponent=null
 await viewManager.previewTable(rec.size);state.previewedTable=true
 showGame()
 $('#game').classList.add('focus','solo');$('.call-actions').hidden=true;$('#room-sidebar').hidden=true;$('.shot-controls').hidden=true
 $('#room-label').textContent=`Shared shot · ${MODES[rec.mode].label}`
 $('#match-score').textContent=''
 $('#versus').innerHTML='<span style="grid-column:1/-1;text-align:center"><b>Shared shot</b><small>Recorded in Pool Masters</small></span>'
 state.game=new PoolGame({mode:rec.mode,renderer:await ensureRenderer(),surface:$('.canvas-wrap'),status:$('#game-status'),groupStatus:$('#groups'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),jumpBtn:$('#jump'),spinPad:$('#spin'),moveCue:$('#move-cue'),changePocket:$('#change-pocket'),sfx,host:false,spectator:true,practice:false,replayOnly:true,send:()=>{}})
 state.game.lastReplay=rec
 // a shared shot is nothing but its replay, so its buttons stay in view rather than in the menu
 $('#replay-bar').classList.remove('pop','open');$('#replay-menu').hidden=true;$('#replay-bar').hidden=false;$('#replay-home').hidden=false
 state.game.startReplay(rec)
 return true
}
function showGame(){state.career=null;state.raceTo=null;$('#game').classList.remove('solo');$('#replay-bar').classList.add('pop');$('#replay-bar').classList.remove('open');$('#drill-bar').hidden=true;$('.shot-controls').hidden=false;$('#replay-home').hidden=true;if(localStorage.getItem('pool-masters:music')!=='0')music.setEnabled(true);state.paintMusic?.();$('#lobby').classList.remove('active');$('#game').classList.add('active');$('#game').classList.remove('focus');$('#focus-table').textContent='Focus table';$('#messages').innerHTML='';$('#room-sidebar').hidden=false;$('#practice-record').hidden=true;$('#next-rack').hidden=true}
async function startCall(){if(!state.room)return;try{if(!state.media){state.media=state.room.media();state.media.onStream((_,s)=>{$('#remote-video').srcObject=s;$('#video-panel').classList.add('live')});state.media.onLeave(()=>{$('#remote-video').srcObject=null});const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});$('#local-video').srcObject=stream;await state.media.start(stream);$('#call').textContent='End call';paintCall();return}state.media.stop();state.media=null;paintCall();$('#local-video').srcObject=null;$('#remote-video').srcObject=null;$('#call').textContent='Start call';paintCall()}catch{toast('Camera or microphone unavailable')}}
async function leaveRoom(push=true){music.setEnabled(false);state.paintMusic?.();if(state.game&&state.room?.isHost)await persistMatch(snapshotOf(state.game),true);clearTimeout(state.saveTimer);state.saveTimer=null;state.game?.destroy();state.game=null;state.media?.stop();state.media=null;paintCall();state.net?.close?.();state.net=null;state.peers.clear();state.unsubs.splice(0).forEach(fn=>fn?.());const oldRoom=state.room;state.room=null;state.mode='lobby';if(state.previewedTable){state.previewedTable=false;await viewManager.applyTablePrefs(tablePrefs.size,tablePrefs.felt,{fresh:false,remote:true})};$('#game').classList.remove('active');$('#lobby').classList.add('active');if(push)history.pushState({},'',location.pathname);if(oldRoom)await oldRoom.leave().catch(()=>{});await refresh()}
// Registered after boot so it never delays first paint, and only in a build:
// a worker in dev would just cache things you are actively editing.
if(import.meta.env.PROD&&'serviceWorker'in navigator)
 addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('service worker not registered',e)))

// For driving the running app from a browser test. Vite replaces this with
// false in a production build, so none of it ships.
if(import.meta.env.DEV)window.__pm={state,viewManager,openReplay,track,checkTrophies,openTrophies,table:()=>({size:tableSize,radius:BALL_R})}

boot().catch(e=>{console.error(e);toast('Could not connect. Reload to try again.')})

function openPhysics(){
 const row=(a,b,c)=>`<tr><th>${a}</th><td>${b}</td><td>${c}</td></tr>`
 const groups=PHYS_GROUPS.map(g=>{
  const rows=CONSTANTS.filter(c=>c.group===g).map(c=>`<tr><th>${esc(c.name)}</th><td class="num">${fmt(valueOf(c))}${c.unit?` <small>${esc(c.unit)}</small>`:''}</td><td>${esc(c.note)}</td></tr>`)
  const extra=g==='Simulation'?simulation().map(r=>row(esc(r.name),`<span class="num">${esc(r.value)}</span>`,esc(r.note))):[]
  return rows.length+extra.length?`<h3>${g}</h3><table>${rows.join('')}${extra.join('')}</table>`:''
 }).join('')
 const shots=`<h3>Power to speed</h3><table>${shotTable().map(r=>row(`${r.power}%`,`<span class="num">${Math.round(r.speed)}</span> <small>units/s</small>`,`about ${r.ms.toFixed(1)} m/s`)).join('')}</table>`
 const sizes=`<h3>Tables</h3><table>${tableInfo().map(r=>row(r.label,`<span class="num">${r.ball}</span> <small>ball radius</small>`,`pocket radius ${r.pocket} — bigger tables make the same ball smaller`)).join('')}</table>`
 $('#physics-body').innerHTML=groups+shots+sizes
 $('#physics-dialog').showModal()
}

// The lobby button says whether today's shot has been solved.
function paintDaily(){
 const r=drillProgress()[`daily-${dayNumber()}`]
 $('#daily').textContent=r?.done?`Daily shot ✓ #${dayNumber()}`:'Daily shot'
}
async function shareDaily(){
 const d=state.drillId&&isDaily(state.drillId)?dailyDrill(dailyNumberOf(state.drillId)):null
 if(!d)return
 const text=shareText(d.daily,d.level,drillProgress()[d.id])
 try{
  if(navigator.share&&matchMedia('(pointer:coarse)').matches)await navigator.share({text})
  else{await navigator.clipboard.writeText(text);toast('Result copied')}
 }catch(e){if(e?.name!=='AbortError')toast('Could not share the result')}
}

// ---- shot coach ----
// Grades the player's last shot against the best the AI can find from the same table.
// Worked out when asked, not after every shot: it plays a few dozen shots out on copies.
function openCoach(){
 const c=state.game?.lastCoach
 if(!c)return toast('Take a shot first')
 $('#coach-body').innerHTML='<p>Thinking it over…</p>'
 $('#coach-yours').hidden=$('#coach-best').hidden=true
 $('#coach-dialog').showModal()
 setTimeout(()=>{
  c.result??=analyse(c)
  const a=c.result
  $('#coach-body').innerHTML=`<p class="coach-${a.verdict}"><b>${esc(a.headline)}</b></p><p>${esc(a.detail)}</p>`
  $('#coach-yours').hidden=false;$('#coach-best').hidden=!a.best
 },30)
}
function watchCoach(which){
 const g=state.game,c=g?.lastCoach
 if(!c?.result)return
 const shot=which==='best'?c.result.best?.shot:c.shot
 if(!shot)return
 c.replays??={}
 c.replays[which]??=replayOf(c.before,shot,c.mode)
 $('#coach-dialog').close()
 // a replay cannot start over a live shot; if the opponent is mid-shot, start it the moment the table is still
 const start=tries=>{
  if(state.game!==g||!g.lastCoach)return
  if(g.phase==='roll'&&tries<100){if(!tries)toast('Playing it as soon as the table is still');return setTimeout(()=>start(tries+1),200)}
  if(!c.replays[which]||!g.startReplay(c.replays[which],1))toast('Could not play that shot')
 }
 start(0)
}

// ---- hot-seat: two players, one device ----
// No opponent, no network, no ranking and no stats: the rules and the simulation never needed any
// of those, so this is the practice game with a second person where the AI was.
async function startHotSeat(mode=chosenMode()){
 state.game?.destroy();state.mode='hotseat';state.room=null;state.opponent={name:'Player 2'};state.matchScore={a:0,b:0}
 const house=houseRules()
 showGame();state.raceTo=house.race;$('#game').classList.add('focus');history.replaceState({},'',location.pathname)
 $('#room-label').textContent=`Two players · ${MODES[mode].label}${houseTag(house)}`
 $('#versus').innerHTML='<span><b>Player 1</b><small>Break</small></span><i>vs</i><span><b>Player 2</b><small>Pass the device</small></span>'
 $('#practice-record').hidden=true
 state.game=new PoolGame({mode,house,renderer:await ensureRenderer(),surface:$('.canvas-wrap'),status:$('#game-status'),groupStatus:$('#groups'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),jumpBtn:$('#jump'),spinPad:$('#spin'),moveCue:$('#move-cue'),changePocket:$('#change-pocket'),sfx,onReplay:paintReplayBar,aimSensitivity:tablePrefs.aimSensitivity,prefs:tablePrefs,host:true,practice:true,hotSeat:true,names:{a:'Player 1',b:'Player 2'},send:()=>{},
  onTurn:name=>toast(`${name}’s turn`),
  onFinish:result=>{music.duck();sfx.result(true);showRackResult(result);$('#next-rack').hidden=false}})
 renderMatchScore()
 $('.call-actions').hidden=true;$('#room-sidebar').hidden=true
}
function showHotSeatResult(game,result){
 const winner=matchWinner(state.matchScore),name=game.nameOf(result.winner)
 renderMatchScore()
 $('#result-title').textContent=winner?`${name} wins the match!`:`${name} wins the rack`
 $('#result-summary').textContent=`Race to ${state.raceTo||MATCH_TARGET} · ${game.nameOf('a')} ${state.matchScore.a} — ${state.matchScore.b} ${game.nameOf('b')}`
 $('#result-next').hidden=Boolean(winner);$('#result-next').textContent='Next rack'
 $('#result-dialog').showModal()
}

// ---- career ----
function careerProgress(){try{return JSON.parse(localStorage.getItem('pool-masters:career'))||emptyCareer()}catch{return emptyCareer()}}
function openCareer(){
 const p=careerProgress(),next=nextOpponent(p)
 $('#career-summary').textContent=next?`${beatenCount(p)} of ${LADDER.length} beaten. Next: ${next.name} at ${next.venue}.`:'You have beaten everyone. Champion of the circuit.'
 $('#career-list').innerHTML=LADDER.map((o,i)=>{
  const beaten=isBeaten(p,o.id),open=isOpen(p,o.id)
  return `<button type="button" class="drill career-opp${beaten?' beaten':''}" data-opponent="${o.id}"${open?'':' disabled'}><span class="dots">${i+1}</span><span class="what"><b>${esc(o.name)}</b><small>${esc(o.venue)} · ${MODES[o.mode].label} · race to ${o.race} · ${esc(AI_LEVELS[o.level].label)}</small><small>${esc(o.bio)}</small></span><span class="done">${beaten?'✓ beaten':open?'Play':'🔒'}</span></button>`
 }).join('')
 $('#career-dialog').showModal()
}
function startCareer(id){
 const o=opponentById(id)
 if(!o||!isOpen(careerProgress(),id))return
 $('#career-dialog').close()
 return startPractice(o.level,o.mode,o)
}
// The match is over: remember a win, unlock the next, and say so.
function careerMatchDone(won){
 const o=state.career;if(!o)return
 const before=careerProgress(),after=won?recordWin(before,o.id):before
 if(won)localStorage.setItem('pool-masters:career',JSON.stringify(after))
 $('#result-summary').textContent=summaryOf(o,won,after)
 if(won)setTimeout(checkTrophies,1800)
}

// ---- challenge games ----
function challengeResults(){try{return JSON.parse(localStorage.getItem('pool-masters:challenges'))||emptyResults()}catch{return emptyResults()}}
function openChallenges(){
 const r=challengeResults()
 $('#challenge-list').innerHTML=CHALLENGES.map(c=>{const best=r[c.id]?.best;return `<button type="button" class="drill" data-challenge="${c.id}"><span class="dots">▶</span><span class="what"><b>${esc(c.name)}</b><small>${esc(c.blurb)}</small></span><span class="done">${best==null?'':'Best '+formatChallenge(c.id,best)+(c.unit&&c.id!=='clear'?' '+c.unit:'')}</span></button>`}).join('')
 $('#challenges-dialog').showModal()
}
async function startChallenge(id){
 const def=challengeById(id);if(!def)return
 if($('#challenges-dialog').open)$('#challenges-dialog').close()
 state.game?.destroy();state.game=null
 state.mode='challenge';state.room=null;state.opponent=null
 showGame()
 $('#game').classList.add('focus','solo');$('.call-actions').hidden=true;$('#room-sidebar').hidden=true
 history.replaceState({},'',location.pathname)
 $('#room-label').textContent=`Challenge · ${def.name}`;$('#match-score').textContent=''
 $('#versus').innerHTML=`<span style="grid-column:1/-1;text-align:center"><b>${esc(def.name)}</b><small>${esc(def.blurb)}</small></span>`
 $('#practice-record').hidden=true
 state.game=new PoolGame({challenge:id,mode:'8ball',renderer:await ensureRenderer(),surface:$('.canvas-wrap'),status:$('#game-status'),groupStatus:$('#groups'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),jumpBtn:$('#jump'),spinPad:$('#spin'),moveCue:$('#move-cue'),changePocket:$('#change-pocket'),sfx,onReplay:paintReplayBar,aimSensitivity:tablePrefs.aimSensitivity,prefs:tablePrefs,host:true,practice:true,spectator:false,send:()=>{},onFinish:finishChallenge})
 state.game.setReady(true)
}
// The game has ended: keep a best, and say how it went.
function finishChallenge(result){
 const c=result.challenge,def=challengeById(c.id)
 const {results,newBest,best}=recordChallenge(challengeResults(),c.id,c.final)
 localStorage.setItem('pool-masters:challenges',JSON.stringify(results))
 music.duck();sfx.result(newBest)
 $('#result-title').textContent=newBest?'New best!':def.name
 const score=formatChallenge(c.id,c.final)+(def.unit&&c.id!=='clear'?' '+def.unit:'')
 $('#result-summary').textContent=`${def.name}: ${score}. Best: ${formatChallenge(c.id,best)}${def.unit&&c.id!=='clear'?' '+def.unit:''}.`
 $('#result-next').hidden=false;$('#result-next').textContent='Play again'
 $('#result-dialog').showModal()
 setTimeout(checkTrophies,1800)
}

// The shot camera's eye height, in words: from crouched at the cushion to standing over the table.
function eyeLabel(h){return h<=30?'crouched':h<=70?'at the cue':h<=110?'leaning in':'standing'}

// ---- house rules ----
function houseRules(){try{return normalizeHouse(JSON.parse(localStorage.getItem('pool-masters:house')))}catch{return normalizeHouse(null)}}
const houseTag=h=>{const d=describeHouse(h);return d?` · ${d}`:''}
function openHouse(){
 const h=houseRules(),fill=(sel,items,label,value)=>{$(sel).innerHTML=items.map(v=>`<option value="${v}">${esc(label(v))}</option>`).join('');$(sel).value=String(value)}
 fill('#house-race',RACES,v=>`${v} ${v===1?'rack':'racks'}${v===3?' (standard)':''}`,h.race)
 fill('#house-bih',BALL_IN_HAND,v=>houseWords.ballInHand[v]+(v==='anywhere'?' (standard)':''),h.ballInHand)
 fill('#house-breaker',BREAKERS,v=>houseWords.breaker[v]+(v==='host'?' (standard)':''),h.breaker)
 fill('#house-straight',STRAIGHT_TARGETS,v=>`${v} points${v===30?' (standard)':''}`,h.straightTo)
 $('#house-jumps').checked=h.jumps
 $('#house-summary').textContent=houseIsDefault(h)?'Standard rules.':describeHouse(h)
 $('#house-dialog').showModal()
}
function saveHouse(){
 const h=normalizeHouse({race:Number($('#house-race').value),ballInHand:$('#house-bih').value,breaker:$('#house-breaker').value,straightTo:Number($('#house-straight').value),jumps:$('#house-jumps').checked})
 localStorage.setItem('pool-masters:house',JSON.stringify(h))
 toast(houseIsDefault(h)?'Standard rules':`House rules: ${describeHouse(h)}`)
}

// ---- call controls ----
// The microphone and camera are icons, and each one says what it is right now: green and plain when it is
// live, red and struck through when it is off. (A call starts with the microphone muted.)
function paintCall(){
 const media=state.media
 const ICON={
  mic:'<path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/>',
  camera:'<path d="M3 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3z"/><path d="M16 11l5-3v8l-5-3"/>',
  slash:'<path d="M3 3l18 18" stroke-width="2.4"/>'
 }
 const icon=(kind,off)=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[kind]}${off?ICON.slash:''}</svg>`
 const paint=(sel,kind,noun,on)=>{
  const b=$(sel);if(!b)return
  b.innerHTML=icon(kind,!on)
  b.classList.toggle('live',on);b.classList.toggle('off',!on)
  const text=`${noun} is ${on?'on':'off'}`
  b.title=text;b.setAttribute('aria-label',`${text}. ${media?(on?'Turn it off':'Turn it on'):'Start a call'}`);b.setAttribute('aria-pressed',String(on))
 }
 paint('#mute','mic','Microphone',Boolean(media)&&!media.muted)
 paint('#camera','camera','Camera',Boolean(media)&&!media.cameraOff)
}

// Only someone playing can start the next rack; a spectator watches the table and has no say in it.
function canStartRack(){return state.mode!=='online'||state.role==='host'||state.role==='player'}

// ---- Rogue Pool ----
function rogueRecord(){try{return JSON.parse(localStorage.getItem('pool-masters:rogue'))||emptyRogue()}catch{return emptyRogue()}}
async function startRogue(){
 state.game?.destroy();state.game=null
 state.mode='rogue';state.room=null;state.opponent=null
 showGame()
 $('#game').classList.add('focus','solo');$('.call-actions').hidden=true;$('#room-sidebar').hidden=true
 history.replaceState({},'',location.pathname)
 const best=rogueRecord().best
 $('#room-label').textContent=`Rogue Pool · best ${best} ${best===1?'table':'tables'}`;$('#match-score').textContent=''
 $('#versus').innerHTML='<span style="grid-column:1/-1;text-align:center"><b>Rogue Pool</b><small>Clear each table within its shots. Take an upgrade after every table. Lose all your lives and the run is over.</small></span>'
 $('#practice-record').hidden=true
 state.game=new PoolGame({rogueSeed:Date.now()%1000003,mode:'8ball',house:{jumps:false},renderer:await ensureRenderer(),surface:$('.canvas-wrap'),status:$('#game-status'),groupStatus:$('#groups'),callout:$('#callout'),power:$('#power'),powerOut:$('.shot-controls output'),shoot:$('#shoot'),jumpBtn:$('#jump'),spinPad:$('#spin'),moveCue:$('#move-cue'),changePocket:$('#change-pocket'),sfx,onReplay:paintReplayBar,aimSensitivity:tablePrefs.aimSensitivity,prefs:tablePrefs,host:true,practice:true,spectator:false,send:()=>{},onRogue:onRogueEvent,onFinish:()=>{}})
 state.game.setReady(true)
}
function onRogueEvent(e){
 if(e.type==='cleared'){
  sfx.result(true)
  $('#rogue-summary').textContent=`Table ${e.run.level} cleared. ${e.run.lives} ${e.run.lives===1?'life':'lives'} left.`
  $('#rogue-offer').innerHTML=e.offer.map(u=>{const have=e.run.upgrades[u.id]||0;return `<button type="button" class="drill" data-upgrade="${u.id}"><span class="dots">＋</span><span class="what"><b>${esc(u.name)}${have?` <small>(you have ${have})</small>`:''}</b><small>${esc(u.desc)}</small></span></button>`}).join('')
  $('#rogue-dialog').showModal()
 }else if(e.type==='over'){
  const {rec,newBest}=recordRogue(rogueRecord(),e.run)
  localStorage.setItem('pool-masters:rogue',JSON.stringify(rec))
  music.duck();sfx.result(newBest)
  $('#result-title').textContent=newBest?'New best run!':'Run over'
  $('#result-summary').textContent=`You cleared ${e.run.cleared} ${e.run.cleared===1?'table':'tables'} and potted ${e.run.score} balls. Best: ${rec.best}.`
  $('#result-next').hidden=false;$('#result-next').textContent='New run'
  $('#result-dialog').showModal()
  setTimeout(checkTrophies,1800)
 }
}
