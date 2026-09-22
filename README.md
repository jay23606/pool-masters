# Pool Masters

Minimal two-player pool with guest identities, room codes, durable chat, voice/video calls, Elo rankings, and unranked AI practice. Built with [Foyer](https://github.com/jay23606/foyer), Supabase, WebRTC, and GitHub Pages.

## Table views

The table renders through a swappable renderer. `src/render2d.js` is the original
top-down canvas view and stays the default; `src/render3d.js` is a three.js view
of the same simulation, loaded on demand when you hit the 3D button on the table
(and falling back to 2D if WebGL is unavailable). The simulation in `src/pool.js`
and the peer-to-peer protocol are identical either way.

## Physics

`src/physics.js` models the balls properly rather than damping velocity each
frame. Each ball carries angular velocity as well as linear, and a struck ball
skids before it grips and rolls — which is where stun, draw and follow come
from. Ball-on-ball contact has friction and restitution, so cuts throw the
object ball a few degrees off the line of centres; cushions lose more of a hard
impact than a soft one and react to sidespin. The tip contact point is set with
the cue-ball control beside the power slider.

The host is still authoritative: it runs the whole simulation and broadcasts
positions. The only protocol change is that a shot now carries its tip offset.

## Development

```sh
npm install
npm run dev
```

Apply `supabase/schema.sql` to the same Supabase project after Foyer's schema. Anonymous authentication and Realtime must be enabled.
