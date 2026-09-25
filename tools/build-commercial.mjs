// Builds public/commercial.html: Pool Masters against commercial billiards games only.
// It reuses the look of feature.html (its <style> block) and writes new content.
//   node tools/build-commercial.mjs
import fs from 'node:fs'

const feature=fs.readFileSync(new URL('../public/feature.html',import.meta.url),'utf8').replace(/\r\n/g,'\n')
const style=feature.slice(feature.indexOf('<style>'),feature.indexOf('</style>')+8)
  .replace('.pill.no{color:var(--no)}','.pill.no{color:var(--no)}\n.pill.unk{color:var(--muted2);font-weight:600}\n.dot.unk{background:transparent;border:1px dashed var(--muted2)}')

const GAMES=['Pool Masters','8 Ball Pool','Pure Pool Pro','Virtual Pool 4','Cue Club 2','Real Pool 3D']
const SUB=['this project','Miniclip · free, IAP','VooFoo · $24.99','Celeris · $24.99','$18.99','Poolians · free, IAP']

// [feature, [pm, 8bp, ppp, vp4, cc2, rp3d], note?]   y yes · p partial · n no · u not stated in the listing
const rows=[
['cat','Rules and games'],
['8-ball and 9-ball',['y','y','y','y','y','y']],
['Rule variants beyond 8/9-ball',['y','n','p','y','y','y'],'Ours: 10-ball, bank pool, straight pool and one-pocket. Virtual Pool 4 lists 27 games; Cue Club 2 lists 6, 7, 10-ball, 14.1, speed pool and killer; Pure Pool has challenge games.'],
['Straight pool (14.1)',['p','n','u','y','y','y'],'Ours is uncalled: every ball scores, a foul costs a point, first to thirty.'],
['Snooker or carom billiards',['n','n','u','y','y','y']],
['Party or arcade modes (killer, speed pot, rumble)',['p','u','y','u','y','y'],'Pure Pool: Speed Pot, Checkpoint, Perfect Potter, Royal Rumble. Ours: Speed Pot, Perfect Potter, Clear the Table.'],
['Customisable rules',['p','u','u','u','y','u'],'Cue Club 2 lists "fully customisable rules". Ours: race length, ball in hand, who breaks, the straight-pool score.'],
['Table sizes',['y','u','u','u','y','u'],'Ours: 7, 8 and 9 ft. Cue Club 2: 6 to 12 ft.'],

['cat','Progression'],
['Career or campaign against set opponents',['y','n','y','y','y','u'],'Pure Pool: hundreds of events, handcrafted opponents. Virtual Pool 4: Pro Tour and Hustler careers. Cue Club 2: bars, trophies. Ours: a ten-opponent ladder.'],
['Tournaments and brackets',['n','y','u','y','y','y'],'Virtual Pool 4: single and double elimination, with handicap. Real Pool 3D: ten prized events a day.'],
['Ranked league with tiers',['y','y','p','u','u','u'],'Ours: Elo league (8-ball only). 8 Ball Pool: league levels that unlock venues.'],
['Daily challenge',['y','n','y','u','u','u'],'Pure Pool: Daily Clearance. Ours: the daily shot.'],
['Unlockable cosmetics',['y','y','y','y','y','u'],'Cues, tables, ball sets, baize, avatars, chalk, depending on the game.'],
['Clubs or guilds',['n','y','u','u','u','u'],'8 Ball Pool: Club Quests.'],
['Achievements or trophies',['y','u','u','u','y','u']],

['cat','Multiplayer and social'],
['Online player-versus-player',['y','y','y','y','y','y']],
['Friends list or friend codes',['n','y','y','y','u','y'],'Deferred for us: no friends list yet.'],
['Local two-player on one device',['y','u','y','u','y','u']],
['More than two players at a table',['n','u','u','u','y','y'],'Cue Club 2: 2 to 4 players. Real Pool 3D: teams of up to six.'],
['Spectating live games',['y','y','u','u','y','u']],
['Text chat',['y','y','u','u','u','y'],'8 Ball Pool: "controlled chat" with unlockable emoji.'],
['Voice and video in a match',['y','u','u','u','u','u']],
['Crossplay across platforms',['y','u','y','u','u','u'],'Ours: any browser, and an installable app.'],

['cat','Practice and learning'],
['Practice against the AI',['y','y','y','y','y','y']],
['Trick shots or drills',['y','u','y','y','y','u'],'Virtual Pool 4 has a trick-shot library. Ours: eleven proven-solvable drills.'],
['Tutorials or coaching',['y','u','u','y','u','u'],'Virtual Pool 4: video tutorials. Ours: the shot coach grades your shot against the AI\'s.'],
['Slow-motion replay',['y','u','u','u','y','u'],'Cue Club 2: replay with a save facility.'],
['Shareable replay by link',['y','u','u','u','n','u']],
['Aim guidelines',['y','y','u','u','u','u']],

['cat','Platform and business'],
['Runs with no install',['y','p','n','n','n','n'],'8 Ball Pool has had a browser version; the others are Steam or app-store installs.'],
['Mobile',['y','y','u','y','p','u'],'Cue Club 2 is Windows, touchscreen compatible.'],
['VR support',['n','u','u','u','u','p'],'Real Pool 3D lists VR as a tag; its page gives no detail.'],
['Free, with no ads and no purchases',['y','n','n','n','n','n'],'The others charge upfront or sell coins, passes or DLC.'],
]

