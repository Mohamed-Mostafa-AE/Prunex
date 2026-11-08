create or replace function public.delete_my_position_memory_for_game(target_game_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  caller_id uuid := auth.uid();
  removed_rows integer := 0;
begin
  if caller_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if not exists (
    select 1 from public.prunex_games as games
    where games.id = target_game_id and games.user_id = caller_id
  ) then
    raise exception using errcode = '42501', message = 'The requested game is not owned by this account.';
  end if;
  delete from public.prunex_position_memory as memory
  where memory.game_id = target_game_id and memory.user_id = caller_id;
  get diagnostics removed_rows = row_count;
  return removed_rows;
end;
$function$;

revoke all on function public.delete_my_position_memory_for_game(uuid) from public, anon, authenticated;
grant execute on function public.delete_my_position_memory_for_game(uuid) to authenticated;
