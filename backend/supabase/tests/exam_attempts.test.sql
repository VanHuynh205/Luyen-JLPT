begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values
  ('30000000-0000-4000-8000-000000000001', 'exam_a@example.test', now(), '{"provider":"email"}', '{"username":"exam_user_a"}'),
  ('30000000-0000-4000-8000-000000000002', 'exam_b@example.test', now(), '{"provider":"email"}', '{"username":"exam_user_b"}'),
  ('30000000-0000-4000-8000-000000000003', 'exam_unconfirmed@example.test', null, '{"provider":"email"}', '{"username":"exam_pending"}');

-- SEC-T05 (1): Unconfirmed email user INSERT is rejected with 42501
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000003', true);
select throws_ok(
  $$insert into exam_attempts (
      id, user_id, level, exam_id, status, attempt_number,
      total_score, total_questions, sections, answers,
      started_at, completed_at, client_updated_at
    ) values (
      '40000000-0000-4000-8000-000000000001', auth.uid(), 'n4', 'n4-2024-12', 'in_progress', 1,
      0, 85,
      '[{"key":"vocab","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}]'::jsonb,
      '{}'::jsonb,
      '2026-11-27T07:45:00Z', null, '2026-11-27T07:45:00Z'
    )$$,
  '42501',
  null,
  'SEC-T05(1): unconfirmed email user cannot insert exam_attempts'
);

-- Confirmed User A inserts valid in_progress attempt with section 1 submitted
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$insert into exam_attempts (
      id, user_id, level, exam_id, status, attempt_number,
      total_score, total_questions, sections, answers,
      started_at, completed_at, client_updated_at
    ) values (
      '40000000-0000-4000-8000-000000000010', auth.uid(), 'n4', 'n4-2024-12', 'in_progress', 1,
      24, 85,
      '[
        {"key":"vocab","status":"submitted","score":24,"total":28,"elapsedSeconds":900,"submittedAt":"2026-11-27T08:00:00Z"},
        {"key":"grammar_reading","status":"pending","score":0,"total":29,"elapsedSeconds":0,"submittedAt":null},
        {"key":"listening","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}
      ]'::jsonb,
      '{"q-1":2,"q-2":0}'::jsonb,
      '2026-11-27T07:45:00Z', null, '2026-11-27T08:00:00Z'
    )$$,
  'confirmed user A can insert an in_progress exam attempt'
);

-- Cannot directly write server_updated_at or DELETE
select throws_ok(
  $$insert into exam_attempts (
      id, user_id, level, exam_id, status, attempt_number,
      total_score, total_questions, sections, answers,
      started_at, completed_at, client_updated_at, server_updated_at
    ) values (
      '40000000-0000-4000-8000-000000000011', auth.uid(), 'n4', 'n4-2024-07', 'in_progress', 1,
      0, 85,
      '[{"key":"vocab","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}]'::jsonb,
      '{}'::jsonb,
      '2026-11-27T07:45:00Z', null, '2026-11-27T07:45:00Z', '2100-01-01T00:00:00Z'
    )$$,
  '42501',
  null,
  'cannot set server_updated_at directly'
);
select throws_ok(
  $$delete from exam_attempts$$,
  '42501',
  null,
  'cannot delete exam_attempts'
);

-- SEC-T05 (2): User B SELECT returns 0 rows and cross-user UPDATE affects 0 rows
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select is(
  (select count(*) from exam_attempts),
  0::bigint,
  'SEC-T05(2): user B sees zero exam attempts belonging to user A'
);
update exam_attempts
  set total_score = 85, client_updated_at = '2026-11-27T08:01:00Z'
  where id = '40000000-0000-4000-8000-000000000010';
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select is(
  (select total_score from exam_attempts where id = '40000000-0000-4000-8000-000000000010'),
  24,
  'SEC-T05(2): user B cross-user update did not alter user A attempt'
);

