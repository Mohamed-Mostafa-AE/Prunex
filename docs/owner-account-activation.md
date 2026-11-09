# Legacy archive ownership and migration

## Identity model

A Prunex cloud archive belongs to the Supabase Auth user ID that created its records. The player's email address, display name, record count, or browser hostname is not a substitute for that identity.

Guest sessions are valid Auth identities. Games and reviews are scoped to the authenticated user's ID by row-level security. Email linking must update the current guest identity; it must not create a replacement account and then attempt to infer or merge ownership.

## Guest-to-password conversion

The supported identity transition is:

1. Start with the existing anonymous Auth session that owns the intended archive.
2. Enable manual identity linking in the hosted Supabase Auth configuration.
3. Update the email on that same session using `supabase.auth.updateUser({ email })`.
4. Complete the provider confirmation flow in the browser session that initiated the request.
5. After the email is confirmed, set the password on the current session with `supabase.auth.updateUser({ password })`.

Supabase can continue reporting `is_anonymous: true` after email confirmation and before password creation. The confirmed email makes the existing session eligible for password setup; setting the password completes the conversion. The Auth user ID must remain unchanged throughout.

Signing in to an unrelated account does not move, merge, or recover a separate guest archive. Browser-local IndexedDB data is independent of the cloud archive and must not be removed as part of an identity-linking operation.

## Import authorization

The server must verify every condition before importing legacy rows:

- The supplied Supabase access token is valid.
- The authenticated email is confirmed.
- The confirmed email matches the server-only `PRUNEX_OWNER_EMAIL` allowlist.
- The source records are filtered by the exact authenticated Supabase user ID.
- The import operation is idempotent and records source counts in migration state.
- No other guest identity is reassigned, combined, or deleted.

The source and destination count checks must include games, reviews, and position-memory records. A successful import is not established by an HTTP success response alone; it requires exact counts, review/game foreign-key integrity, owner scoping, and a retry that does not duplicate rows.

## Security requirements

Never place access tokens, refresh tokens, session cookies, magic-link URLs, passwords, browser-storage exports, or private recovery keys in repository files, screenshots, issues, or pull requests.

Keep identity verification, import authorization, and migration audit records server-side. Do not log session secrets or infer ownership from anonymous-account counts.
