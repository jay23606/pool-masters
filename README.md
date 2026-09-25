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

Rooms support WebRTC voice and video calls. The microphone and camera are icons that show their real state: green and plain when live, red and struck through when off (a call starts with the microphone muted). Use **Focus table** to hide the
room sidebar and give the table more space.

Pool Masters Radio streams real, actually-licensed tracks (CC BY / BY-SA,
fetched from Jamendo via the Openverse API) rather than a fixed playlist. It is on
by default at 20% volume (turn it off or change the volume and that choice is kept),
picks from 36 genres and a random page of each, so the mix is thousands of tracks,
and never repeats a song until 80 others have played. A failed request is retried on
other genres; a browser that blocks autoplay gets the song on your first tap. Only if
no real track can be had does it fall back to the procedurally-generated station
catalogue (`src/music.js`'s 48 `MUSIC_PRESETS`, the pool-themed loops), and it tries
the radio again every 40 seconds from there. Both sources duck automatically around a
rack result, which plays its own small Web Audio sting plus, on a win or loss, a short
CC0 crowd clip (Freesound, preloaded lazily). Music has its own volume control,
separate from the table's sound toggle.

Table settings include felt color, table size, cue finish, room lighting, cue
aim sensitivity (how far the cue rotates per pixel of drag), and mobile
haptics. Theme preference and table preferences are kept in local storage and,
for the table itself, synced to whichever player changes them.

## Table views

**Follow the shot.** In the 3D views, when a shot is taken the camera swings to where the cue was —
behind the cue ball, looking down the line of the shot — and returns when the balls stop.
Striped balls switch to their real stripes for it. Turn it off under TABLE → *Follow the shot*
(`src/shot-cam.js`), and set how high the player's eye is with *Player height for the shot camera* (crouched at the
cushion, at the cue, leaning in, or standing over the table; a stored value outside the range falls back to the default).

**The table is the point of the screen.** The site header is hidden while you play. On a
desktop or tablet the game fills the window and the table is fitted into whatever height is
left (container query units, so no row's height has to be guessed), with spin, power and Shoot
in a column beside it and the names and group line on one row above. Held upright on a phone
the table turns a quarter turn so its long side runs down the screen; the card is one screen
tall, the table is fitted into what the rows around it leave, and status, record and the
replay button share space. Landscape phones have their own layout. Pointer positions are
mapped back through the rotation in `src/screen-point.js`.

**The 3D table** has woven felt with the head string and spots, varnished wood-grain rails
with mother-of-pearl diamonds and brass inlay, engraved brass plates on rounded corner caps,
wedge-profile cushions with cut-back jaws at every pocket, and leather pocket rims. The cue is
built from a leather tip, ferrule, maple shaft, steel joint, inlaid forearm, linen wrap,
sleeve and bumper. All of it is view-only: the physics never sees it.

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

The lobby's game picker chooses **8-ball**, **9-ball**, **10-ball**, **Bank pool**, **Straight pool**, **One-pocket** or **Chaos Pool** for practice, for a new
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

### 10-ball

Nine-ball with one more ball: a triangle of ten with the 1 at the apex and the 10 in the middle, the cue ball must
hit the lowest ball first, a shot must pot something or drive a ball to a cushion, and the 10 on a legal shot wins
(a 10 potted on a foul goes back to the foot spot). It shares its rules and AI with nine-ball (`isRotation()`, with the
money ball a parameter). It is played without called shots, as nine-ball is here: real ten-ball makes you call the
ball and pocket, which this version does not yet ask for.

### Straight pool

Continuous pool (14.1), simplified: fifteen balls, every ball you pot scores a point for you in any pocket, a foul
(scratch, or hitting nothing) costs a point and gives the opponent ball in hand, and the first to thirty wins. When one
ball is left the other fourteen are racked again as a triangle with its apex open around it (a ball left in the way
of the rack goes on the apex). It is a scored game like bank pool, so it is one function in `judgeScoreGame()`, and the
AI plays it. Like the ten-ball above it is uncalled: real straight pool makes you name the ball and pocket for every shot.

### Bank pool and one-pocket

Both are scored games on a full rack of fifteen: any ball may be hit first, the cue ball must hit
something and must not go in a pocket (a foul gives the opponent ball in hand and scores nothing,
whatever dropped), and the first to eight wins. If the balls run out first the higher score wins,
and a tie goes to whoever was not shooting.

- **Bank pool:** a ball scores for the shooter only if it touched a cushion on its way to the pocket.
  One that dropped without a bank is out of the game and scores nothing. Keep the table while you bank.
- **One-pocket:** each player owns one of the two foot corners (you are ringed on the table; player A
  has the bottom right, B the top right). A ball scores for whoever owns the pocket it dropped in, so
  sinking one in your opponent's pocket gives them the point and ends your turn; a ball in any other
  pocket is out of the game.

`src/rules.js`'s `judgeScoreGame()` holds both as one pure function; the score crosses the network in
the snapshot (validated: two small whole numbers, and absent means nil-nil). The AI plays both. For
one-pocket it aims only at its own pocket. For bank shots it mirrors each pocket across each cushion,
aims the object ball at the mirror image, and keeps only a candidate that a real play-out confirms
actually banks the ball in (`bankShot()`), within a time budget so a turn never stalls; the coach
searches without the clock so its answer stays reproducible. The shot coach knows what counts here:
a ball that dropped but did not bank is "dropped, but it did not count". Self-play found a real bug
during the build: the game keeps its pockets as `pocketOf` where the rules read `pockets`, so one-pocket
never scored until the rules accepted both.

Both are unranked, like nine-ball.

Nine-ball is deliberately unranked for now: the ranking tables have no notion of
which game a result came from, and mixing the two into one Elo would be wrong.

## Two players, one device

**Two players, one device** on the lobby is hot-seat: pass the phone. No room code, no account, no
network, no ranking and no stats; it works offline, like practice. It is the practice game with a
second person where the AI was: whoever's turn it is becomes "me" (every rule and control already
speaks of the shooter that way), the HUD and status use *Player 1* and *Player 2*, a toast says whose
turn it is after each change, and the result and race-to-3 line name the players. Both 8-ball and
9-ball work, ball in hand goes to whoever is next, and the shot coach and replays work for either.
The tests pin that the turn follows the shooter, that a foul passes it on, and that the AI never
shoots for a human (mutation-checked).

