create function jlpt_private.valid_exam_answers(payload jsonb)
returns boolean
language sql immutable strict set search_path = ''
as $$
  select jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 65536
    and not exists (
      select 1
      from jsonb_each(payload) as entry(k, v)
      where char_length(entry.k) not between 1 and 128
        or entry.k ~ E'\\x00'
        or entry.k in ('__proto__', 'constructor', 'prototype')
        or jsonb_typeof(entry.v) is distinct from 'number'
        or entry.v::text !~ '^[0-3]$'
    );
$$;

create function jlpt_private.valid_exam_sections(payload jsonb)
returns boolean
language sql immutable strict set search_path = ''
as $$
  select jsonb_typeof(payload) = 'array'
    and jsonb_array_length(payload) between 1 and 10
    and octet_length(payload::text) <= 16384
    and (
      select count(distinct elem ->> 'key')
      from jsonb_array_elements(payload) as elem
    ) = jsonb_array_length(payload)
    and not exists (
      select 1
      from jsonb_array_elements(payload) as elem
      where jsonb_typeof(elem) is distinct from 'object'
        or jsonb_typeof(elem -> 'key') is distinct from 'string'
        or (elem ->> 'key') not in ('vocab', 'grammar_reading', 'listening')
        or jsonb_typeof(elem -> 'status') is distinct from 'string'
        or (elem ->> 'status') not in ('pending', 'submitted', 'timed_out', 'skipped')
        or jsonb_typeof(elem -> 'total') is distinct from 'number'
        or (elem -> 'total')::text !~ '^(1000|[1-9][0-9]{0,2}|0)$'
        or jsonb_typeof(elem -> 'score') is distinct from 'number'
        or (elem -> 'score')::text !~ '^(1000|[1-9][0-9]{0,2}|0)$'
        or (
          case
            when (elem -> 'score')::text ~ '^(1000|[1-9][0-9]{0,2}|0)$'
              and (elem -> 'total')::text ~ '^(1000|[1-9][0-9]{0,2}|0)$'
            then (elem ->> 'score')::integer > (elem ->> 'total')::integer
            else true
          end
        )
        or jsonb_typeof(elem -> 'elapsedSeconds') is distinct from 'number'
        or (elem -> 'elapsedSeconds')::text !~ '^(0|[1-9][0-9]{0,8})$'
        or (elem -> 'submittedAt') is null
        or (
          jsonb_typeof(elem -> 'submittedAt') is distinct from 'null'
          and (
            jsonb_typeof(elem -> 'submittedAt') is distinct from 'string'
            or char_length(elem ->> 'submittedAt') not between 1 and 64
          )
        )
    );
$$;

create table public.exam_attempts (
  id uuid primary key check (id::text ~ '^[0-9a-f-]{14}4[0-9a-f]{3}-[89ab]'),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('n5', 'n4', 'n3', 'n2', 'n1')),
  exam_id text not null check (
    char_length(exam_id) between 1 and 128
    and exam_id !~ E'[\\x00/]'
    and exam_id not like '%..%'
  ),
  status text not null check (status in ('in_progress', 'completed')),
  attempt_number integer not null check (attempt_number between 1 and 10000),
  total_score integer not null,
  total_questions integer not null check (
    total_questions between 1 and 1000
    and total_score between 0 and total_questions
  ),
  sections jsonb not null check (jlpt_private.valid_exam_sections(sections)),
  answers jsonb not null check (jlpt_private.valid_exam_answers(answers)),
  started_at timestamptz not null check (
    started_at >= timestamptz '0001-01-01 00:00:00+00'
    and started_at < timestamptz '10000-01-01 00:00:00+00'
  ),
  completed_at timestamptz check (
    completed_at is null
    or (
      completed_at >= timestamptz '0001-01-01 00:00:00+00'
      and completed_at < timestamptz '10000-01-01 00:00:00+00'
    )
  ),
  client_updated_at timestamptz not null check (
    client_updated_at >= timestamptz '0001-01-01 00:00:00+00'
    and client_updated_at < timestamptz '10000-01-01 00:00:00+00'
  ),
  server_updated_at timestamptz not null,
  check (
    (status = 'completed' and completed_at is not null)
    or (status = 'in_progress' and completed_at is null)
  )
);

