# Guest archive linking and migration

## Purpose

Prunex supports browser guest sessions so games can be saved before a player creates a recoverable sign-in identity. A guest archive belongs to the Supabase user ID created in that browser session. It cannot be identified reliably from the player's name, email address, or the number of saved games.

## Preserve the existing identity

The email-linking flow must start in the browser profile that contains the intended games:

1. Open the Prunex review site in the original browser profile.
2. Open **Account & password** from the top bar.
3. Confirm that the visible archive is the intended archive.
4. Enter the email authorised for private archive access and request verification.
5. Complete the email confirmation in the same browser profile.
6. Return to Prunex and set a password after the email is confirmed.
7. Confirm that the original games remain visible before closing the browser or changing accounts.

The flow calls `supabase.auth.updateUser({ email })` on the current anonymous identity. Supabase requires the email to be verified before a password can be added. Supabase may continue reporting `is_anonymous: true` between email verification and password creation; adding the password completes conversion of that same user identity. The user ID must remain unchanged.

Do not clear site data, sign out, or sign into a different account before the guest archive has been linked. Signing into an existing account does not merge another guest archive.

## Owner-scoped import checks

The server must verify all of the following before importing legacy rows:

- the Supabase access token is valid;
- the email is confirmed;
- the verified email matches the server-only `PRUNEX_OWNER_EMAIL` allowlist;
- the import is scoped to the authenticated Supabase user ID;
- migration state makes retries idempotent.

Games, reviews and private position-memory rows are imported only for that user ID. Other guest IDs must not be merged, reassigned, or deleted.

After import, compare source and destination counts for that user, verify the migration-state record, repeat the import to confirm idempotency, and test archive list/review access. Keep an audit record of the verified source identity and migration outcome without recording access tokens or session secrets.

## Security

Never request or store email magic-link URLs, access tokens, refresh tokens, session cookies, browser storage exports, or passwords in issue comments, pull requests, screenshots or repository files. Passwords are sent to Supabase Auth over HTTPS and are not part of game records.