## Puzzle maker

**Puzzle maker** on the lobby is an editor for pool puzzles. Tap the table to add a ball (up to eight), drag balls and the cue ball to move them, tap a ball to make it the one to pot,
and press **Check it**: the computer searches the real physics for a shot that pots the ball, and reports how many degrees of aim still work. Only a table it has solved can be shared: **Copy link**
makes a `?puzzle=` link. **Play it** tries the table yourself straight away.

Opening a link plays the packed shot through the physics again and refuses the puzzle if it does not pot the ball, so a link can never hold an unsolvable table, however it was made or edited.
The puzzle plays as a practice drill on the 7 ft table (the one the shots are proven on), with Show me and Retry. `src/puzzle.js` is the layout rules, the search and the link format as pure functions;
`src/puzzle-editor.js` is the dialog. The tests cover the layout checks, the solver, link round trips, and a set of malformed and unsolvable links.

## Chaos Pool

**Chaos Pool** is a scored game to 15 with a random twist dealt before every shot. The host deals it and it travels in the game state, so both players see the same one:

- **Bonus pocket** - an extra pocket opens on a long rail for one shot, and a ball that drops in it is worth 3.
- **Bomb ball** - one ball is a bomb: the first time anything touches it, it blasts the balls around it outward.
- **Gravity well** - a well pulls balls near it toward its centre and bends their paths.

Every pot scores a point, a foul costs one, and the table is racked again when one ball is left. `src/chaos.js` holds the twists as pure functions; the tests cover the dealing,
the blast, the well, the bonus scoring, the wire format, and a whole AI game to a winner.

## Rogue Pool

**Rogue Pool** on the lobby is a solo roguelike run. Each table is a scatter of balls and a budget of shots to clear it, and the tables grow (three balls, then more, up to nine)
while the slack shrinks. Clear a table and you take one of three random **upgrades** before the next: *Wide pockets* (15% wider, up to three times),
*Extra shots*, *Extra life*, *Jump charges* (two jump shots a table, and the Jump button appears), *Scratch shield* (the first scratch
on a table costs nothing extra), and *Second wind* (the first miss on a table is free). Run out of shots and you lose a life and get the same-sized table again with fresh balls;
lose all three and the run is over. Your best run (tables cleared) is kept in the browser, and two trophies read it.

