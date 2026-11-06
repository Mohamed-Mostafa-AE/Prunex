import assert from "node:assert/strict";
import { friendlyAccountError } from "../src/account-messages.js";

const cases = [
  [{ code: "invalid_credentials", message: "Invalid login credentials" }, "That email and password don't match. Try again."],
  [{ code: "email_not_confirmed", message: "Email not confirmed" }, "Verify your email before signing in."],
  [{ code: "user_already_exists", message: "User already registered" }, "An account already uses that email. Sign in to continue."],
  [{ code: "otp_expired", message: "Email link is expired" }, "That verification link has expired. Request a new one."],
  [{ code: "over_request_rate_limit", message: "Too many requests" }, "Too many attempts. Wait a little, then try again."],
  [{ code: "weak_password", message: "Password should be stronger" }, "Choose a stronger password and try again."],
  [{ message: "Redirect URL not allowed" }, "This account link isn't configured for this site. Contact support."],
  [{ message: "Failed to fetch" }, "Prunex couldn't reach the account service. Check your connection and try again."],
  [{ message: "Enter a valid email address." }, "Enter a valid email address."],
  [{ message: "Use at least 12 characters" }, "Choose a password with at least 12 characters."]
];

for (const [error, expected] of cases) {
  assert.equal(friendlyAccountError(error, "Fallback message"), expected);
}

assert.equal(
  friendlyAccountError({ message: "unrecognized provider internals" }, "Please try again."),
  "Please try again.",
  "Unknown provider errors must use the customer-facing fallback, not expose provider details."
);
assert.equal(
  friendlyAccountError(null, "Please try again."),
  "Please try again.",
  "Missing errors must use the customer-facing fallback."
);

console.log(`Account messages: ${cases.length + 2} user-friendly error cases passed.`);
