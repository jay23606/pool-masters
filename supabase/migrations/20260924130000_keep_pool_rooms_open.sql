-- Pool Masters rooms may be empty temporarily while a saved rack is resumable.
-- Other Foyer rooms retain the package's ordinary close-on-empty behaviour.
create or replace function public.foyer_close_empty_room()
returns trigger language plpgsql security definer as $$
begin
  if not exists (select 1 from public.foyer_room_players p where p.room_id = old.room_id) then
    update public.foyer_rooms
    set is_open = case when metadata->>'game' = 'pool'
                          and (metadata->>'resume_until')::timestamptz > now()
                     then true else false end,
        updated_at = now()
    where id = old.room_id;
  end if;
  return old;
end $$;

create or replace function public.foyer_reap_rooms(stale_seconds integer default 90)
returns void language plpgsql security definer as $$
begin
  delete from public.foyer_room_players
  where last_seen < now() - make_interval(secs => stale_seconds);

  update public.foyer_rooms r set is_open = false, updated_at = now()
  where r.is_open
    and not exists (select 1 from public.foyer_room_players p where p.room_id = r.id)
    and not (r.metadata->>'game' = 'pool' and (r.metadata->>'resume_until')::timestamptz > now());
end $$;