`src/rogue.js` is the run as pure functions: every random choice (the balls, the offers) comes from one seeded generator, so the same seed is the same run and the tests can
pin it. The game plays it through the same physics, aim snapping and input as any other; wider pockets are real (they pot at the wider radius) and drawn wider in both views.
The tests cover the shot accounting, each upgrade, the offer, and a whole run played through the real game object by an AI, including that shooting is blocked while an upgrade
is being chosen.

## House rules

**House rules** on the lobby sets four things, kept in the browser and used for practice, two-player games and tables you host:

- **Race to** 1, 2, 3 (standard), 4, 5 or 7 racks.
- **After a foul:** ball in hand anywhere (standard), ball in hand only behind the head string (the kitchen), or none: the cue ball
  stays where it stopped, and goes back on the head spot, clear of any ball sitting there, if it was potted.
- **Who breaks:** the host always (standard), taking turns, the winner, or the loser. When the AI is due to break, it does.
- **Straight pool is played to** 15, 30 (standard), 50 or 100 points.
- **Jump shots:** a checkbox, off by default. When it is on, a **Jump** button appears beside Shoot; switch it on and the next
  shot (only that one) pops the cue ball off the cloth so it can hop over balls in its way.

A rule that is not standard is named in the game's header. An online table carries its rules in its room settings, so both players
play the same game; a table with house rules is never ranked, and *Find a game* skips tables that have them. Career opponents keep
the standard rules. The rules are validated wherever they come from (`src/house.js`): a stored value, or another player's room
settings, that is not one of the offered choices is replaced by the standard one. The AI places the cue ball behind the head string
when the kitchen rule says so.

### Jump shots

The simulation gives a ball a height. A jump shot lifts the cue ball half a ball off the cloth and gives it an upward speed that grows
with the shot (`jumpSpeed()`, between two limits, so a harder shot goes higher and further). While it is in the air it feels only
gravity on its height: it keeps its sideways speed and spin, collides with no ball and drops into no pocket, then lands and rolls as
any ball does. A ball that is in the air is never "at rest". Height crosses the network as two more numbers on a ball's tuple, sent only
while it is up, so old messages still validate; a guest asks for a jump with a flag on its shot message, and the host plays it only if the
house rules allow it (a hostile or stale client cannot jump on a table that forbids it). Drills, challenges and the coach never jump. In the flat view the ball is drawn larger
while it is up, and smaller as it comes down, with its shadow left on the cloth; in the 3D views it rises. Replays record positions only, so they do not show the hop.
The tests hop a ball the cue ball is touching, and check the same shot without a jump hits it (mutation-checked).

## Challenges

**Challenges** on the lobby are three short scored games for one player, each with a best kept in the browser:

- **Speed Pot:** pot as many as you can in 60 seconds. The clock starts with your first shot; a scratch puts the
  cue ball back and balls that drop on it do not count; a cleared table refills.
- **Perfect Potter:** pot a ball with every shot. The first shot that drops nothing, or scratches, ends the run.
- **Clear the Table:** pot all seven as fast as you can; each scratch adds five seconds.

The tables are random scatters (`scatter()`: apart, off the cushions, clear of the pockets and the cue ball, never the 8).
`src/challenges.js` is the rules as pure functions over plain state; `PoolGame` plays them, with the same input, aim
snapping and physics as any game. Three trophies (*Quick hands*, *Eight straight*, *Sprint*) read the bests. The tests cover
the scatter's legality across sixty seeds, each game's scoring and ending, the clock, bests never getting worse, and whole games
through the real game object (a run that ends on its first miss, a table that refills, a time-out that fires exactly once).

## Career

**Career** on the lobby is a ladder of ten opponents, each a short match at a rising level of the AI, with a
venue and a line of character: Rookie Ray at The Rusty Cue, Banker Bea at The Rail Room, the one-pocket
specialist, the nine-ball breaker, and at the top The Legend. It uses all four games (bank pool and
one-pocket are a single rack; the rest are races of two to four) and needs no server. Beat one to open the
next; any beaten opponent can be played again; a loss costs nothing. Progress is kept in the browser, and
the ladder unlocks trophies (*Making a name*, *Regular at the club*, *Champion of the circuit*) which in turn
unlock the Velvet felt and the Champion cue.

