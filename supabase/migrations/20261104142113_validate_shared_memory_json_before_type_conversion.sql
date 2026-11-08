-- Validate raw JSON fields before casts can truncate or normalize invalid values.
create or replace function public.replace_my_position_memory_for_game(target_game_id uuid, position_samples jsonb)
returns integer language plpgsql security invoker set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  sharing_enabled boolean;
  sample_count integer;
  inserted_rows integer := 0;
begin
  if caller_id is null then raise exception using errcode = '28000', message = 'Authentication is required.'; end if;
  if position_samples is null or pg_catalog.jsonb_typeof(position_samples) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Position samples must be a JSON array.';
  end if;
  sample_count := pg_catalog.jsonb_array_length(position_samples);
  if sample_count > 2048 then raise exception using errcode = '22023', message = 'A game cannot contribute more than 2048 position samples.'; end if;

  if sample_count > 0 and exists (
    select 1
    from pg_catalog.jsonb_to_recordset(position_samples) as sample(
      position_key text, side_to_move text, move_uci text, san text,
      result_for_mover text, eval_loss_cp text, grade text
    )
    where sample.position_key is null
       or pg_catalog.char_length(sample.position_key) not between 10 and 100
       or sample.side_to_move is null or sample.side_to_move not in ('w', 'b')
       or sample.move_uci is null or sample.move_uci !~ '^[a-h][1-8][a-h][1-8][qrbn]?$'
       or sample.san is null or pg_catalog.char_length(sample.san) not between 1 and 16
       or sample.result_for_mover is null or sample.result_for_mover not in ('-1', '0', '1')
       or sample.eval_loss_cp is null or sample.eval_loss_cp !~ '^(0|[1-9]|[12][0-9]|30)$'
       or sample.grade is null or sample.grade not in ('BRILLIANT', 'GREAT', 'BEST', 'EXCELLENT', 'GOOD')
  ) then
    raise exception using errcode = '22023', message = 'One or more shared position samples contain invalid fields.';
  end if;

  select reviews.share_position_memory into sharing_enabled
    from public.prunex_game_reviews as reviews join public.prunex_games as games on games.id = reviews.game_id
   where reviews.game_id = target_game_id and reviews.user_id = caller_id and games.user_id = caller_id;
  if not found then raise exception using errcode = '42501', message = 'The requested game review is not owned by this account.'; end if;
  if sharing_enabled is not true and sample_count > 0 then
    raise exception using errcode = '42501', message = 'This game review has not opted in to shared position memory.';
  end if;
  delete from public.prunex_position_memory as memory where memory.game_id = target_game_id and memory.user_id = caller_id;
  if sharing_enabled is true and sample_count > 0 then
    insert into public.prunex_position_memory (
      id, game_id, user_id, position_key, side_to_move, move_uci, san, result_for_mover, eval_loss_cp, grade
    )
    select pg_catalog.gen_random_uuid()::text, target_game_id, caller_id, sample.position_key,
      sample.side_to_move, sample.move_uci, sample.san,
      sample.result_for_mover::smallint, sample.eval_loss_cp::integer, sample.grade
    from pg_catalog.jsonb_to_recordset(position_samples) as sample(
      position_key text, side_to_move text, move_uci text, san text,
      result_for_mover text, eval_loss_cp text, grade text
    );
    get diagnostics inserted_rows = row_count;
  end if;
  return inserted_rows;
end;
$function$;
revoke all on function public.replace_my_position_memory_for_game(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_my_position_memory_for_game(uuid, jsonb) to authenticated;
comment on function public.replace_my_position_memory_for_game(uuid, jsonb) is
  'Atomically replace/revoke shared position memory; raw JSON is validated before casts and caller RLS applies.';
