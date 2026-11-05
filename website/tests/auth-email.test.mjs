import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8");
const emailChange = readFileSync(new URL("../../supabase/templates/prunex-email-change.html", import.meta.url), "utf8");
const recovery = readFileSync(new URL("../../supabase/templates/prunex-password-recovery.html", import.meta.url), "utf8");
const changed = readFileSync(new URL("../../supabase/templates/prunex-password-changed.html", import.meta.url), "utf8");

for (const entry of [
  "[auth.email.template.email_change]",
  "[auth.email.template.recovery]",
  "[auth.email.notification.password_changed]",
  "enabled = true",
  "prunex-email-change.html",
  "prunex-password-recovery.html",
  "prunex-password-changed.html"
]) assert.ok(config.includes(entry), "Missing Auth template configuration: " + entry);

assert.ok(emailChange.includes("{{ .ConfirmationURL }}"), "Email-change template must use the provider-generated confirmation URL.");
assert.ok(emailChange.includes("same browser profile"), "Email-linking template must protect the guest-session workflow.");
assert.ok(emailChange.includes("not moved or merged"), "Email-linking template must not imply that archives are merged.");
assert.ok(recovery.includes("{{ .ConfirmationURL }}"), "Password recovery must use the provider-generated confirmation URL.");
assert.ok(recovery.includes("saved games remain associated"), "Recovery copy must reassure users that archive ownership is unchanged.");
assert.ok(changed.includes("{{ .SiteURL }}"), "Password-change notification must link to the configured site URL.");
assert.ok(changed.includes("mohamedhussam09@gmail.com"), "Password-change notification must include the published support contact.");
for (const template of [emailChange, recovery, changed]) {
  assert.ok(!/service_role|secret_key|password\s*=|Bearer\s+[A-Za-z0-9._-]{20,}/i.test(template),
    "Email templates must not contain credentials or embedded secrets.");
}

const websiteMarkup = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const websiteLogic = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const archiveLogic = readFileSync(new URL("../src/game-database.js", import.meta.url), "utf8");
assert.equal((websiteMarkup.match(/id="delete-account-form"/g) || []).length, 1,
  "There must be exactly one account-deletion form.");
assert.ok(websiteMarkup.includes("Delete your Prunex account"),
  "The destructive action must be account closure, not individual record deletion.");
assert.doesNotMatch(websiteMarkup, /delete[- ](?:game|record)|Delete (?:game|record)/i,
  "The website must not expose per-game or per-record deletion.");
assert.ok(websiteLogic.includes("gameArchive.deleteAccount()"),
  "The account-deletion control must call the account-deletion operation.");
assert.doesNotMatch(websiteLogic, /localStorage\.setItem\([^)]*password/i,
  "The UI must not persist passwords in localStorage.");
assert.doesNotMatch(websiteLogic, /sessionStorage\.setItem\([^)]*password/i,
  "The UI must not persist passwords in sessionStorage.");
assert.doesNotMatch(archiveLogic, /localStorage\.setItem\([^)]*password/i,
  "The archive client must not persist passwords in localStorage.");
assert.doesNotMatch(archiveLogic, /indexedDB[^;]*password/i,
  "Passwords must not be written to the game archive database.");
console.log("Account UI/security: account-only deletion, password visibility, and password storage hygiene passed.");