`src/career.js` is the ladder and its rules as pure data and functions. The AI gains four rungs
(novice, club, ace, legend) so the ladder can climb in even steps, and the tests pin that the ladder never
gets easier as it goes, that the levels form one scale, and how opening, recording a win and losing behave.

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

Drills and daily shots are always played on the 7 ft table, whatever your own table setting is (a toast says so, and your table comes back when you leave): a bigger table has smaller balls and pockets, so the same layout needs a different shot. Measured, the stored hints solve 11 of 11 drills and all of the dailies on 7 ft, but only 8 of 11 drills and about 40% of the dailies on 8 ft, and 6 of 11 and about a quarter on 9 ft.

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

### Daily shot

**Daily shot** on the lobby is one fixed table a day, the same for everyone, with no account
and no server (so it works offline). It plays like any drill: a hint if you want one, a retry
after a miss, and a **Share result** button that copies `Pool Masters Daily #268 ★★★` plus how
it went, ready to paste to a friend. The lobby button shows ✓ once today's is solved.

The tables are not made up on the day. `tools/gen-daily.mjs` draws layouts from a seeded
generator and keeps only those where a real search of the physics finds a shot with at least a
degree of aim to spare; the 180 it kept are stored as data in `src/daily-data.js`, so nothing
about the day's table depends on the player's browser. The date picks the table (day 1 is
1 January 2026, by the local calendar) and the weekday picks the difficulty — easy Monday and
Tuesday, hard Friday and Saturday — with a table not repeated until every other of its grade has
had its turn. The tests re-run every stored shot through the physics.

## Shot coach

After any shot of your own, the ⟲ menu has a **🎓 Coach** button. It grades that shot against the
best the AI can find from the same table: what you potted (or the foul, with the reason), how often
a shot like yours works for a steady player, and the shot the coach would have played, with how
often *that* works. **Watch your shot** and **Watch the coach's shot** both play back as replays on
the table as it stood before you shot.

It is the AI's own machinery turned on a person. `rollout()` already plays a shot out on a copy of
the table to screen for fouls; the coach plays yours out, plays out its own pick (the AI at a
"coach" level with no aim or power error), and wobbles each shot's aim and power a little sixteen
times to see how often it still drops something without fouling (`src/coach.js`). The same table
always gets the same words: the coach draws from a fixed random sequence, so its answer is
reproducible, and the tests pin the wording, the verdicts, and that it never touches the table it is
given. Breaks are described but not compared, and it is worked out when you ask, not after every
shot.

## Trophies

Thirty-five trophies in eight groups: racks won, nine-ball, skill (runs, break and
run, clean hands), opponents, practice drills and daily shots, the career ladder, sharing, and the league. Open the
🏆 button in the header for the case, with a progress bar for each one; an unlock
shows a toast. Stats are counted per device in the browser. They are derived from
finished shots, worked out from the table before and after, so a host and a guest
count the same things (a test plays whole racks and checks they do).

### Cosmetics, earned

Trophies unlock things to look at: four cues (Gold leaf, Crimson, Carbon, Galaxy), four felts
(Royal purple, Sunset, Ice, Black) and three rail woods (Maple, Cherry, Ebony) on top of everything that
was already free. The game has no ads and no purchases, so this is what a trophy is for. In TABLE, an
unearned choice is shown locked with the trophy that unlocks it ("🔒 Gold leaf — earn “Regular”");
the trophy case says what each trophy gives, and unlocking one says so in its toast. Nothing that a
player could choose before was put behind a trophy, and a stored choice that is not earned falls back
to the default.

`src/cosmetics.js` is the catalogue, the palettes the renderers draw from, and the unlock rules, as pure
data and functions. The tests pin that every unlock names a real trophy, every choice has a palette and
every palette entry is a choice, the old choices stay free, and that a choice unlocks by its own trophy
and nothing else. The cushions take their colour from the felt, so a purple table has purple cushions.
Everything is kept per device, like the trophies.

## Replays

