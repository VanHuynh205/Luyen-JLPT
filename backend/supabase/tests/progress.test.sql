begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'first@example.test', now(), '{"provider":"email"}', '{"username":"Learner_One"}'),
  ('10000000-0000-4000-8000-000000000002', 'second@example.test', now(), '{"provider":"email"}', '{"username":"Learner_Two"}'),
  ('10000000-0000-4000-8000-000000000003', 'pending@example.test', null, '{"provider":"email"}', '{"username":"pending"}'),
  ('10000000-0000-4000-8000-000000000004', 'google@example.test', now(), '{"provider":"google"}', '{"username":"learner_one"}');

select is((select count(*) from profiles where user_id between '10000000-0000-4000-8000-000000000001'
  and '10000000-0000-4000-8000-000000000004'), 4::bigint, 'signup creates email and OAuth profiles');
select is((select username from profiles where user_id = '10000000-0000-4000-8000-000000000001'), 'learner_one', 'signup normalizes username');
select is((select username from profiles where user_id = '10000000-0000-4000-8000-000000000004'), null, 'OAuth cannot reserve a username via provider metadata');
select throws_ok($$insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000005', 'duplicate@example.test', '{"provider":"email"}', '{"username":"LEARNER_ONE"}')$$,
  '23505', null, 'case-insensitive duplicate aborts signup');
select throws_ok($$insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000006', 'invalid@example.test', '{"provider":"email"}', '{"username":"ab"}')$$,
  '23514', null, 'invalid username aborts signup');
select throws_ok($$insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000006', 'invalid@example.test', '{"provider":"email"}', '{}')$$,
  '23514', null, 'email signup requires a username');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
update profiles set current_level = 'n3';
select is((select current_level from profiles), 'n3', 'owner can change current level');
select throws_ok($$update profiles set username = 'new_name'$$, '42501', null, 'username is not writable after signup');
select throws_ok($$insert into card_status (user_id, item_id, level, known, client_updated_at) values
  ('10000000-0000-4000-8000-000000000002', 'spoof', 'n4', true, now())$$, '42501', null, 'cannot write another user');
select throws_ok($$insert into card_status (user_id, item_id, level, known, client_updated_at, server_updated_at) values
  (auth.uid(), 'spoof-clock', 'n4', true, now(), '2100-01-01')$$, '42501', null, 'cannot set server cursor');
select throws_ok($$insert into card_status (user_id, item_id, level, known, client_updated_at) values
  (auth.uid(), repeat('x', 129), 'n4', true, now())$$, '23514', null, 'rejects a 129-character id');
select throws_ok($$insert into grammar_learned (user_id, item_id, level, learned, client_updated_at) values
  (auth.uid(), '', 'n4', true, now())$$, '23514', null, 'rejects an empty id');
select throws_ok($$insert into grammar_learned (user_id, item_id, level, learned, client_updated_at) values
  (auth.uid(), 'grammar-1', 'n6', true, now())$$, '23514', null, 'rejects an invalid level');
select throws_ok($$insert into grammar_learned (user_id, item_id, level, learned, client_updated_at) values
  (auth.uid(), 'grammar-1', 'n4', true, 'infinity')$$, '23514', null, 'rejects a nonfinite timestamp');
select throws_ok($$insert into grammar_learned (user_id, item_id, level, learned, client_updated_at) values
  (auth.uid(), 'grammar-1', 'n4', true, '10000-01-01 00:00:00+00')$$, '23514', null, 'rejects timestamps outside the four-digit wire format');

insert into card_status (user_id, item_id, level, known, client_updated_at) values
  (auth.uid(), 'card-1', 'n4', true, '2025-01-02');
insert into grammar_learned (user_id, item_id, level, learned, client_updated_at) values
  (auth.uid(), 'grammar-1', 'n4', true, '2025-01-02');
select set_config('test.card_cursor', (select server_updated_at::text from card_status), true);
select set_config('test.grammar_cursor', (select server_updated_at::text from grammar_learned), true);
insert into card_status (user_id, item_id, level, known, client_updated_at) values
  (auth.uid(), 'card-1', 'n4', false, '2025-01-01') on conflict (user_id, level, item_id) do update set
  user_id = excluded.user_id, item_id = excluded.item_id, level = excluded.level,
  known = excluded.known, client_updated_at = excluded.client_updated_at;
update grammar_learned set learned = false where item_id = 'grammar-1';
select ok((select known and server_updated_at = current_setting('test.card_cursor')::timestamptz from card_status), 'older upsert cannot overwrite or advance the card cursor');
select ok((select learned and server_updated_at = current_setting('test.grammar_cursor')::timestamptz from grammar_learned), 'equal timestamp cannot overwrite or advance the grammar cursor');
update card_status set known = false, client_updated_at = '2025-01-03' where item_id = 'card-1';
insert into grammar_learned (user_id, item_id, level, learned, client_updated_at) values
  (auth.uid(), 'grammar-1', 'n4', false, '2025-01-03') on conflict (user_id, level, item_id) do update set
  learned = excluded.learned, client_updated_at = excluded.client_updated_at;
