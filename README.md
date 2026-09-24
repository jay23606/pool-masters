# Pool Masters

Minimal two-player eight-ball with persistent guest identities, room codes,
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

## Rules and AI

`src/rules.js` holds eight-ball rules as plain functions over a ball array and
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

Keeping the rules and the AI as pure functions, independently testable without
a game object, is what caught a real bug: group assignment on an open table
used to depend on which ball happened to be first in a list rather than which
one actually fell first, so potting one of each could hand a player the wrong
group and foul every shot after.

## Controls

- **Power** and **Shoot** do the obvious thing.
- The **cue-ball dial** beside the power slider sets the tip contact point —
  drag it for draw, follow and English, double-click to centre it.
- Drag on the table to aim; how far the cue turns per pixel is the aim
  sensitivity table setting.
- **Move cue ball** and **Change 8-ball pocket** appear only when they apply.
  Neither the ball-in-hand placement nor the called pocket is final until the
  shot is actually taken.
- The HUD names each player's group and, once assigned, how many of their
  balls are left (`YOU: STRIPES · 4`) — including while aiming at the 8 before
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
so the tests gate the deploy. 82 tests cover the physics (stun, draw, follow,
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
| `src/rules.js` | eight-ball rules as pure functions |
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
