import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const headers = vercel.headers?.flatMap(rule => rule.headers || []) || [];
const header = name => headers.find(item => item.key.toLowerCase() === name.toLowerCase())?.value || "";
const csp = header("Content-Security-Policy");
assert.ok(csp, "Content-Security-Policy is required.");

const directives = new Map(
  csp.split(";").map(part => part.trim()).filter(Boolean).map(part => {
    const [name, ...values] = part.split(/\s+/);
    return [name, values];
  })
);
assert.deepEqual(directives.get("default-src"), ["'self'"]);
assert.deepEqual(directives.get("object-src"), ["'none'"]);
assert.deepEqual(directives.get("base-uri"), ["'self'"]);
assert.deepEqual(directives.get("frame-ancestors"), ["'none'"]);
assert.ok(directives.get("script-src")?.includes("'wasm-unsafe-eval'"));
assert.ok(directives.get("script-src")?.includes("https://challenges.cloudflare.com"));
assert.ok(directives.get("frame-src")?.includes("https://challenges.cloudflare.com"));
assert.ok(directives.get("connect-src")?.includes("https://ttcejatqtvphzenjkkbh.supabase.co"));
assert.ok(directives.get("connect-src")?.includes("wss://ttcejatqtvphzenjkkbh.supabase.co"));
assert.ok(!csp.includes("*"), "Wildcard CSP sources are forbidden.");
assert.ok(!csp.includes("'unsafe-inline'"), "Inline script/style exceptions are forbidden.");
assert.ok(!csp.includes("'unsafe-eval'"), "General eval permission is forbidden.");

assert.match(header("Strict-Transport-Security"), /max-age=63072000/);
assert.match(header("Strict-Transport-Security"), /includeSubDomains/);
assert.equal(header("X-Frame-Options"), "DENY");
assert.equal(header("X-Content-Type-Options"), "nosniff");
assert.equal(header("Referrer-Policy"), "strict-origin-when-cross-origin");
assert.match(header("Permissions-Policy"), /geolocation=\(\)/);
assert.equal(header("Cross-Origin-Opener-Policy"), "same-origin");
assert.equal(header("Cross-Origin-Embedder-Policy"), "require-corp");

for (const key of [
  "VITE_SUPABASE_URL=",
  "VITE_SUPABASE_PUBLISHABLE_KEY=",
  "VITE_TURNSTILE_SITE_KEY=",
  "VITE_REQUIRE_GUEST_TURNSTILE=false"
]) assert.ok(envExample.includes(key), "Missing browser configuration: " + key);
assert.ok(!/VITE_[A-Z0-9_]*(SERVICE_ROLE|SECRET|PRIVATE_KEY)/i.test(envExample),
  "Server credentials must never be exposed through Vite variables.");

console.log("Security configuration: CSP, transport headers, isolation and public env contract passed.");