select ok((select not known and server_updated_at > current_setting('test.card_cursor')::timestamptz from card_status), 'newer card update advances the cursor');
select ok((select not learned and server_updated_at > current_setting('test.grammar_cursor')::timestamptz from grammar_learned), 'newer unmark retains the row and advances the cursor');
select throws_ok($$update card_status set item_id = 'other-card', client_updated_at = '2025-01-04'$$, '23514', null, 'state identity is immutable');
insert into card_status (user_id, item_id, level, known, client_updated_at) values
  (auth.uid(), 'card-2', 'n4', true, now()), (auth.uid(), 'card-3', 'n4', true, now());
select is((select count(distinct server_updated_at) from card_status), 3::bigint, 'bulk writes get a distinct cursor per row');

select lives_ok($$insert into card_status (user_id, item_id, level, known, client_updated_at) values
  (auth.uid(), 'card-1', 'n3', true, '2025-01-01')$$, 'same card ID can be stored in another level');
select lives_ok($$insert into grammar_learned (user_id, item_id, level, learned, client_updated_at) values
  (auth.uid(), 'grammar-1', 'n3', true, '2025-01-01')$$, 'same grammar ID can be stored in another level');
insert into card_status (user_id, item_id, level, known, client_updated_at) values
  (auth.uid(), 'card-1', 'n4', true, '2025-01-02') on conflict (user_id, level, item_id) do update set
  known = excluded.known, client_updated_at = excluded.client_updated_at;
insert into grammar_learned (user_id, item_id, level, learned, client_updated_at) values
  (auth.uid(), 'grammar-1', 'n3', true, '2025-01-02') on conflict (user_id, level, item_id) do update set
  learned = excluded.learned, client_updated_at = excluded.client_updated_at;
select is((select array_agg(known order by level) from card_status where item_id = 'card-1'),
  array[true, false], 'stale N4 card update does not change either level');
select is((select array_agg(learned order by level) from grammar_learned where item_id = 'grammar-1'),
  array[true, false], 'N3 grammar update leaves N4 unchanged');
select is((select client_updated_at from grammar_learned where item_id = 'grammar-1' and level = 'n3'),
  '2025-01-02'::timestamptz, 'N3 update can win despite a newer N4 timestamp');
select throws_ok($$update card_status set level = 'n2', client_updated_at = '2025-01-04' where level = 'n3'$$,
  '23514', null, 'state cannot be moved to a different level');

insert into kanji_quiz_attempts (id, user_id, level, mode, score, total, wrong_item_ids, client_updated_at) values
  ('20000000-0000-4000-8000-000000000001', auth.uid(), 'n4', 'single', 0, 1, '{kanji-1}', now());
select set_config('test.kanji_cursor', (select server_updated_at::text from kanji_quiz_attempts), true);
insert into kanji_quiz_attempts (id, user_id, level, mode, score, total, wrong_item_ids, client_updated_at) values
  ('20000000-0000-4000-8000-000000000001', auth.uid(), 'n4', 'mixed', 1, 1, '{}', now()) on conflict (id) do nothing;
select is((select count(*) from kanji_quiz_attempts), 1::bigint, 'retrying the UUID does not duplicate an attempt');
select ok((select mode = 'single' and server_updated_at = current_setting('test.kanji_cursor')::timestamptz from kanji_quiz_attempts), 'UUID retry cannot change attempt contents or cursor');
insert into reading_attempts (id, user_id, level, item_id, score, total, client_updated_at) values
  ('20000000-0000-4000-8000-000000000002', auth.uid(), 'n4', 'passage-1', 1, 1, now());
select throws_ok($$update reading_attempts set score = 0$$, '42501', null, 'attempts cannot be updated');
select throws_ok($$delete from kanji_quiz_attempts$$, '42501', null, 'attempts cannot be deleted');
select throws_ok($$insert into reading_attempts (id, user_id, level, item_id, score, total, client_updated_at) values
  ('20000000-0000-4000-8000-000000000003', auth.uid(), 'n4', 'passage-1', 2, 1, now())$$, '23514', null, 'rejects score above total');
select throws_ok($$insert into reading_attempts (id, user_id, level, item_id, score, total, client_updated_at) values
  ('20000000-0000-4000-8000-000000000003', auth.uid(), 'n4', 'passage-1', -1, 1, now())$$, '23514', null, 'rejects negative score');
select throws_ok($$insert into reading_attempts (id, user_id, level, item_id, score, total, client_updated_at) values
  ('20000000-0000-4000-8000-000000000003', auth.uid(), 'n4', 'passage-1', 0, 1001, now())$$, '23514', null, 'rejects total above 1000');
