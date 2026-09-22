# Pool Masters

Minimal two-player pool with guest identities, room codes, durable chat, voice/video calls, Elo rankings, and unranked AI practice. Built with [Foyer](https://github.com/jay23606/foyer), Supabase, WebRTC, and GitHub Pages.

## Table views

The table renders through a swappable renderer. `src/render2d.js` is the original
top-down canvas view and stays the default; `src/render3d.js` is a three.js view
of the same simulation, loaded on demand when you hit the 3D button on the table
(and falling back to 2D if WebGL is unavailable). The simulation in `src/pool.js`
and the peer-to-peer protocol are identical either way.

## Development

```sh
npm install
npm run dev
```

Apply `supabase/schema.sql` to the same Supabase project after Foyer's schema. Anonymous authentication and Realtime must be enabled.