const legend=`
 <div class="legend">
  <span><i class="dot yes"></i> Has it</span>
  <span><i class="dot partial"></i> Partial / limited</span>
  <span><i class="dot no"></i> Its listing shows it does not</span>
  <span><i class="dot unk"></i> Not stated in the listing I read (unknown, not "no")</span>
 </div>`

const items=[
 {rank:1,title:'Tournaments and brackets',tag:['high','High impact'],
  body:'Four of the five have tournaments, and it is the feature that gives a player a reason to come back tomorrow. Virtual Pool 4 offers single and double elimination, with handicaps; Real Pool 3D runs ten prized events a day. We have a race-to-3 match and nothing above it. The bracket logic is pure and easy; the cost is that a tournament needs a shared, durable state, which means new database tables.',
  who:'8 Ball Pool, Virtual Pool 4, Cue Club 2, Real Pool 3D'},
 {rank:2,title:'A career mode',tag:['done','Shipped'],shipped:true,
  body:'Shipped. Pure Pool, Virtual Pool 4 and Cue Club 2 all wrap the game in a campaign, and now so do we: a ladder of ten opponents and venues across all four games that opens up as you win, on seven rungs of AI from novice to legend, with trophies and cosmetics as rewards. It needs no server. What it does not have yet: opponents whose playing styles differ (a safety player, a banker, a power breaker) beyond how well they play.',
  who:'Pure Pool Pro, Virtual Pool 4, Cue Club 2'},
 {rank:3,title:'Challenge games: speed pot, perfect potter',tag:['done','Shipped'],shipped:true,
  body:'Shipped: Speed Pot, Perfect Potter and Clear the Table, each with a best. Pure Pool builds a whole menu of short scored challenges (Speed Pot, Checkpoint, Perfect Potter, Royal Rumble) and Cue Club 2 has speed pool; they give a five-minute session something to aim at. Not yet: Checkpoint and a Royal-Rumble-style elimination mode.',
  who:'Pure Pool Pro, Cue Club 2, Real Pool 3D'},
 {rank:4,title:'More rule sets: 10-ball and straight pool',tag:['done','Shipped'],shipped:true,
  body:'Shipped, simplified. Virtual Pool 4, Cue Club 2 and Real Pool 3D list straight pool (14.1); Cue Club 2 also has 10-ball. We now have both: ten-ball on the nine-ball rules, and straight pool as a race to thirty with re-racks and a point off for a foul. Neither asks you to call your shot, which the real games do; that, and killer (three or more players), are what is left.',
  who:'Virtual Pool 4, Cue Club 2, Real Pool 3D'},
 {rank:5,title:'House rules',tag:['done','Shipped'],shipped:true,
  body:'Shipped, in part. Cue Club 2 advertises fully customisable rules; we now let a host choose the race length, what happens to the cue ball after a foul (anywhere, behind the head string, or where it stopped), who breaks, and the score straight pool is played to. Online tables carry the rules so both players play the same game, and are never ranked. Not yet: called shots, or rule sets beyond these four.',
  who:'Cue Club 2'},
 {rank:6,title:'Up to four at a table, and teams',tag:['low','Lower priority'],
  body:'Cue Club 2 seats up to four; Real Pool 3D has teams of up to six. Local hot-seat for more than two, or two-versus-two, is cheap to add to the shared-device mode. More than two online players changes the host-authoritative model and is a large piece of work.',
  who:'Cue Club 2, Real Pool 3D'},
 {rank:7,title:'Friends list and clubs',tag:['low','Deferred'],
  body:'8 Ball Pool, Pure Pool, Virtual Pool 4 and Real Pool 3D have friends; 8 Ball Pool adds clubs and club quests. Deferred for now, since both need new database tables.',
  who:'8 Ball Pool, Pure Pool Pro, Virtual Pool 4, Real Pool 3D'},
 {rank:8,title:'Snooker and carom',tag:['low','Lower priority'],
  body:'Three of the five have snooker or carom billiards. It means a bigger table, different balls and scoring, and a different physics tuning. A large piece of work for a different audience, so it stays at the bottom.',
  who:'Virtual Pool 4, Cue Club 2, Real Pool 3D'},
]

