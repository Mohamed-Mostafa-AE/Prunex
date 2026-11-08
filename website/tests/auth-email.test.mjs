import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

const accountStyles = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
assert.equal((websiteMarkup.match(/id="forgot-password-link"/g) || []).length, 1,
  "Forgot password must be an inline sign-in action.");
assert.doesNotMatch(websiteMarkup, /id="reset-password-form"|id="reset-password-email"/,
  "Password recovery must not create a separate form or email field.");
assert.ok(websiteLogic.includes("sendPasswordReset(emailInput.value)"),
  "Password recovery must use the email already entered for sign-in.");
assert.ok(accountStyles.includes("input:-webkit-autofill") && accountStyles.includes("input:autofill"),
  "Both vendor-prefixed and standard browser autofill states must be styled.");
assert.ok(accountStyles.includes("-webkit-text-fill-color:#f1f7ff") &&
  accountStyles.includes("-webkit-box-shadow:0 0 0 1000px #041326 inset"),
  "Autofilled account fields must retain readable text and the Prunex dark-field background.");
assert.ok(accountStyles.includes("grid-template-columns:minmax(0,1fr)"),
  "Narrow account panels must stack the email field and verification button.");
assert.ok(accountStyles.includes(".score-number") && accountStyles.includes("display: flex") &&
  accountStyles.includes(".score-primary") && accountStyles.includes(".score-secondary"),
  "Benchmark scores must use separate flex items rather than tightly tracked inline text.");
console.log("Account UI/security: account-only deletion, inline password recovery, autofill styling, responsive score layout, and password storage hygiene passed.");
