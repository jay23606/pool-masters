# Pool Masters

Minimal two-player pool with guest identities, room codes, durable chat, voice/video calls, Elo rankings, and unranked AI practice. Built with [Foyer](https://github.com/jay23606/foyer), Supabase, WebRTC, and GitHub Pages.

Play it at **[jay23606.github.io/pool-masters](https://jay23606.github.io/pool-masters/)**, or install it — it is a PWA.

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

## Controls

- **Power** and **Shoot** do the obvious thing.
- The **cue-ball dial** beside the power slider sets the tip contact point —
  drag it for draw, follow and English, double-click to centre it.
- Drag on the table to aim.
- **Move cue ball** and **Change 8-ball pocket** appear only when they apply.
  Neither the ball-in-hand placement nor the called pocket is final until the
  shot is actually taken.

The practice AI plans with ghost-ball geometry over every legal ball and
pocket, skips blocked paths and near-90° cuts, and allows for throw — without
that correction the exact geometric aim misses cuts against this physics.

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
so the tests gate the deploy. They cover the physics (stun, draw, follow,
throw, cushion behaviour, and that the result does not depend on the host's
frame rate) and the AI's shot planning, and they run headlessly against the
real simulation loop — no DOM, no renderer.