-- SEC-T05 (3): Regressing section 1 from submitted -> pending is rejected with 23514
select throws_ok(
  $$update exam_attempts set
      total_score = 0,
      sections = '[
        {"key":"vocab","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null},
        {"key":"grammar_reading","status":"pending","score":0,"total":29,"elapsedSeconds":0,"submittedAt":null},
        {"key":"listening","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}
      ]'::jsonb,
      answers = '{}'::jsonb,
      client_updated_at = '2026-11-27T08:05:00Z'
    where id = '40000000-0000-4000-8000-000000000010'$$,
  '23514',
  'Exam section status cannot regress',
  'SEC-T05(3): section regression submitted -> pending is rejected'
);

-- Also reject changing score of an already submitted section
select throws_ok(
  $$update exam_attempts set
      total_score = 28,
      sections = '[
        {"key":"vocab","status":"submitted","score":28,"total":28,"elapsedSeconds":900,"submittedAt":"2026-11-27T08:00:00Z"},
        {"key":"grammar_reading","status":"pending","score":0,"total":29,"elapsedSeconds":0,"submittedAt":null},
        {"key":"listening","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}
      ]'::jsonb,
      client_updated_at = '2026-11-27T08:06:00Z'
    where id = '40000000-0000-4000-8000-000000000010'$$,
  '23514',
  'Exam section status cannot regress',
  'SEC-T05(3): altering locked section score is rejected'
);

-- SEC-T05 (5a): Second parallel in_progress attempt for same (user_id, level, exam_id) blocked with 23505
select throws_ok(
  $$insert into exam_attempts (
      id, user_id, level, exam_id, status, attempt_number,
      total_score, total_questions, sections, answers,
      started_at, completed_at, client_updated_at
    ) values (
      '40000000-0000-4000-8000-000000000020', auth.uid(), 'n4', 'n4-2024-12', 'in_progress', 2,
      0, 85,
      '[
        {"key":"vocab","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null},
        {"key":"grammar_reading","status":"pending","score":0,"total":29,"elapsedSeconds":0,"submittedAt":null},
        {"key":"listening","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}
      ]'::jsonb,
      '{}'::jsonb,
      '2026-11-27T08:10:00Z', null, '2026-11-27T08:10:00Z'
    )$$,
  '23505',
  null,
  'SEC-T05(5): second parallel in_progress attempt for same exam is rejected'
);

-- Complete attempt #1 monotonically (via upsert on conflict id)
select set_config(
  'test.attempt1_cursor',
  (select server_updated_at::text from exam_attempts where id = '40000000-0000-4000-8000-000000000010'),
  true
);
select lives_ok(
  $$insert into exam_attempts (
      id, user_id, level, exam_id, status, attempt_number,
      total_score, total_questions, sections, answers,
      started_at, completed_at, client_updated_at
    ) values (
      '40000000-0000-4000-8000-000000000010', auth.uid(), 'n4', 'n4-2024-12', 'completed', 1,
      50, 85,
      '[
        {"key":"vocab","status":"submitted","score":24,"total":28,"elapsedSeconds":900,"submittedAt":"2026-11-27T08:00:00Z"},
        {"key":"grammar_reading","status":"submitted","score":26,"total":29,"elapsedSeconds":2400,"submittedAt":"2026-11-27T08:40:00Z"},
        {"key":"listening","status":"skipped","score":0,"total":28,"elapsedSeconds":0,"submittedAt":"2026-11-27T08:41:00Z"}
      ]'::jsonb,
      '{"q-1":2,"q-2":0,"q-30":1}'::jsonb,
      '2026-11-27T07:45:00Z', '2026-11-27T08:41:00Z', '2026-11-27T08:41:00Z'
    )
    on conflict (id) do update set
      id = excluded.id,
      user_id = excluded.user_id,
      level = excluded.level,
      exam_id = excluded.exam_id,
      status = excluded.status,
      attempt_number = excluded.attempt_number,
      total_score = excluded.total_score,
      total_questions = excluded.total_questions,
      sections = excluded.sections,
      answers = excluded.answers,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      client_updated_at = excluded.client_updated_at$$,
  'monotonic upsert transitions attempt 1 to completed'
);
select ok(
  (select server_updated_at > current_setting('test.attempt1_cursor')::timestamptz
   from exam_attempts where id = '40000000-0000-4000-8000-000000000010'),
  'completing attempt advances server_updated_at cursor'
);

-- SEC-T05 (4): Updating a completed attempt is rejected with 23514
select throws_ok(
  $$update exam_attempts set
      total_score = 85,
      client_updated_at = '2026-11-27T09:00:00Z'
    where id = '40000000-0000-4000-8000-000000000010'$$,
  '23514',
  'Completed exam attempt is immutable',
  'SEC-T05(4): completed exam attempt cannot be modified'
);

-- SEC-T05 (5b): After attempt #1 is completed, inserting attempt_number = 2 succeeds
select lives_ok(
  $$insert into exam_attempts (
      id, user_id, level, exam_id, status, attempt_number,
      total_score, total_questions, sections, answers,
      started_at, completed_at, client_updated_at
    ) values (
      '40000000-0000-4000-8000-000000000021', auth.uid(), 'n4', 'n4-2024-12', 'in_progress', 2,
      0, 85,
      '[
        {"key":"vocab","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null},
        {"key":"grammar_reading","status":"pending","score":0,"total":29,"elapsedSeconds":0,"submittedAt":null},
        {"key":"listening","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}
      ]'::jsonb,
      '{}'::jsonb,
      '2026-11-27T09:10:00Z', null, '2026-11-27T09:10:00Z'
    )$$,
  'SEC-T05(5): attempt_number = 2 succeeds after attempt 1 is completed'
);

-- SEC-T05 (6): Oversized answers (> 65536B), invalid choice = 4, prototype key, and total_score > total_questions rejected with 23514
select throws_ok(
  $$insert into exam_attempts (
      id, user_id, level, exam_id, status, attempt_number,
      total_score, total_questions, sections, answers,
      started_at, completed_at, client_updated_at
    ) values (
      '40000000-0000-4000-8000-000000000030', auth.uid(), 'n4', 'n4-2023-12', 'in_progress', 1,
      0, 85,
      '[{"key":"vocab","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}]'::jsonb,
      (select jsonb_object_agg('question-key-padding-' || g::text, g % 4) from generate_series(1, 3000) as g),
      '2026-11-27T09:15:00Z', null, '2026-11-27T09:15:00Z'
    )$$,
  '23514',
  null,
  'SEC-T05(6): rejects answers JSON larger than 65536 bytes'
);

select throws_ok(
  $$insert into exam_attempts (
      id, user_id, level, exam_id, status, attempt_number,
      total_score, total_questions, sections, answers,
      started_at, completed_at, client_updated_at
    ) values (
      '40000000-0000-4000-8000-000000000031', auth.uid(), 'n4', 'n4-2023-12', 'in_progress', 1,
      0, 85,
      '[{"key":"vocab","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}]'::jsonb,
      '{"q-1":4}'::jsonb,
      '2026-11-27T09:15:00Z', null, '2026-11-27T09:15:00Z'
    )$$,
  '23514',
  null,
  'SEC-T05(6): rejects answer choice outside 0..3'
);

select throws_ok(
  $$insert into exam_attempts (
      id, user_id, level, exam_id, status, attempt_number,
      total_score, total_questions, sections, answers,
      started_at, completed_at, client_updated_at
    ) values (
      '40000000-0000-4000-8000-000000000032', auth.uid(), 'n4', 'n4-2023-12', 'in_progress', 1,
      0, 85,
      '[{"key":"vocab","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}]'::jsonb,
      '{"__proto__":1}'::jsonb,
      '2026-11-27T09:15:00Z', null, '2026-11-27T09:15:00Z'
    )$$,
  '23514',
  null,
  'SEC-T05(6): rejects __proto__ key in answers'
);

select throws_ok(
  $$insert into exam_attempts (
      id, user_id, level, exam_id, status, attempt_number,
      total_score, total_questions, sections, answers,
      started_at, completed_at, client_updated_at
    ) values (
      '40000000-0000-4000-8000-000000000033', auth.uid(), 'n4', 'n4-2023-12', 'in_progress', 1,
      86, 85,
      '[{"key":"vocab","status":"pending","score":0,"total":28,"elapsedSeconds":0,"submittedAt":null}]'::jsonb,
      '{}'::jsonb,
      '2026-11-27T09:15:00Z', null, '2026-11-27T09:15:00Z'
    )$$,
  '23514',
  null,
  'SEC-T05(6): rejects total_score greater than total_questions'
);

-- Cascade deletion check
reset role;
delete from auth.users where id = '30000000-0000-4000-8000-000000000001';
select is(
  (select count(*) from exam_attempts where user_id = '30000000-0000-4000-8000-000000000001'),
  0::bigint,
  'auth user deletion cascades to exam_attempts'
);

select * from finish();
rollback;
