import assert from "node:assert/strict";
import { validateBuildEnvironment } from "../scripts/validate-build-env.mjs";

const validCloud = {
  VITE_SUPABASE_URL: "https://project-ref.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_key",
  VITE_TURNSTILE_SITE_KEY: "0x4AAAA-test-public-site-key",
  VITE_REQUIRE_CAPTCHA: "true"
};

assert.equal(validateBuildEnvironment({}), "local-only");
assert.equal(validateBuildEnvironment(validCloud), "cloud-guest-captcha");

assert.throws(
  () => validateBuildEnvironment({
    VITE_SUPABASE_URL: validCloud.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: validCloud.VITE_SUPABASE_PUBLISHABLE_KEY
  }),
  /VITE_TURNSTILE_SITE_KEY/
);
assert.throws(
  () => validateBuildEnvironment({ ...validCloud, VITE_REQUIRE_CAPTCHA: "false" }),
  /VITE_REQUIRE_CAPTCHA=true/
);
assert.throws(
  () => validateBuildEnvironment({ ...validCloud, VITE_SUPABASE_URL: "http://project-ref.supabase.co" }),
  /must use HTTPS/
);
assert.throws(
  () => validateBuildEnvironment({ ...validCloud, VITE_SUPABASE_SERVICE_ROLE_KEY: "never-expose-this" }),
  /cannot be exposed/
);

console.log("Build environment: local-only, complete cloud, CAPTCHA enforcement and secret checks passed.");
