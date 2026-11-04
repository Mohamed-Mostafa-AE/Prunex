-- Prunex cloud archive schema.
-- Anonymous Supabase sessions use the authenticated database role. Private
-- game/review rows are owner-scoped; shared memory exposes minimal fields.

create table if not exists public.prunex_games (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  result text not null check (result in ('white_win', 'black_win', 'draw', 'in_progress')),
  human_color char(1) not null check (human_color in ('w', 'b')),
  initial_fen text not null,
  final_fen text not null,
  pgn text not null default '',
  moves jsonb not null default '[]'::jsonb,
  opponent_version text not null default 'Prunex 0.8.0 browser opponent'
);

create table if not exists public.prunex_game_reviews (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.prunex_games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  white_accuracy numeric(5, 1),
  black_accuracy numeric(5, 1),
  analysis_json jsonb not null,
  share_position_memory boolean not null default false
);

create table if not exists public.prunex_position_memory (
  id text primary key check (char_length(id) between 1 and 128),
  game_id uuid not null references public.prunex_games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position_key text not null check (char_length(position_key) between 10 and 100),
  side_to_move char(1) not null check (side_to_move in ('w', 'b')),
  move_uci text not null check (move_uci ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  san text not null check (char_length(san) between 1 and 16),
  result_for_mover smallint not null check (result_for_mover in (-1, 0, 1)),
  eval_loss_cp integer not null check (eval_loss_cp between 0 and 30),
  grade text not null check (grade in ('BRILLIANT', 'GREAT', 'BEST', 'EXCELLENT', 'GOOD')),
  created_at timestamptz not null default now()
);

create index if not exists prunex_games_created_at_idx on public.prunex_games (created_at desc);
create index if not exists prunex_games_user_created_at_idx on public.prunex_games (user_id, created_at desc);
create index if not exists prunex_game_reviews_game_id_user_idx on public.prunex_game_reviews (game_id, user_id);
create unique index if not exists prunex_game_reviews_game_user_unique_idx on public.prunex_game_reviews (game_id, user_id);
create index if not exists prunex_game_reviews_user_id_idx on public.prunex_game_reviews (user_id);
create index if not exists prunex_position_memory_user_id_idx on public.prunex_position_memory (user_id);
create index if not exists prunex_position_memory_lookup_idx on public.prunex_position_memory (position_key, side_to_move, eval_loss_cp);
create index if not exists prunex_position_memory_game_idx on public.prunex_position_memory (game_id);

alter table public.prunex_games enable row level security;
alter table public.prunex_game_reviews enable row level security;
alter table public.prunex_position_memory enable row level security;

revoke all on table public.prunex_games from anon, authenticated, public;
revoke all on table public.prunex_game_reviews from anon, authenticated, public;
revoke all on table public.prunex_position_memory from anon, authenticated, public;
grant usage on schema public to authenticated;

-- SELECT is needed for owner-check subqueries; RLS restricts visible rows.
grant select on public.prunex_games to authenticated;
grant insert (
  id, user_id, created_at, result, human_color, initial_fen, final_fen, pgn, moves, opponent_version
) on public.prunex_games to authenticated;
grant update on public.prunex_games to authenticated;

grant select (
  game_id, user_id, created_at, white_accuracy, black_accuracy, analysis_json, share_position_memory
) on public.prunex_game_reviews to authenticated;
grant insert (
  game_id, user_id, created_at, white_accuracy, black_accuracy, analysis_json, share_position_memory
) on public.prunex_game_reviews to authenticated;
grant update on public.prunex_game_reviews to authenticated;

-- Column-level INSERT and DELETE grants are paired with RLS policies that
-- require the owner and recorded consent. UPDATE is not granted. The RPC
-- replaces/revokes samples atomically under invoker rights.
grant select (
  id, position_key, side_to_move, move_uci, result_for_mover, eval_loss_cp, grade
) on public.prunex_position_memory to authenticated;
grant insert (
  id, game_id, user_id, position_key, side_to_move, move_uci, san,
  result_for_mover, eval_loss_cp, grade, created_at
) on public.prunex_position_memory to authenticated;
grant delete on public.prunex_position_memory to authenticated;

drop policy if exists "authenticated users can read shared Prunex games" on public.prunex_games;
drop policy if exists "users can read their own Prunex games" on public.prunex_games;
create policy "users can read their own Prunex games" on public.prunex_games
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "users can add their own Prunex games" on public.prunex_games;
create policy "users can add their own Prunex games" on public.prunex_games
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "users can update their own Prunex games" on public.prunex_games;
create policy "users can update their own Prunex games" on public.prunex_games
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "authenticated users can read shared Prunex reviews" on public.prunex_game_reviews;
drop policy if exists "users can read their own Prunex reviews" on public.prunex_game_reviews;
create policy "users can read their own Prunex reviews" on public.prunex_game_reviews
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "users can add their own Prunex reviews" on public.prunex_game_reviews;
create policy "users can add their own Prunex reviews" on public.prunex_game_reviews
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.prunex_games as games
      where games.id = game_id and games.user_id = (select auth.uid())
    )
  );

