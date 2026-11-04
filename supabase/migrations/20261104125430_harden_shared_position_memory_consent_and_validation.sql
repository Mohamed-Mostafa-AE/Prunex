-- Keep optional shared position-memory contributions tied to explicit, per-review consent.
alter table public.prunex_game_reviews
  add column if not exists share_position_memory boolean not null default false;

grant select (
  game_id, user_id, created_at, white_accuracy, black_accuracy,
  analysis_json, share_position_memory
) on public.prunex_game_reviews to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.prunex_position_memory'::regclass and conname = 'prunex_position_memory_eval_loss_cp_range_check') then
    alter table public.prunex_position_memory add constraint prunex_position_memory_eval_loss_cp_range_check check (eval_loss_cp between 0 and 30);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.prunex_position_memory'::regclass and conname = 'prunex_position_memory_grade_allowlist_check') then
    alter table public.prunex_position_memory add constraint prunex_position_memory_grade_allowlist_check check (grade in ('BRILLIANT', 'GREAT', 'BEST', 'EXCELLENT', 'GOOD'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.prunex_position_memory'::regclass and conname = 'prunex_position_memory_move_uci_format_check') then
    alter table public.prunex_position_memory add constraint prunex_position_memory_move_uci_format_check check (move_uci ~ '^[a-h][1-8][a-h][1-8][qrbn]?$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.prunex_position_memory'::regclass and conname = 'prunex_position_memory_position_key_length_check') then
    alter table public.prunex_position_memory add constraint prunex_position_memory_position_key_length_check check (char_length(position_key) between 10 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.prunex_position_memory'::regclass and conname = 'prunex_position_memory_san_length_check') then
    alter table public.prunex_position_memory add constraint prunex_position_memory_san_length_check check (char_length(san) between 1 and 16);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.prunex_position_memory'::regclass and conname = 'prunex_position_memory_id_length_check') then
    alter table public.prunex_position_memory add constraint prunex_position_memory_id_length_check check (char_length(id) between 1 and 128);
  end if;
end
$$;

grant delete on public.prunex_position_memory to authenticated;

drop policy if exists "users can add their own Prunex position memory" on public.prunex_position_memory;
create policy "users can add their own Prunex position memory"
  on public.prunex_position_memory for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.prunex_games as games where games.id = prunex_position_memory.game_id and games.user_id = (select auth.uid()))
    and exists (select 1 from public.prunex_game_reviews as reviews where reviews.game_id = prunex_position_memory.game_id and reviews.user_id = (select auth.uid()) and reviews.share_position_memory is true)
  );

drop policy if exists "users can update their own Prunex position memory" on public.prunex_position_memory;
create policy "users can update their own Prunex position memory"
  on public.prunex_position_memory for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.prunex_games as games where games.id = prunex_position_memory.game_id and games.user_id = (select auth.uid()))
  )
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.prunex_games as games where games.id = prunex_position_memory.game_id and games.user_id = (select auth.uid()))
    and exists (select 1 from public.prunex_game_reviews as reviews where reviews.game_id = prunex_position_memory.game_id and reviews.user_id = (select auth.uid()) and reviews.share_position_memory is true)
  );

drop policy if exists "users can delete their own Prunex position memory" on public.prunex_position_memory;
create policy "users can delete their own Prunex position memory"
  on public.prunex_position_memory for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.prunex_games as games where games.id = prunex_position_memory.game_id and games.user_id = (select auth.uid()))
  );
