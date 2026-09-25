# Pool Masters

Minimal two-player eight-ball and nine-ball with persistent guest identities, room codes,
durable chat, voice/video calls, host-admitted spectators, Elo rankings, and
unranked AI practice. Built with [Foyer](https://github.com/jay23606/foyer),
Supabase, WebRTC, and GitHub Pages.

Play it at **[jay23606.github.io/pool-masters](https://jay23606.github.io/pool-masters/)**, or install it — it is a PWA.

## Play, watch, and resume

Create a table or join one with its five-character code. The lobby shows each
table's player occupancy (`0/2`, `1/2`, or `2/2`) and its admitted spectator
count. A player can use **Watch** to request spectator access; the host sees an
**Admit** button. Spectators receive the live table, chat, and call, but cannot
take a player seat, shoot, advance a rack, or affect rankings.

The host owns the game simulation. Only the assigned second seat can send it a
shot request, and it broadcasts the authoritative state to the player and all
admitted spectators. This keeps a viewer from controlling the rack even if
they modify their browser locally.

Rooms save stable between-shot state. A host can leave and return to the same
table for up to four hours; the original host restores the saved rack when
they return. This avoids inventing motion halfway through a shot.

Racks in a room are scored as a shared race-to-3 match, shown as `Race to 3 ·
2–1` and persisted on the room so both players see the same running score
after a refresh. A rack or match result can be shared or copied with the
native share sheet (`navigator.share`, falling back to the clipboard).

## League and practice

League leaders are ordered by Elo rating. Each row also shows wins, losses,
and win percentage. Both players must independently report the same ranked
result before the database records it, so a single browser cannot award itself
a win. New league profiles begin at 1000 Elo.

A player's own stats dialog goes further: current and best win streaks, a
break-and-run count, a won/lost breakdown by table size, and their eight most
recent ranked racks.

Practice against the AI is unranked and stored only on the current device, and
can be played at three difficulty levels — Beginner, League, or Pro — which
tune the AI's aim error, power error, and how tight a cut it's willing to
attempt. `src/ai.js`'s `AI_LEVELS` holds the three tunings.

## Calls, sound, and appearance

Rooms support WebRTC voice and video calls. Use **Focus table** to hide the
room sidebar and give the table more space.

Pool Masters Radio streams real, actually-licensed tracks (CC BY / BY-SA,
fetched from Jamendo via the Openverse API) rather than a fixed playlist, with
a large procedurally-generated station catalogue (`src/music.js`'s 48
`MUSIC_PRESETS`) as the fallback when a fetch fails or a track won't play. Both
sources duck automatically around a rack result, which plays its own small
Web Audio sting plus, on a win or loss, a short CC0 crowd clip (Freesound,
preloaded lazily). Music has its own volume control, separate from the table's
sound toggle.

Table settings include felt color, table size, cue finish, room lighting, cue
aim sensitivity (how far the cue rotates per pixel of drag), and mobile
haptics. Theme preference and table preferences are kept in local storage and,
for the table itself, synced to whichever player changes them.

## Table views

**Follow the shot.** In the 3D views, when a shot is taken the camera swings to where the cue was —
behind the cue ball, looking down the line of the shot — and returns when the balls stop.
Striped balls switch to their real stripes for it. Turn it off under TABLE → *Follow the shot*
(`src/shot-cam.js`).

Held upright on a phone, the table turns a quarter turn so its long side runs down the
screen and fills the width; the site header and secondary buttons are hidden while you
play. Landscape is unchanged. Pointer positions are mapped back in `src/screen-point.js`.

The table draws through a swappable renderer, and the button in the corner of
the table cycles three of them:

| | |
|---|---|
| **TOP** | top-down 3D — the default. The plan layout, lit and shaded. |
| **3D** | the same scene from an angled camera. |
| **2D** | the original flat canvas. |

`src/render3d.js` holds the WebGL views and `src/render2d.js` the flat one.
Both read the same balls out of `src/pool.js`, so the simulation and the
peer-to-peer protocol are identical whichever is on screen. three.js is loaded
by dynamic `import()`, so it arrives as its own chunk; if WebGL is unavailable
the view falls back to 2D and says so.

The two 3D views share one scene — switching between them only moves the
camera, because building the renderer bakes sixteen ball textures.

## Physics

Every constant below is listed, with what it does, in TABLE → *How the physics works* (read-only;
`src/physics-info.js` reads the values from `physics.js` live, and a test fails if one is added without a description).

`src/physics.js` models the balls properly rather than damping velocity each
frame. Each ball carries angular velocity as well as linear, and a struck ball
skids before it grips and rolls — which is where stun, draw and follow come
from, including the way draw fades and turns into follow as the shot gets
longer. Nothing special-cases those; they fall out of the contact model.

Ball-on-ball contact has friction and restitution, so cuts throw the object
ball a few degrees off the line of centres. Cushions lose more of a hard impact
than a soft one and trade sidespin with the ball.

The table is 700×380 units with a 9-unit ball, which puts one unit at about
4.06 mm — so the speed scale is physical, and the coefficients are real ones.
The exception is rolling resistance, set about twice its real value so shots
settle in a couple of seconds.

The host stays authoritative: it runs the whole simulation and broadcasts
positions. The only thing a shot adds to the wire is its tip offset.

The simulation advances in fixed 1/120s steps against the wall clock rather
than being paced by the animation frame, so a shot plays out identically
whatever the frame rate does. A host whose tab gets backgrounded — browsers
throttle `requestAnimationFrame` there — keeps the physics moving on a coarse
timer instead of freezing the game for both players.

## Game modes

The lobby's game picker chooses **8-ball** or **9-ball** for practice, for a new
table, and for quick play (which only joins a table of the same game). A table
carries its game in its room metadata and in every state snapshot, so a guest
always ends up in the host's game, whatever it started as.

Nine-ball is the standard WPA game: ten balls in a diamond with the 1 at the
apex and the 9 in the middle, no groups and no called pockets. The cue ball must
hit the lowest-numbered ball on the table first, and the shot must then pocket
something or drive a ball to a cushion. Pocketing any ball on a legal shot
keeps the turn. The 9 on a legal shot wins the rack, including off a
combination; the 9 pocketed on a foul goes back to the foot spot. Any foul gives
the opponent ball in hand. The AI plays both games.

Nine-ball is deliberately unranked for now: the ranking tables have no notion of
which game a result came from, and mixing the two into one Elo would be wrong.

## Drills

**Drills** on the lobby opens eleven one-shot exercises on fixed tables, in three
levels: straight-in, a cut into a side pocket, across the table, a corner cut, a
combination, a stop shot, the break, and at level three draw, follow, a bank and a
kick shot. Each has a goal, a tip and a **Show me** that sets the aim, power and
spin to a shot that works. A miss says why (it can tell a scratch, the wrong
pocket, a bank that never touched a cushion, a kick that hit a ball first, or a
cue ball that ended up in the wrong place) and resets the table by itself; a
success leaves it for you to look at, replay, or move on from. Progress and best
attempts are kept in the browser; a solve the hint aimed completes the drill but
does not set a record.

A practice mode with an impossible drill is worse than none, so every drill is
proven solvable. `tools/solve-drills.mjs` searches angle, power and spin with the
real physics and prefers the most robust solution, since a hint that only works
to the last decimal place would not survive another browser's maths; the tests
then run every stored hint through the real game, so a change to the physics or a
layout that breaks a drill fails the build (run the tool again when that
happens). The search also shaped the drills: corner pockets turned out to be
small targets in this game, so the first corner and long-shot layouts had aiming
windows of a third of a degree and were replaced, and the break's own tip had to
be corrected once it showed that a full-power break with no spin scratches every
time.

## Trophies

Twenty-five trophies in seven groups: racks won, nine-ball, skill (runs, break and
run, clean hands), opponents, practice drills, sharing, and the league. Open the
🏆 button in the header for the case, with a progress bar for each one; an unlock
shows a toast. Stats are counted per device in the browser. They are derived from
finished shots, worked out from the table before and after, so a host and a guest
count the same things (a test plays whole racks and checks they do).

## Replays

Every shot is recorded as it plays and stays available until the next one
finishes: **↺ Replay** and **Slow motion** play it back on your own table, and
**Copy replay link** puts it in a URL that opens a table which does nothing but
play that shot, with a *Play a game* button for whoever lands on it. A full
16-ball break is about a thousand characters.

The host records on its simulation clock, so a shot is as smooth as any other
even if its tab was hidden and could only be stepped in coarse chunks. Guests and
spectators record from the snapshots they are sent, the same ~25Hz stream, so a
shot looks the same whoever shares it.

A replay is a recording of positions, deliberately not a list of inputs to be
re-simulated: two JavaScript engines are not obliged to agree to the last bit on
`sin`, `cos` or `pow`, and billiards amplifies a last-bit difference into a
visibly different shot. Recorded positions look identical on every browser.
Positions are delta-coded and deflated (`src/replay.js`); a link is untrusted
input, so decoding is bounded in size (including how far it may inflate), in
range, and never treated as anything but numbers. A replay recorded on another
table size is shown at that size and your own is put back afterwards.

## Rules and AI

`src/rules.js` holds the eight-ball and nine-ball rules as plain functions over a ball array and
a state object — no DOM, network, or game object anywhere in it. `judgeShot()`
takes a shot's outcome (potted balls, first contact, scratch, called pocket)
and returns a verdict; `src/pool.js`'s `PoolGame` applies it and owns the side
effects. `src/ai.js` is the practice opponent in the same style: `chooseShot()`
plans with ghost-ball geometry over every legal ball and pocket, skips blocked
paths and near-90° cuts, and allows for throw — without that correction the
exact geometric aim misses cuts against this physics. When nothing is pottable
it prefers a safety it can actually reach over the nearest ball regardless of
what's in the way, and rolls candidate angles through the real physics to find
a legal escape when snookered.

Before it shoots, the AI plays its own shot out on a copy of the table using the
game's real stepping (`rollout()`) and redraws if the shot would scratch, hit
the wrong ball first, miss the cushion rule in nine-ball, or pot the 8 early.
Ball-in-hand placement is screened the same way. Only fouls are screened, so a
shot that merely misses its pot is still played and the difficulty levels keep
their aim errors. This came out of self-play: from one layout the cue ball
followed the object ball into a pocket on every single attempt.

Keeping the rules and the AI as pure functions, independently testable without
a game object, is what caught a real bug: group assignment on an open table
used to depend on which ball happened to be first in a list rather than which
one actually fell first, so potting one of each could hand a player the wrong
group and foul every shot after.

## Controls

- **Power** and **Shoot** do the obvious thing.
- **Shoot without the button:** press **Space** or **Enter** while aiming, or, on a touch screen, **pull back** —
  press on the cue ball, drag away from it like drawing a bow, and release. The shot goes
  the opposite way to the pull and its power is the length of the pull (`src/pullback.js`);
  letting go close to the ball cancels and puts the power back.
- The **cue-ball dial** beside the power slider sets the tip contact point —
  drag it for draw, follow and English, double-click to centre it.
- Drag on the table to aim; how far the cue turns per pixel is the aim
  sensitivity table setting.
- **Move cue ball** and **Change 8-ball pocket** appear only when they apply.
  Neither the ball-in-hand placement nor the called pocket is final until the
  shot is actually taken.
- The HUD names each player's group and, once assigned, how many of their
  balls are left (`YOU: STRIPES · 4 left`) — including while aiming at the 8 before
  it's legal, which explains itself (`The 8 is not yours yet · 4 stripes still
  to pot`) rather than silently refusing the pocket call.

## Progressive web app

`public/manifest.webmanifest` and `public/sw.js` make it installable and let it
open offline; practice against the AI works with no network at all, while rooms
and chat still need one.

The service worker is deliberately conservative, because the site redeploys on
every push to `main`. Navigations go to the network first and fall back to
cache only when genuinely offline, so a deploy is never missed. Hashed build
output is cache-first, since a hit is by definition the right file. It does not
call `skipWaiting`, so a page that is already open keeps the caches its own
chunks came from.

Icons are generated rather than committed as opaque binaries:

```sh
node tools/make-icons.mjs
```

It renders them from signed-distance shapes through a small PNG encoder over
node's `zlib`, so there is no image dependency.

## Development

```sh
npm install
npm run dev
npm test
```

Apply `supabase/schema.sql` to the same Supabase project after Foyer's schema. Anonymous authentication and Realtime must be enabled.

Pushing to `main` deploys to GitHub Pages. That workflow runs `npm test` first,
so the tests gate the deploy. 268 tests cover the physics (stun, draw, follow,
throw, cushion behaviour, and that a shot is bit-identical regardless of frame
pacing — 240Hz, a jittery rate, even one update per second on a backgrounded
tab), the rules (`judgeShot()`'s verdicts for fouls, group assignment, and
every way the 8 can end a game), the AI's shot planning at each difficulty,
the network protocol and room security, and match/performance/preference
bookkeeping. They run headlessly against the real simulation and rules — no
DOM, no renderer.

### Code layout

| file | what it is |
|---|---|
| `src/pool.js` | game state, DOM/network glue, applies verdicts from `rules.js` |
| `src/rules.js` | eight-ball and nine-ball rules and racks as pure functions |
| `src/replay.js` | recording, the link format and its validation, and playback |
| `src/trophies.js` | the stats, the twenty-five trophies and how each is earned |
| `src/physics-info.js` | descriptions of the physics constants, for the read-only Physics panel |
| `src/drills.js` | the drills, how each is judged, their hints, and progress |
| `tools/solve-drills.mjs` | finds and ranks a working shot for every drill |
| `src/ai.js` | the practice opponent, over a ball array |
| `src/physics.js` | the contact model |
| `src/game-input.js` | pointer/drag input, separated from match control |
| `src/game-state.js` | the authoritative, renderer-free fields that cross the network |
| `src/protocol.js` | validates incoming network messages before they touch state |
| `src/room-security.js` | who may send the host a command |
| `src/spectators.js`, `src/room-summary.js` | roles, seats, and lobby occupancy |
| `src/match-score.js`, `src/ranking.js` | race-to session score and Elo result mapping |
| `src/performance.js` | local break/run and by-table-size stats |
| `src/preferences.js` | table settings, validated before use |
| `src/music.js` | Pool Masters Radio |
| `src/sfx.js` | table sound effects, event detection, and result stings |
| `src/render3d.js`, `src/render2d.js` | the three table views |
| `src/main.js` | app shell: rooms, lobby, HUD wiring |