drop policy if exists "users can update their own Prunex reviews" on public.prunex_game_reviews;
create policy "users can update their own Prunex reviews" on public.prunex_game_reviews
  for update to authenticated using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.prunex_games as games
      where games.id = game_id and games.user_id = (select auth.uid())
    )
  ) with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.prunex_games as games
      where games.id = game_id and games.user_id = (select auth.uid())
    )
  );

drop policy if exists "authenticated users can read shared Prunex position memory" on public.prunex_position_memory;
create policy "authenticated users can read shared Prunex position memory"
  on public.prunex_position_memory for select to authenticated using (true);

drop policy if exists "users can add their own Prunex position memory" on public.prunex_position_memory;
create policy "users can add their own Prunex position memory"
  on public.prunex_position_memory for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.prunex_games as games
      where games.id = prunex_position_memory.game_id
        and games.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.prunex_game_reviews as reviews
      where reviews.game_id = prunex_position_memory.game_id
        and reviews.user_id = (select auth.uid())
        and reviews.share_position_memory is true
    )
  );

drop policy if exists "users can delete their own Prunex position memory" on public.prunex_position_memory;
create policy "users can delete their own Prunex position memory"
  on public.prunex_position_memory for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.prunex_games as games
      where games.id = prunex_position_memory.game_id
        and games.user_id = (select auth.uid())
    )
  );

