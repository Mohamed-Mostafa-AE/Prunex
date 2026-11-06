import assert from "node:assert/strict";
import { validateBuildEnvironment } from "../scripts/validate-build-env.mjs";

const cloud = {
  VITE_SUPABASE_URL: "https://project-ref.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key"
};
const turnstile = {
  ...cloud,
  VITE_TURNSTILE_SITE_KEY: "0x4AAAA-test-public-site-key",
  VITE_REQUIRE_GUEST_TURNSTILE: "true"
};

assert.equal(validateBuildEnvironment({}), "local-only");
assert.equal(validateBuildEnvironment(cloud), "cloud-guest",
  "Cloud archive must work without CAPTCHA.");
assert.equal(validateBuildEnvironment({
  ...cloud,
  VITE_TURNSTILE_SITE_KEY: "0x4AAAA-optional-key",
  VITE_REQUIRE_GUEST_TURNSTILE: "false"
}), "cloud-guest");
assert.equal(validateBuildEnvironment(turnstile), "cloud-guest-turnstile");

assert.throws(
  () => validateBuildEnvironment({ VITE_SUPABASE_URL: cloud.VITE_SUPABASE_URL }),
  /VITE_SUPABASE_PUBLISHABLE_KEY/
);
assert.throws(
  () => validateBuildEnvironment({ ...cloud, VITE_SUPABASE_URL: "http://project-ref.supabase.co" }),
  /must use HTTPS/
);
assert.throws(
  () => validateBuildEnvironment({ ...cloud, VITE_REQUIRE_GUEST_TURNSTILE: "true" }),
  /VITE_TURNSTILE_SITE_KEY/
);
assert.throws(
  () => validateBuildEnvironment({ VITE_REQUIRE_GUEST_TURNSTILE: "true" }),
  /only be enabled/
);
assert.throws(
  () => validateBuildEnvironment({ ...cloud, VITE_SUPABASE_SERVICE_ROLE_KEY: "never-expose-this" }),
  /cannot be exposed/
);

console.log("Build environment: local cloud archive, optional Turnstile and secret checks passed.");