create unique index exam_attempts_one_in_progress_idx
  on public.exam_attempts (user_id, level, exam_id)
  where status = 'in_progress';

create unique index on public.exam_attempts (user_id, server_updated_at);

create function jlpt_private.apply_exam_attempt_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  old_sec jsonb;
  new_sec jsonb;
  sec_key text;
  old_status text;
  new_status text;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.level is distinct from old.level
       or new.exam_id is distinct from old.exam_id
       or new.attempt_number is distinct from old.attempt_number then
      raise check_violation using message = 'Exam attempt identity cannot change';
    end if;

    if old.status = 'completed' then
      raise check_violation using message = 'Completed exam attempt is immutable';
    end if;

    if not jlpt_private.valid_exam_sections(new.sections) then
      raise check_violation using message = 'Invalid exam sections';
    end if;

    if new.total_score < old.total_score then
      raise check_violation using message = 'Exam section status cannot regress';
    end if;

    for old_sec in select elem from jsonb_array_elements(old.sections) as elem loop
      sec_key := old_sec ->> 'key';
      old_status := old_sec ->> 'status';
      if old_status in ('submitted', 'timed_out', 'skipped') then
        select elem into new_sec
        from jsonb_array_elements(new.sections) as elem
        where elem ->> 'key' = sec_key
        limit 1;

        if new_sec is null then
          raise check_violation using message = 'Exam section status cannot regress';
        end if;

        new_status := new_sec ->> 'status';
        if new_status is distinct from old_status
           or (new_sec ->> 'score')::integer is distinct from (old_sec ->> 'score')::integer
           or (new_sec ->> 'total')::integer is distinct from (old_sec ->> 'total')::integer then
          raise check_violation using message = 'Exam section status cannot regress';
        end if;
      end if;
    end loop;
  end if;

  if new.user_id is not null and (auth.uid() is null or auth.uid() = new.user_id) then
    insert into jlpt_private.progress_cursors as cursor_state (user_id, table_name, stamp)
      values (new.user_id, tg_table_name, clock_timestamp())
      on conflict (user_id, table_name) do update
      set stamp = greatest(clock_timestamp(), cursor_state.stamp + interval '1 microsecond')
      returning stamp into new.server_updated_at;
  end if;

  return new;
end;
$$;

create trigger progress_lock before insert or update on public.exam_attempts
  for each statement execute function jlpt_private.lock_progress_writer();

create trigger progress_write before insert or update on public.exam_attempts
  for each row execute function jlpt_private.apply_exam_attempt_write();

alter table public.exam_attempts enable row level security;
revoke all on table public.exam_attempts from public, anon, authenticated, service_role;

grant select,
  insert (
    id, user_id, level, exam_id, status, attempt_number,
    total_score, total_questions, sections, answers,
    started_at, completed_at, client_updated_at
  ),
  update (
    id, user_id, level, exam_id, status, attempt_number,
    total_score, total_questions, sections, answers,
    started_at, completed_at, client_updated_at
  )
on public.exam_attempts to authenticated;

create policy own_confirmed_select on public.exam_attempts
  for select to authenticated
  using (user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email()));

create policy own_confirmed_insert on public.exam_attempts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email()));

create policy own_confirmed_update on public.exam_attempts
  for update to authenticated
  using (user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email()))
  with check (user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email()));

revoke execute on function
  jlpt_private.valid_exam_answers(jsonb),
  jlpt_private.valid_exam_sections(jsonb),
  jlpt_private.apply_exam_attempt_write()
from public, anon, authenticated, service_role;

grant execute on function
  jlpt_private.valid_exam_answers(jsonb),
  jlpt_private.valid_exam_sections(jsonb)
to authenticated;