const skips=[
 ['A coin economy, loot boxes and a paid pass','8 Ball Pool sells coins, a Pool Pass and random items. Pool Masters has no ads and no purchases, and that is worth more to a player than another currency. Cosmetics stay earned.'],
 ['Perks from owning more cues','8 Ball Pool grants power for a bigger cue collection, which rewards spending. Cosmetics here are only cosmetic.'],
 ['VR','Real Pool 3D lists it as a tag. It would need a headset-first rebuild for a very small audience.']
]

const cards=[
 ['8 Ball Pool','Miniclip. Free with in-app purchases; 4.8 million ratings on the App Store. 8-ball and 9-ball, ranked leagues that unlock venues, clubs and club quests, collectible cues, tables and avatars, friend challenges, spectating, controlled chat, and aim guidelines.'],
 ['Pure Pool Pro','VooFoo Studios. $24.99 on PC. Career in 8-ball and 9-ball with handcrafted opponents across hundreds of events, challenge games, a daily challenge, leaderboards, crossplay online and local multiplayer, and unlockable cues, ball sets and baize.'],
 ['Virtual Pool 4','Celeris. $24.99 on PC, with a mobile version. 27 games including snooker, billiards and straight pool, two career modes, single and double elimination tournaments, a trick-shot library, and video tutorials.'],
 ['Cue Club 2','$18.99 on PC. Pool and snooker: 6, 7, 8, 9, 10-ball, 14.1, speed pool, killer and snooker, customisable rules, 2 to 4 players and spectating, bars to unlock, tables from 6 to 12 ft, and slow-motion replay with save.'],
 ['Real Pool 3D (Poolians)','Free with in-app purchases on Steam. 8-ball, 15-ball, snooker and coin-team games, teams of up to six, more than ten prized events a day, avatars, profiles, chat and a friends list.'],
]

const sources=[
 ['https://apps.apple.com/us/app/8-ball-pool/id543186831','8 Ball Pool','App Store listing'],
 ['https://en.wikipedia.org/wiki/8_Ball_Pool','8 Ball Pool','Wikipedia'],
 ['https://store.steampowered.com/app/3456930/Pure_Pool_Pro/','Pure Pool Pro','Steam page'],
 ['https://store.steampowered.com/app/336150/Virtual_Pool_4/','Virtual Pool 4','Steam page'],
 ['https://store.steampowered.com/app/366690/Cue_Club_2_Pool__Snooker/','Cue Club 2','Steam page'],
 ['https://store.steampowered.com/app/670290/Real_Pool_3D__Poolians/','Real Pool 3D (Poolians)','Steam page'],
 ['https://www.pockettactics.com/pool-games','The best pool games in 2026','Pocket Tactics']
]

const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const icon=c=>c==='y'?'<span class="pill yes">✓</span>':c==='p'?'<span class="pill partial">~</span>':c==='u'?'<span class="pill unk" title="not stated in the listing">?</span>':'<span class="pill no">–</span>'

const html=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pool Masters — Against the commercial games</title>
${style}
</head>
<body>

