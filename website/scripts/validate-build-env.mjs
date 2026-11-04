#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const CLOUD_VARIABLES = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_TURNSTILE_SITE_KEY"
];
const SECRET_NAME_PATTERN = /^VITE_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|ACCESS_TOKEN)/i;

export function validateBuildEnvironment(environment = process.env) {
  const exposedSecrets = Object.keys(environment).filter(name => SECRET_NAME_PATTERN.test(name));
  if (exposedSecrets.length) {
    throw new Error(
      "Server-side credentials cannot be exposed in browser variables: " + exposedSecrets.join(", ")
    );
  }

  const supplied = CLOUD_VARIABLES.filter(name =>
    typeof environment[name] === "string" && environment[name].trim().length > 0
  );
  if (supplied.length === 0) return "local-only";

  const missing = CLOUD_VARIABLES.filter(name =>
    typeof environment[name] !== "string" || environment[name].trim().length === 0
  );
  if (missing.length) {
    throw new Error("Cloud archive configuration is incomplete. Missing: " + missing.join(", "));
  }
  if (environment.VITE_REQUIRE_CAPTCHA !== "true") {
    throw new Error(
      "Cloud archive builds require VITE_REQUIRE_CAPTCHA=true. Configure the Turnstile site key " +
      "and matching server secret in the identity provider before building."
    );
  }

  let endpoint;
  try {
    endpoint = new URL(environment.VITE_SUPABASE_URL);
  } catch {
    throw new Error("VITE_SUPABASE_URL must be a valid HTTPS URL.");
  }
  if (endpoint.protocol !== "https:") {
    throw new Error("VITE_SUPABASE_URL must use HTTPS.");
  }

  return "cloud-guest-captcha";
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const mode = validateBuildEnvironment(process.env);
    console.log("Build environment: " + mode + " configuration accepted.");
  } catch (error) {
    console.error("Build environment rejected: " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
