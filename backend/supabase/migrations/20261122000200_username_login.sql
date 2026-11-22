create table jlpt_private.login_rate_limits (
  bucket text primary key,
  attempts integer not null,
  window_start timestamptz not null
);

create function public.resolve_username_login(p_username text)
returns table (allowed boolean, user_id uuid, email text)
language plpgsql security definer set search_path = ''
as $$
declare
  current_window timestamptz;
  global_bucket jlpt_private.login_rate_limits%rowtype;
  found_user uuid;
  found_email text;
begin
  if p_username is null or not (p_username collate "C" ~ '^[a-z0-9_]{3,32}$') then
    return query select false, null::uuid, null::text;
    return;
  end if;

  insert into jlpt_private.login_rate_limits values ('', 0, '-infinity') on conflict do nothing;
  select * into global_bucket from jlpt_private.login_rate_limits where bucket = '' for update;
  current_window := date_bin('5 minutes', transaction_timestamp(), '2000-01-01 00:00:00+00');

  if global_bucket.window_start < current_window then
    delete from jlpt_private.login_rate_limits where bucket <> '';
    update jlpt_private.login_rate_limits set attempts = 0, window_start = current_window where bucket = '';
  elsif global_bucket.attempts >= 120 then
    return query select false, null::uuid, null::text;
    return;
  end if;

  insert into jlpt_private.login_rate_limits as quota values (p_username, 1, current_window)
    on conflict (bucket) do update set attempts = quota.attempts + 1 where quota.attempts < 10;
  if not found then
    return query select false, null::uuid, null::text;
    return;
  end if;
  update jlpt_private.login_rate_limits set attempts = attempts + 1 where bucket = '';

  select users.id, users.email into found_user, found_email from public.profiles as profile
  join auth.users as users on users.id = profile.user_id
  where profile.username = p_username and users.email <> '' and users.email_confirmed_at is not null;
  return query select true, found_user, found_email;
end;
$$;

revoke execute on function public.resolve_username_login(text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_username_login(text) to service_role;