Every shot is recorded as it plays and stays available until the next one
finishes. A ⟲ button appears beside the view buttons; it opens a small menu with
**Replay** and **Slow motion**, which play it back on your own table, and
**Copy replay link**, which puts it in a URL that opens a table which does nothing but
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
- **Shoot without the button:** press **Space** or **Enter** while aiming.
  (Pulling the cue back to shoot was tried and dropped: hard to do on a phone, easy to fire by accident.)
- The **cue-ball dial** beside the power slider sets the tip contact point —
  drag it for draw, follow and English, double-click to centre it.
- **Aim snapping:** when the line the object ball would take passes close to a pocket, the aim locks so the ball runs through the pocket's centre, and the pocket gets a soft white ring. It works on the extended angle too: the line the ball takes is drawn on past the first cushion it meets (the fainter gold line), and if that rebound would pass close to a pocket the aim snaps so the bank runs through the pocket's centre (a bank has to be clearly closer than a direct line to win over one, and gets a tighter reach because it is a longer shot). The banking geometry is the ideal mirror image, which is what the line draws; a real cushion sheds some speed, so it is a guide. It only nudges (never more than 3°), only toward a real shot (the same ball is still hit first, with nothing in the way), and your hand can always drag out of it: the drag turns an underlying aim and the snap is only what is shown (`src/snap.js`). Turn it off under TABLE → *Snap the aim to a pocket when it is close*.
- Drag on the table to aim; how far the cue turns per pixel is the aim
  sensitivity table setting.
- **Move cue ball** and **Change 8-ball pocket** appear only when they apply.
  Neither the ball-in-hand placement nor the called pocket is final until the
  shot is actually taken.
- The HUD names each player's group and, once assigned, how many of their
  balls are left (`YOU: STRIPES · 6 left | THEM: SOLIDS · 4 left`) — including while aiming at the 8 before
  it's legal, which explains itself (`The 8 is not yours yet · 4 stripes still
  to pot`) rather than silently refusing the pocket call.
- Drills and the daily shot title themselves, so the group line is hidden there.

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

## Roadmap

Two pages, both built from public sources and linked from the lobby's *Roadmap* button:
[`public/feature.html`](public/feature.html) compares the game with open-source and commercial pool games and
tracks what has shipped, and [`public/commercial.html`](public/commercial.html) compares it with commercial games
only, from their store listings, to find features worth building (a feature a listing does not mention is marked
unknown, never "no"). The second is generated: `node tools/build-commercial.mjs`.

## Development

```sh
npm install
npm run dev
npm test
```

Apply `supabase/schema.sql` to the same Supabase project after Foyer's schema. Anonymous authentication and Realtime must be enabled.

Pushing to `main` deploys to GitHub Pages. That workflow runs `npm test` first,
so the tests gate the deploy. 299 tests cover the physics (stun, draw, follow,
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
| `src/trophies.js` | the stats, the thirty-five trophies and how each is earned |
| `src/physics-info.js` | descriptions of the physics constants, for the read-only Physics panel |
| `src/drills.js` | the drills, how each is judged, their hints, and progress |
| `tools/solve-drills.mjs` | finds and ranks a working shot for every drill |
| `src/daily.js`, `src/daily-data.js` | the daily shot: date to table, difficulty by weekday, share text; the generated tables |
| `tools/gen-daily.mjs` | generates and proves the daily tables |
| `src/cosmetics.js` | the cues, felts and rail woods, the palettes, and which trophy unlocks which |
| `src/puzzle.js`, `src/puzzle-editor.js` | Puzzle maker: layout rules, solver, shareable links, the editor dialog |
| `src/chaos.js` | Chaos Pool: the twists (bonus pocket, bomb ball, gravity well) |
| `src/rogue.js` | Rogue Pool: the run, the upgrades, the shot accounting, the record |
| `src/house.js` | house rules: the choices, validation, who breaks, where the cue ball may go |
| `src/challenges.js` | the challenge games: scatter, scoring, clock, bests |
| `src/career.js` | the career ladder: opponents, who is open, recording a win |
| `src/coach.js` | the shot coach: grades a shot, finds the coach's shot, builds the replays |
| `src/snap.js` | aim snapping: nudging an aim so the object ball runs through a pocket's centre |
| `src/shot-cam.js` | the follow-the-shot camera's poses and blend |
| `src/screen-point.js` | maps a pointer back to the table through the phone's quarter turn |
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
