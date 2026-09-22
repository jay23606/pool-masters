# Pool Masters

Minimal two-player pool with guest identities, room codes, durable chat, voice/video calls, Elo rankings, and unranked AI practice. Built with [Foyer](https://github.com/jay23606/foyer), Supabase, WebRTC, and GitHub Pages.

## Development

```sh
npm install
npm run dev
```

Apply `supabase/schema.sql` to the same Supabase project after Foyer's schema. Anonymous authentication and Realtime must be enabled.
