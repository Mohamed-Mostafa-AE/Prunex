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
console.log("Account UI/security: account-only deletion, password visibility, and password storage hygiene passed.");
