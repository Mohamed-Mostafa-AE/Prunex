# Owner account linking and migration verification

## Why this must happen in the existing guest browser

The live Supabase project currently has 11 anonymous users and no email-confirmed users. The 35 legacy games are divided evenly across five distinct guest user IDs (7 each); three reviews also exist. The system cannot infer which guest archive belongs to the project owner.

The Prunex browser flow links the current anonymous Supabase session to an email using `supabase.auth.updateUser({ email }, { emailRedirectTo })`. This preserves the current guest identity and its records; it is not the same as creating a new account or signing into someone else's account.

## Your action

1. Open the current review site in the exact browser profile/device where your own Prunex guest games were created or saved: https://prunex-review.vercel.app/
2. Open **Play**, scroll to **Game archive**, then expand **Account & Data**.
3. Confirm the archive shown is yours before continuing. Do not use the flow from a fresh browser profile with no existing guest games.
4. In **Link this guest archive to the verified owner email**, enter the exact email address configured in the Vercel `PRUNEX_OWNER_EMAIL` setting. Do not use an alternate address.
5. Submit, open the verification email, and complete its link in the same browser profile. Return to the review site.
6. Open **Account & password** in the top bar. Once the page reports that the email is verified, enter a new password (at least 12 characters) and confirm it.
7. Password setup is deliberately available only after email verification. Re-enter the password after you return; Prunex does not save it in browser storage.
8. Confirm the account is no longer shown as a guest and that your own archived games remain visible. Do not use **Delete account**, sign into a different account, or clear site data during this process.

If the page reports a redirect-URL error, stop and send the exact error text. The Supabase Auth URL configuration must allow the preview origin. Do not try to work around it by creating another account.

## What to send back for verification

Send only:
- confirmation that you linked the intended guest session;
- whether the verification link completed successfully;
- whether the page shows the expected games after return;
- the account UUID shown by the app only if the UI explicitly displays it (do not copy access tokens, session cookies, or magic-link URLs).

Never send the email magic-link URL, access token, refresh token, browser storage export, or a screenshot containing those secrets.

## What I will verify after you confirm

Using the Supabase Auth database and the owner-scoped API, I will verify that the selected user is non-anonymous, the email is confirmed and matches the existing owner allowlist, then check the game/review counts scoped to that exact user. Only that user's rows will be imported to Neon. The remaining guest IDs will be left untouched.

I will then compare source and destination counts, verify the migration-state idempotency record, repeat the read path to ensure the import does not duplicate rows, and test archive list/review access. The other guests' archives will not be modified.