create or replace function public.replace_my_position_memory_for_game(target_game_id uuid, position_samples jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  sharing_enabled boolean;
  sample_count integer;
  inserted_rows integer := 0;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if position_samples is null or pg_catalog.jsonb_typeof(position_samples) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Position samples must be a JSON array.';
  end if;
  sample_count := pg_catalog.jsonb_array_length(position_samples);
  if sample_count > 2048 then
    raise exception using errcode = '22023', message = 'A game cannot contribute more than 2048 position samples.';
  end if;

  if sample_count > 0 and exists (
    select 1
    from pg_catalog.jsonb_to_recordset(position_samples) as sample(
      position_key text, side_to_move text, move_uci text, san text,
      result_for_mover text, eval_loss_cp text, grade text
    )
    where sample.position_key is null
       or pg_catalog.char_length(sample.position_key) not between 10 and 100
       or sample.side_to_move is null or sample.side_to_move not in ('w', 'b')
       or sample.move_uci is null or sample.move_uci !~ '^[a-h][1-8][a-h][1-8][qrbn]?  select reviews.share_position_memory into sharing_enabled
    from public.prunex_game_reviews as reviews
    join public.prunex_games as games on games.id = reviews.game_id
   where reviews.game_id = target_game_id
     and reviews.user_id = caller_id
     and games.user_id = caller_id;
  if not found then
    raise exception using errcode = '42501', message = 'The requested game review is not owned by this account.';
  end if;
  if sharing_enabled is not true and sample_count > 0 then
    raise exception using errcode = '42501', message = 'This game review has not opted in to shared position memory.';
  end if;

  delete from public.prunex_position_memory as memory
   where memory.game_id = target_game_id and memory.user_id = caller_id;

  if sharing_enabled is true and sample_count > 0 then
    insert into public.prunex_position_memory (
      id, game_id, user_id, position_key, side_to_move, move_uci, san,
      result_for_mover, eval_loss_cp, grade
    )
    select pg_catalog.gen_random_uuid()::text, target_game_id, caller_id,
      sample.position_key, sample.side_to_move, sample.move_uci, sample.san,
      sample.result_for_mover::smallint, sample.eval_loss_cp::integer, sample.grade
    from pg_catalog.jsonb_to_recordset(position_samples) as sample(
      position_key text, side_to_move character(1), move_uci text, san text,
      result_for_mover text, eval_loss_cp text, grade text
    );
    get diagnostics inserted_rows = row_count;
  end if;
  return inserted_rows;
end;
$function$;

revoke all on function public.replace_my_position_memory_for_game(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_my_position_memory_for_game(uuid, jsonb) to authenticated;

       or sample.san is null or pg_catalog.char_length(sample.san) not between 1 and 16
       or sample.result_for_mover is null or sample.result_for_mover not in ('-1', '0', '1')
       or sample.eval_loss_cp is null or sample.eval_loss_cp !~ '^(0|[1-9]|[12][0-9]|30)  select reviews.share_position_memory into sharing_enabled
    from public.prunex_game_reviews as reviews
    join public.prunex_games as games on games.id = reviews.game_id
   where reviews.game_id = target_game_id
     and reviews.user_id = caller_id
     and games.user_id = caller_id;
  if not found then
    raise exception using errcode = '42501', message = 'The requested game review is not owned by this account.';
  end if;
  if sharing_enabled is not true and sample_count > 0 then
    raise exception using errcode = '42501', message = 'This game review has not opted in to shared position memory.';
  end if;

  delete from public.prunex_position_memory as memory
   where memory.game_id = target_game_id and memory.user_id = caller_id;

  if sharing_enabled is true and sample_count > 0 then
    insert into public.prunex_position_memory (
      id, game_id, user_id, position_key, side_to_move, move_uci, san,
      result_for_mover, eval_loss_cp, grade
    )
    select pg_catalog.gen_random_uuid()::text, target_game_id, caller_id,
      sample.position_key, sample.side_to_move, sample.move_uci, sample.san,
      sample.result_for_mover::smallint, sample.eval_loss_cp::integer, sample.grade
    from pg_catalog.jsonb_to_recordset(position_samples) as sample(
      position_key text, side_to_move character(1), move_uci text, san text,
      result_for_mover text, eval_loss_cp text, grade text
    );
    get diagnostics inserted_rows = row_count;
  end if;
  return inserted_rows;
end;
$function$;

revoke all on function public.replace_my_position_memory_for_game(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_my_position_memory_for_game(uuid, jsonb) to authenticated;

       or sample.grade is null or sample.grade not in ('BRILLIANT', 'GREAT', 'BEST', 'EXCELLENT', 'GOOD')
  ) then
    raise exception using errcode = '22023', message = 'One or more shared position samples contain invalid fields.';
  end if;

  select reviews.share_position_memory into sharing_enabled
    from public.prunex_game_reviews as reviews
    join public.prunex_games as games on games.id = reviews.game_id
   where reviews.game_id = target_game_id
     and reviews.user_id = caller_id
     and games.user_id = caller_id;
  if not found then
    raise exception using errcode = '42501', message = 'The requested game review is not owned by this account.';
  end if;
  if sharing_enabled is not true and sample_count > 0 then
    raise exception using errcode = '42501', message = 'This game review has not opted in to shared position memory.';
  end if;

  delete from public.prunex_position_memory as memory
   where memory.game_id = target_game_id and memory.user_id = caller_id;

  if sharing_enabled is true and sample_count > 0 then
    insert into public.prunex_position_memory (
      id, game_id, user_id, position_key, side_to_move, move_uci, san,
      result_for_mover, eval_loss_cp, grade
    )
    select pg_catalog.gen_random_uuid()::text, target_game_id, caller_id,
      sample.position_key, sample.side_to_move, sample.move_uci, sample.san,
      sample.result_for_mover::smallint, sample.eval_loss_cp::integer, sample.grade
    from pg_catalog.jsonb_to_recordset(position_samples) as sample(
      position_key text, side_to_move character(1), move_uci text, san text,
      result_for_mover text, eval_loss_cp text, grade text
    );
    get diagnostics inserted_rows = row_count;
  end if;
  return inserted_rows;
end;
$function$;

revoke all on function public.replace_my_position_memory_for_game(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_my_position_memory_for_game(uuid, jsonb) to authenticated;
