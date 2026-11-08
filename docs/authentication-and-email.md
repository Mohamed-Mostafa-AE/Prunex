# Prunex account passwords and authentication email

## Guest archive linking

Prunex starts a local browser archive and, when Supabase is configured, an anonymous Supabase session. The guest session must be linked in the same browser profile that contains the games.

The supported sequence is deliberately two-stage:

1. Call `auth.updateUser({ email }, { emailRedirectTo })` for the current anonymous user.
2. The user confirms the email using the provider-generated `{{ .ConfirmationURL }}` link, in the same browser profile.
3. The user returns to Prunex and sets a password with `auth.updateUser({ password })`.

Supabase can continue reporting `is_anonymous: true` after the email is confirmed and before the password is added. This is expected: the verified email makes the session eligible for password setup, and adding the password completes conversion to a permanent identity. Do not gate the password form on `is_anonymous === false`; gate it on an authenticated session plus a confirmed email address. The password is entered again after confirmation; it is not persisted in local storage, IndexedDB, URLs, or the archive.

The application and unit test explicitly verify that setting the password converts the same guest user ID rather than creating or merging another account.

Password sign-in uses `signInWithPassword` and never creates a new account. If the browser is still using a guest session, the UI warns that signing into another account does not merge or transfer the guest archive. Password recovery is an inline action in the sign-in form and uses the entered email with `resetPasswordForEmail`; the `PASSWORD_RECOVERY` event opens the password form. The sign-in error handler clears the entered password after an unsuccessful attempt and uses customer-facing messages rather than exposing provider error text.

The private Neon archive API independently checks that the authenticated email is confirmed and matches `PRUNEX_OWNER_EMAIL`. A valid Supabase account alone does not grant access to the owner's archive.

## Email templates

The repository includes HTML templates:

- `supabase/templates/prunex-email-change.html`
- `supabase/templates/prunex-password-recovery.html`
- `supabase/templates/prunex-password-changed.html`

Their local Supabase config sections are in `supabase/config.toml`. The repository-root `scripts/test-auth-email-templates.mjs` validates the provider URL variables, archive-preservation copy and template secret hygiene. Website tests cover account-only deletion, password storage hygiene and the inline account interface; `website/tests/account-messages.test.mjs` checks customer-facing error mapping.

## Hosted Supabase activation — required

A repository commit does not update the hosted Supabase Auth dashboard. For the live project:

1. Open **Authentication → Email Templates** and paste the matching HTML into **Change Email**, **Reset Password**, and **Password Changed** templates. Use the subjects from `supabase/config.toml`.
2. Open **Authentication → URL Configuration** and confirm the production Site URL and approved Redirect URLs. Add the preview origin only if preview authentication tests are explicitly intended.
3. Open **Authentication → Sign In / Providers → Email** and verify email/password sign-in and email confirmations are enabled. Confirm anonymous-user identity linking is supported by the project's current Auth settings.
4. Configure custom SMTP with a verified sender domain. Publish SPF and DKIM records, configure DMARC, and confirm provider reputation/deliverability. The built-in test mailer is not a production email-delivery guarantee.
5. Send real change-email, reset-password, and password-changed notification tests to controlled mailboxes. Verify URLs land on the correct site, links expire/reject reuse, and the browser session is preserved.
6. Do not announce the email system as production-ready until each message has been received and the end-to-end flows have passed.

The connected Supabase actions in this workspace expose project and documentation access, not hosted Auth template or SMTP settings. Therefore these template assets and code flows can be committed and CI-tested here, but hosted templates, SMTP, sender-domain DNS, and real mailbox delivery must be applied and verified in the Supabase/provider dashboards.

## Security properties covered in code

- Passwords have a 12-character minimum in the UI and client service. The hosted Supabase password policy must be checked separately so server-side rules are consistent.
- Password setup requires an authenticated session and a confirmed email. Supabase may still report `is_anonymous: true` between email confirmation and password creation; that verified guest session is eligible to set the password and retain its existing user ID.
- The UI never stores passwords in browser storage.
- Password sign-in does not create a user and warns before leaving a guest session.
- Password reset redirects to the current HTTPS origin.
- Cloud archive authorization remains server-side and owner-email scoped.
- Account closure remains the only destructive end-user account action. There is no per-game or per-record delete control.
