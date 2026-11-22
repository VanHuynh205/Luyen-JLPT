# Supabase local backend

From the repository root, with the Supabase CLI, Docker and Deno installed:

```sh
supabase start --workdir backend
supabase test db --workdir backend
deno test --no-config --no-lock --node-modules-dir=none backend/supabase/tests/functions.test.ts
```

Local email signup requires `options.data.username` and confirmation through the local mail inbox (`supabase status --workdir backend`). The frontend callback is `/tai-khoan`, including the CI origin `http://127.0.0.1:4174`. To test Google locally, enable its config section and supply `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` through the local environment. Do not commit credentials. The functions use the server-only keys injected by Supabase.

`POST resolve-login` takes `{ "username": "learner_one", "password": "…" }` and returns only `access_token` and `refresh_token` for `setSession`. Wrong credentials, unknown names, and unconfirmed accounts share the `invalid_credentials` response. Postgres allows 10 password grants per normalized username and 120 total per fixed five-minute window, including grants that fail. This is a shared budget; abuse can temporarily throttle legitimate sign-ins through this endpoint. Email login uses Supabase Auth directly. `POST delete-account` requires `Authorization: Bearer <access_token>` and `x-confirmed-owner: <user UUID>` captured at confirmation and returns `{ "deleted": true }` after hard deletion of the authenticated account. The gateway JWT check is disabled for these functions; `delete-account` validates the token against Auth before using the service role.

Upsert `card_status` and `grammar_learned` on `user_id,level,item_id`. The same item ID can have independent state in each level; only strictly newer `client_updated_at` values win within that key. Use UUID v4 and `ignoreDuplicates: true` on `id` for `kanji_quiz_attempts` and `reading_attempts`. Omit `server_updated_at` on writes. Pull each table independently with `server_updated_at > cursor` ordered ascending, and retain the full server timestamp string (including microseconds) as the next cursor. The server serializes progress writes from each user to keep cursor order consistent with commit order. LWW still depends on device clocks.
