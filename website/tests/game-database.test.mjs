import assert from "node:assert/strict";
import { createGameArchive, isUsableMemory, rankSamples } from "../src/game-database.js";

function sample(moveUci, resultForMover, evalLossCp = 0, grade = "BEST", overrides = {}) {
  return {
    id: "test-game:1",
    positionKey: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w",
    sideToMove: "w",
    moveUci,
    san: "e4",
    resultForMover,
    evalLossCp,
    grade,
    createdAt: "2026-11-04T00:00:00.000Z",
    ...overrides
  };
}

const preferred = rankSamples([
  sample("e2e4", 1), sample("e2e4", 1),
  sample("d2d4", -1), sample("d2d4", -1)
]);
assert.equal(preferred?.moveUci, "e2e4", "losses must not be counted as draws");

const drawOnly = rankSamples([sample("g1f3", 0), sample("g1f3", 0)]);
assert.equal(drawOnly?.draws, 2, "draws must be counted separately");

const rejected = rankSamples([
  sample("a2a3", 1, 31, "BEST"),
  sample("h2h3", 1, 0, "BLUNDER")
]);
assert.equal(rejected, null, "poor-quality samples must not influence experience selection");

const evaluationBreaksTie = rankSamples([
  sample("c2c4", 1, 24), sample("c2c4", 0, 22),
  sample("e2e4", 1, 2), sample("e2e4", 0, 2)
]);
assert.equal(evaluationBreaksTie?.moveUci, "e2e4", "lower evaluation loss should improve ranking");

assert.equal(isUsableMemory(sample("e2e4", 1)), true);
assert.equal(isUsableMemory(sample("e2e4", 1, -1)), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 31)), false);
assert.equal(isUsableMemory(sample("e2e4", 0.5)), false);
assert.equal(isUsableMemory(sample("e2e4", 2)), false);
assert.equal(isUsableMemory(sample("z9e4", 1)), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "APEX")), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "BEST", { sideToMove: "x" })), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "BEST", { positionKey: "short" })), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "BEST", { san: "" })), false);
assert.equal(isUsableMemory(sample("e2e4", 1, 0, "BEST", { id: "" })), false);

const authRequests = [];
const archive = createGameArchive({
  url: "https://example.supabase.co",
  publishableKey: "sb_publishable_test",
  getRedirectTo: () => "https://prunex.example",
  clientFactory: (url, key, options) => {
    assert.equal(url, "https://example.supabase.co");
    assert.equal(key, "sb_publishable_test");
    assert.equal(options.auth.detectSessionInUrl, true);
    return {
      auth: {
        signInWithOtp: async request => {
          authRequests.push(request);
          return { error: null };
        }
      }
    };
  }
});
const recovery = await archive.sendRecoveryLink(" Player@Example.com ");
assert.deepEqual(recovery, { email: "player@example.com", verificationRequired: true });
assert.deepEqual(authRequests[0], {
  email: "player@example.com",
  options: {
    shouldCreateUser: false,
    emailRedirectTo: "https://prunex.example"
  }
}, "recovery must target the allowed site origin without creating another user");
await assert.rejects(() => archive.sendRecoveryLink("not-an-email"), /valid email/);
const insecureArchive = createGameArchive({
  url: "https://example.supabase.co",
  publishableKey: "sb_publishable_test",
  getRedirectTo: () => "http://prunex.example",
  clientFactory: () => ({ auth: { signInWithOtp: async () => ({ error: null }) } })
});
await assert.rejects(
  () => insecureArchive.sendRecoveryLink("player@example.com"),
  /secure HTTPS/
);
await assert.rejects(
  () => createGameArchive().sendRecoveryLink("player@example.com"),
  /not configured/
);


const passwordAuthCalls = [];
let passwordTestUser = {
  id: "guest-user",
  is_anonymous: true,
  email: null,
  email_confirmed_at: null,
  confirmed_at: null
};
const passwordArchive = createGameArchive({
  url: "https://example.supabase.co",
  publishableKey: "sb_publishable_test",
  getRedirectTo: () => "https://prunex.example",
  clientFactory: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({ data: { session: { user: passwordTestUser } }, error: null }),
      getUser: async () => ({ data: { user: passwordTestUser }, error: null }),
      updateUser: async attributes => {
        passwordAuthCalls.push({ method: "updateUser", attributes });
        passwordTestUser = { ...passwordTestUser, ...attributes };
        return { data: { user: passwordTestUser }, error: null };
      },
      signInWithPassword: async credentials => {
        passwordAuthCalls.push({ method: "signInWithPassword", credentials });
        passwordTestUser = {
          id: "verified-user",
          is_anonymous: false,
          email: credentials.email,
          email_confirmed_at: "2026-11-05T00:00:00.000Z"
        };
        return { data: { user: passwordTestUser, session: { user: passwordTestUser } }, error: null };
      },
      resetPasswordForEmail: async (email, options) => {
        passwordAuthCalls.push({ method: "resetPasswordForEmail", email, options });
        return { error: null };
      }
    }
  })
});
const anonymousState = await passwordArchive.getAccountState();
assert.equal(anonymousState.isAnonymous, true);
assert.equal(anonymousState.emailConfirmed, false);
await assert.rejects(
  () => passwordArchive.setAccountPassword("Strong-but-not-yet-ready-1"),
  /verify the guest email/
);
await passwordArchive.linkGuestEmail("Owner@Example.com");
assert.deepEqual(
  passwordAuthCalls[0],
  { method: "updateUser", attributes: { email: "owner@example.com" } },
  "guest linking must update the email only; it must not attach a password before verification"
);
assert.equal(passwordTestUser.is_anonymous, true, "email linking must preserve the guest identity pending confirmation");
passwordTestUser = {
  ...passwordTestUser,
  is_anonymous: false,
  email: "owner@example.com",
  email_confirmed_at: "2026-11-05T00:00:00.000Z"
};
const verifiedState = await passwordArchive.getAccountState();
assert.equal(verifiedState.emailConfirmed, true);
await assert.rejects(
  () => passwordArchive.setAccountPassword("short"),
  /at least 12 characters/
);
await passwordArchive.setAccountPassword("A-long-unique-password-2026");
assert.deepEqual(
  passwordAuthCalls[1],
  { method: "updateUser", attributes: { password: "A-long-unique-password-2026" } },
  "password must only be added after email confirmation"
);
const signedIn = await passwordArchive.signInWithPassword(" OWNER@EXAMPLE.COM ", "A-long-unique-password-2026");
assert.equal(signedIn.email, "owner@example.com");
assert.deepEqual(passwordAuthCalls[2], {
  method: "signInWithPassword",
  credentials: { email: "owner@example.com", password: "A-long-unique-password-2026" }
});
const reset = await passwordArchive.sendPasswordReset(" OWNER@EXAMPLE.COM ");
assert.deepEqual(reset, { email: "owner@example.com", verificationRequired: true });
assert.deepEqual(passwordAuthCalls[3], {
  method: "resetPasswordForEmail",
  email: "owner@example.com",
  options: { redirectTo: "https://prunex.example" }
});
await assert.rejects(
  () => passwordArchive.signInWithPassword("not-an-email", "password"),
  /valid email/
);
await assert.rejects(
  () => passwordArchive.sendPasswordReset("not-an-email"),
  /valid email/
);

console.log("Game database: ranking, strict memory validation, guest-email linking, verified password setup, sign-in, and recovery checks passed.");
