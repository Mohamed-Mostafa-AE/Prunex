-- Prunex private game archive and opt-in shared experience memory
-- Apply only after the target Supabase project is active.
-- Anonymous Auth must be enabled in Supabase Authentication settings.
-- The app uses Supabase Auth user UUIDs; raw IP addresses are deliberately not collected.

create table if not exists public.prunex_games (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  result text not null check (result in ('white_win', 'black_win', 'draw')),
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
  analysis_json jsonb not null
);

create table if not exists public.prunex_position_memory (
  id text primary key,
  game_id uuid not null references public.prunex_games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position_key text not null,
  side_to_move char(1) not null check (side_to_move in ('w', 'b')),
  move_uci text not null,
  san text not null,
  result_for_mover smallint not null check (result_for_mover in (-1, 0, 1)),
  eval_loss_cp integer not null check (eval_loss_cp >= 0),
  grade text not null,
  created_at timestamptz not null default now()
);

create index if not exists prunex_games_created_at_idx
  on public.prunex_games (created_at desc);
create index if not exists prunex_games_user_created_at_idx
  on public.prunex_games (user_id, created_at desc);
create index if not exists prunex_game_reviews_game_id_user_idx
  on public.prunex_game_reviews (game_id, user_id);
create index if not exists prunex_position_memory_user_id_idx
  on public.prunex_position_memory (user_id);

create index if not exists prunex_position_memory_lookup_idx
  on public.prunex_position_memory (position_key, side_to_move, eval_loss_cp);

create index if not exists prunex_position_memory_game_idx
  on public.prunex_position_memory (game_id);

alter table public.prunex_games enable row level security;
alter table public.prunex_game_reviews enable row level security;
alter table public.prunex_position_memory enable row level security;

-- New Supabase tables are not automatically exposed to the Data API.
-- Explicitly grant only the columns the browser needs. Ownership ids remain hidden.
revoke all on table public.prunex_games from anon, authenticated, public;
revoke all on table public.prunex_game_reviews from anon, authenticated, public;
revoke all on table public.prunex_position_memory from anon, authenticated, public;

grant usage on schema public to authenticated;

grant select (
  id, created_at, result, human_color, initial_fen, final_fen, pgn, moves, opponent_version
) on public.prunex_games to authenticated;
grant insert (
  id, user_id, created_at, result, human_color, initial_fen, final_fen, pgn, moves, opponent_version
) on public.prunex_games to authenticated;

grant select (
  game_id, created_at, white_accuracy, black_accuracy, analysis_json
) on public.prunex_game_reviews to authenticated;
grant insert (
  game_id, user_id, created_at, white_accuracy, black_accuracy, analysis_json
) on public.prunex_game_reviews to authenticated;

-- Only minimal move-quality fields are visible to the shared engine memory.
-- Game PGNs, game ids, timestamps and player ids remain unavailable to other users.
grant select (
  position_key, side_to_move, move_uci, result_for_mover, eval_loss_cp, grade
) on public.prunex_position_memory to authenticated;
grant insert (
  id, game_id, user_id, position_key, side_to_move, move_uci, san,
  result_for_mover, eval_loss_cp, grade, created_at
) on public.prunex_position_memory to authenticated;

drop policy if exists "authenticated users can read shared Prunex games" on public.prunex_games;
drop policy if exists "users can read their own Prunex games" on public.prunex_games;
create policy "users can read their own Prunex games"
  on public.prunex_games for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users can add their own Prunex games" on public.prunex_games;
create policy "users can add their own Prunex games"
  on public.prunex_games for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "authenticated users can read shared Prunex reviews" on public.prunex_game_reviews;
drop policy if exists "users can read their own Prunex reviews" on public.prunex_game_reviews;
create policy "users can read their own Prunex reviews"
  on public.prunex_game_reviews for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users can add their own Prunex reviews" on public.prunex_game_reviews;
create policy "users can add their own Prunex reviews"
  on public.prunex_game_reviews for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "authenticated users can read shared Prunex position memory" on public.prunex_position_memory;
create policy "authenticated users can read shared Prunex position memory"
  on public.prunex_position_memory for select to authenticated
  using (true);

drop policy if exists "users can add their own Prunex position memory" on public.prunex_position_memory;
create policy "users can add their own Prunex position memory"
  on public.prunex_position_memory for insert to authenticated
  with check (user_id = (select auth.uid()));