<header>
 <p class="eyebrow">Pool Masters · Commercial landscape</p>
 <h1>What the paid games have<br><em>that we don't.</em></h1>
 <p>The other roadmap compares us with open-source projects too. This one is only the commercial
 games: five pool titles people pay for, or play for free and then pay inside, read for the
 features we lack and the ones we should be glad not to copy.</p>
 <p class="meta">Compiled September 2026 from each game's own store listing, so it shows what
 they advertise, not everything they do. Where a listing does not mention a feature the table says
 <strong>?</strong> (unknown), never "no". See Sources. · <a href="feature.html" style="color:#8ed0ad">The wider roadmap</a></p>
</header>

<main>

<section>
 <h2><span class="n">01</span>The field</h2>
 <p class="section-sub">Five commercial games, chosen to span the market: the mobile giant, a
 free-to-play PC title, and three paid PC games from a career-focused simulator to a
 27-game collection.</p>
 <div class="verdict-grid">
  <div class="card"><h3 style="color:var(--green)">Pool Masters</h3><p>This project. Free in any browser, installable, with no ads and no purchases. Live voice and video in the match, a host-authoritative simulation, a shot coach, replay links, a daily shot, hot-seat play, four games, and earned cosmetics.</p></div>
${cards.map(([n,t])=>`  <div class="card"><h3>${esc(n)}</h3><p>${esc(t)}</p></div>`).join('\n')}
 </div>
</section>

<section>
 <h2><span class="n">02</span>What is worth building</h2>
 <p class="section-sub">Ranked by how many of the five have it and how well it fits what
 the game already is. Each item names who has it.</p>
 <div class="roadmap">
${items.map(i=>`  <div class="rm${i.shipped?' shipped':''}">
   <div class="rank">${i.shipped?'✓':i.rank}</div>
   <div><h4>${esc(i.title)}</h4>
   <p>${esc(i.body)}</p>
   <p style="margin-top:6px;font-size:.76rem;color:var(--muted2)">Seen in: ${esc(i.who)}</p></div>
   <span class="tag ${i.tag[0]}">${esc(i.tag[1])}</span>
  </div>`).join('\n')}
 </div>
</section>

<section>
 <h2><span class="n">03</span>What we are deliberately not copying</h2>
 <p class="section-sub">Commercial games have things that make money, not things that make a
 better game. Naming them keeps the roadmap honest.</p>
 <div class="roadmap">
${skips.map(([t,b])=>`  <div class="rm">
   <div class="rank">✕</div>
   <div><h4>${esc(t)}</h4><p>${esc(b)}</p></div>
   <span class="tag low">Not planned</span>
  </div>`).join('\n')}
 </div>
</section>

<section>
 <h2><span class="n">04</span>Full comparison</h2>
 <p class="section-sub">Scored from each game's store listing. A dashed <strong>?</strong> means the
 listing does not say, which is different from "no".</p>
${legend}
 <div class="table-scroll">
 <table>
  <thead>
   <tr>
    <th>Feature</th>
${GAMES.map((g,i)=>`    <th${i===0?' class="ours"':''}>${esc(g)}<small>${esc(SUB[i])}</small></th>`).join('\n')}
   </tr>
  </thead>
  <tbody>
${rows.map(r=>r[0]==='cat'
  ?`   <tr class="cat-row"><th colspan="7">${esc(r[1])}</th></tr>`
  :`   <tr><th>${esc(r[0])}${r[2]?`<div style="font-weight:400;color:var(--muted2);font-size:.72rem;margin-top:3px;white-space:normal;max-width:300px">${esc(r[2])}</div>`:''}</th>${r[1].map((c,i)=>`<td${i===0?' class="ours"':''}>${icon(c)}</td>`).join('')}</tr>`).join('\n')}
  </tbody>
 </table>
 </div>
</section>

<section>
 <h2><span class="n">05</span>Sources</h2>
 <p class="sources">
${sources.map(([u,n,d])=>`  <a href="${u}" target="_blank" rel="noopener">${esc(n)}</a> — ${esc(d)}.`).join('<br>\n')}
 </p>
</section>

</main>

<footer>Pool Masters commercial roadmap · built from public store listings for internal planning, not as a competitive claim.</footer>

</body>
</html>
`
fs.writeFileSync(new URL('../public/commercial.html',import.meta.url),html)
console.log('wrote public/commercial.html',html.length,'bytes;',rows.filter(r=>r[0]!=='cat').length,'features')
