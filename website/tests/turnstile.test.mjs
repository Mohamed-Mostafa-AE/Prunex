import assert from "node:assert/strict";
import { requestTurnstileToken } from "../src/turnstile.js";

assert.equal(
  await requestTurnstileToken({ siteKey: "configured-public-key", required: false }),
  null,
  "A configured site key must not show a challenge when guest Turnstile is disabled."
);
await assert.rejects(
  requestTurnstileToken({ required: true }),
  /Turnstile site key is not configured/
);

console.log("Guest Turnstile: disabled by default; explicit opt-in is enforced.");