select throws_ok($$insert into reading_attempts (id, user_id, level, item_id, score, total, client_updated_at) values
  ('20000000-0000-4000-8000-000000000003', auth.uid(), 'n4', 'passage-1', 0, 0, now())$$, '23514', null, 'rejects zero total');
select throws_ok($$insert into kanji_quiz_attempts (id, user_id, level, mode, score, total, wrong_item_ids, client_updated_at) values
  ('20000000-0000-4000-8000-000000000003', auth.uid(), 'n4', 'mixed', 0, 1, '{aa,bb}', now())$$,
  '23514', null, 'rejects more wrong ids than questions');
select throws_ok($$insert into kanji_quiz_attempts (id, user_id, level, mode, score, total, wrong_item_ids, client_updated_at) values
  ('20000000-0000-4000-8000-000000000003', auth.uid(), 'n4', 'mixed', 0, 1, array[repeat('x', 129)], now())$$,
  '23514', null, 'rejects invalid wrong item ids');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*) from profiles), 1::bigint, 'only own profile is visible');
select is((select (select count(*) from card_status) + (select count(*) from grammar_learned) +
  (select count(*) from kanji_quiz_attempts) + (select count(*) from reading_attempts)), 0::bigint, 'cannot read any other user progress');
update card_status set known = false, client_updated_at = now();
select is((select count(*) from card_status), 0::bigint, 'cross-user update changes no rows');
select throws_ok($$select * from resolve_username_login('learner_one')$$, '42501', null, 'clients cannot resolve usernames');
insert into reading_attempts (id, user_id, level, item_id, score, total, client_updated_at) values
  ('20000000-0000-4000-8000-000000000003', auth.uid(), 'n4', 'passage-1', 1, 1, now());

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*) from profiles), 0::bigint, 'unconfirmed user cannot read profiles');
select throws_ok($$insert into grammar_learned (user_id, item_id, level, learned, client_updated_at) values
  (auth.uid(), 'grammar-1', 'n4', true, now())$$, '42501', null, 'unconfirmed user cannot sync');
set local role anon;
select throws_ok($$select * from reading_attempts$$, '42501', null, 'anon role cannot read progress');
select throws_ok($$select * from resolve_username_login('learner_one')$$, '42501', null, 'anon role cannot resolve usernames');

reset role;
update jlpt_private.login_rate_limits set window_start = now() - interval '10 minutes' where bucket = '';
set local role service_role;
select ok((select allowed and user_id is null and email is null from resolve_username_login('pending')), 'unconfirmed username cannot resolve');

reset role;
update auth.users set email_confirmed_at = now() where id = '10000000-0000-4000-8000-000000000003';
set local role authenticated;
select lives_ok($$insert into grammar_learned (user_id, item_id, level, learned, client_updated_at) values
  (auth.uid(), 'grammar-1', 'n4', true, now())$$, 'confirming email unlocks sync without waiting for a new JWT');
set local role service_role;
select ok((select allowed and user_id = '10000000-0000-4000-8000-000000000001' and email = 'first@example.test'
  from resolve_username_login('learner_one')), 'service role can resolve a confirmed username and its account ID');
select ok((select allowed and user_id is null and email is null from resolve_username_login('unknown')), 'unknown names consume quota without resolving');
select is((select count(*) from generate_series(1, 10) as attempt cross join lateral
  resolve_username_login(case when attempt > 0 then 'unknown' else 'unused' end) where allowed),
  9::bigint, 'username limit denies requests after ten attempts');
select is((select count(*) from generate_series(1, 115) as attempt cross join lateral
  resolve_username_login('other_' || attempt) where allowed), 108::bigint, 'global limit caps requests across distinct usernames');

reset role;
update jlpt_private.login_rate_limits set window_start = now() - interval '10 minutes' where bucket = '';
set local role service_role;
select ok((select allowed from resolve_username_login('unknown')), 'both quotas reset in a new window');

reset role;
delete from auth.users where id = '10000000-0000-4000-8000-000000000001';
select is((select count(*) from profiles where user_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint, 'auth deletion cascades to the profile');
select is((select count(*) from card_status where user_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint, 'auth deletion cascades to card state');
select is((select count(*) from grammar_learned where user_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint, 'auth deletion cascades to grammar state');
select is((select count(*) from grammar_learned where user_id = '10000000-0000-4000-8000-000000000003'),
  1::bigint, 'auth deletion preserves another user grammar state');
select is((select count(*) from kanji_quiz_attempts where user_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint, 'auth deletion cascades to kanji attempts');
select is((select count(*) from reading_attempts where user_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint, 'auth deletion cascades to reading attempts');
select is((select count(*) from reading_attempts where user_id = '10000000-0000-4000-8000-000000000002'),
  1::bigint, 'auth deletion preserves another user reading attempts');
select is((select count(*) from jlpt_private.progress_cursors where user_id = '10000000-0000-4000-8000-000000000001'),
  0::bigint, 'auth deletion cascades to private cursors');

select * from finish();
rollback;
