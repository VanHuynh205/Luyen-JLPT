create schema jlpt_private;
revoke all on schema jlpt_private from public, anon, authenticated, service_role;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text collate "C" unique check (username ~ '^[a-z0-9_]{3,32}$'),
  current_level text not null default 'n4' check (current_level in ('n5', 'n4', 'n3', 'n2', 'n1'))
);

create function jlpt_private.create_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  signup_name text;
begin
  if new.raw_app_meta_data ->> 'provider' = 'email' then
    signup_name := new.raw_user_meta_data ->> 'username';
    if jsonb_typeof(new.raw_user_meta_data -> 'username') is distinct from 'string'
       or not (signup_name collate "C" ~ '^[A-Za-z0-9_]{3,32}$') then
      raise check_violation using message = 'Invalid username';
    end if;
    signup_name := lower(signup_name collate "C");
  end if;

  insert into public.profiles (user_id, username) values (new.id, signup_name);
  return new;
end;
$$;

create trigger jlpt_create_profile after insert on auth.users
for each row execute function jlpt_private.create_profile();

create function jlpt_private.has_confirmed_email()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid()) and email <> '' and email_confirmed_at is not null
  );
$$;

create function jlpt_private.valid_wrong_item_ids(item_ids text[])
returns boolean
language sql immutable strict set search_path = ''
as $$
  select coalesce(array_ndims(item_ids), 1) = 1 and not exists (
    select 1 from unnest(item_ids) as item(id) where id is null or char_length(id) not between 1 and 128
  );
$$;

create table public.card_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 128),
  level text not null check (level in ('n5', 'n4', 'n3', 'n2', 'n1')),
  known boolean not null,
  client_updated_at timestamptz not null check (client_updated_at >= timestamptz '0001-01-01 00:00:00+00' and client_updated_at < timestamptz '10000-01-01 00:00:00+00'),
  server_updated_at timestamptz not null,
  primary key (user_id, level, item_id)
);

create table public.grammar_learned (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 128),
  level text not null check (level in ('n5', 'n4', 'n3', 'n2', 'n1')),
  learned boolean not null,
  client_updated_at timestamptz not null check (client_updated_at >= timestamptz '0001-01-01 00:00:00+00' and client_updated_at < timestamptz '10000-01-01 00:00:00+00'),
  server_updated_at timestamptz not null,
  primary key (user_id, level, item_id)
);

create table public.kanji_quiz_attempts (
  id uuid primary key check (id::text ~ '^[0-9a-f-]{14}4[0-9a-f]{3}-[89ab]'),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('n5', 'n4', 'n3', 'n2', 'n1')),
  mode text not null check (mode in ('single', 'compound', 'mixed')),
  score integer not null check (score between 0 and total),
  total integer not null check (total between 1 and 1000),
  wrong_item_ids text[] not null default '{}' check (
    cardinality(wrong_item_ids) <= total and jlpt_private.valid_wrong_item_ids(wrong_item_ids)
  ),
  client_updated_at timestamptz not null check (client_updated_at >= timestamptz '0001-01-01 00:00:00+00' and client_updated_at < timestamptz '10000-01-01 00:00:00+00'),
  server_updated_at timestamptz not null
);

create table public.reading_attempts (
  id uuid primary key check (id::text ~ '^[0-9a-f-]{14}4[0-9a-f]{3}-[89ab]'),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 128),
  level text not null check (level in ('n5', 'n4', 'n3', 'n2', 'n1')),
  score integer not null check (score between 0 and total),
  total integer not null check (total between 1 and 1000),
  client_updated_at timestamptz not null check (client_updated_at >= timestamptz '0001-01-01 00:00:00+00' and client_updated_at < timestamptz '10000-01-01 00:00:00+00'),
  server_updated_at timestamptz not null
);

create table jlpt_private.progress_cursors (
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name name not null,
  stamp timestamptz not null,
  primary key (user_id, table_name)
);

create function jlpt_private.lock_progress_writer()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('jlpt_progress:' || auth.uid()::text, 0));
  return null;
end;
$$;

create function jlpt_private.apply_progress_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.level is distinct from old.level
       or new.item_id is distinct from old.item_id then
      raise check_violation using message = 'Progress identity cannot change';
    end if;
    if new.client_updated_at <= old.client_updated_at then
      return null;
    end if;
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

do $$
declare
  relation text;
begin
  foreach relation in array array['profiles', 'card_status', 'grammar_learned', 'kanji_quiz_attempts', 'reading_attempts'] loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', relation);
    execute format('grant select on table public.%I to authenticated', relation);
    execute format('create policy own_confirmed_select on public.%I for select to authenticated
      using (user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email()))', relation);

    if relation in ('profiles', 'card_status', 'grammar_learned') then
      execute format('create policy own_confirmed_update on public.%I for update to authenticated
        using (user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email()))
        with check (user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email()))', relation);
    end if;

    if relation = 'profiles' then
      continue;
    end if;
    execute format('create unique index on public.%I (user_id, server_updated_at)', relation);
    execute format('create policy own_confirmed_insert on public.%I for insert to authenticated
      with check (user_id = (select auth.uid()) and (select jlpt_private.has_confirmed_email()))', relation);
    if relation in ('card_status', 'grammar_learned') then
      execute format('create trigger progress_lock before insert or update on public.%I
        for each statement execute function jlpt_private.lock_progress_writer()', relation);
      execute format('create trigger progress_write before insert or update on public.%I
        for each row execute function jlpt_private.apply_progress_write()', relation);
    else
      execute format('create trigger progress_lock before insert on public.%I
        for each statement execute function jlpt_private.lock_progress_writer()', relation);
      execute format('create trigger progress_write before insert on public.%I
        for each row execute function jlpt_private.apply_progress_write()', relation);
    end if;
  end loop;
end;
$$;

grant update (current_level) on public.profiles to authenticated;
grant insert (user_id, item_id, level, known, client_updated_at),
  update (user_id, item_id, level, known, client_updated_at) on public.card_status to authenticated;
grant insert (user_id, item_id, level, learned, client_updated_at),
  update (user_id, item_id, level, learned, client_updated_at) on public.grammar_learned to authenticated;
grant insert (id, user_id, level, mode, score, total, wrong_item_ids, client_updated_at)
  on public.kanji_quiz_attempts to authenticated;
grant insert (id, user_id, item_id, level, score, total, client_updated_at)
  on public.reading_attempts to authenticated;

revoke execute on all functions in schema jlpt_private from public, anon, authenticated, service_role;
grant usage on schema jlpt_private to authenticated;
grant execute on function jlpt_private.has_confirmed_email(), jlpt_private.valid_wrong_item_ids(text[]) to authenticated;
