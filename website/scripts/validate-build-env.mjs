#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const CLOUD_VARIABLES = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
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
  if (supplied.length === 0) {
    if (environment.VITE_REQUIRE_GUEST_TURNSTILE === "true") {
      throw new Error("Guest Turnstile can only be enabled when the Supabase cloud archive is configured.");
    }
    return "local-only";
  }

  const missing = CLOUD_VARIABLES.filter(name =>
    typeof environment[name] !== "string" || environment[name].trim().length === 0
  );
  if (missing.length) {
    throw new Error("Cloud archive configuration is incomplete. Missing: " + missing.join(", "));
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

  const requireTurnstile = environment.VITE_REQUIRE_GUEST_TURNSTILE === "true";
  const siteKey = typeof environment.VITE_TURNSTILE_SITE_KEY === "string"
    ? environment.VITE_TURNSTILE_SITE_KEY.trim()
    : "";
  if (requireTurnstile && !siteKey) {
    throw new Error("Guest Turnstile was explicitly enabled, but VITE_TURNSTILE_SITE_KEY is missing.");
  }

  return requireTurnstile ? "cloud-guest-turnstile" : "cloud-guest";
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log("Build environment: " + validateBuildEnvironment(process.env) + " configuration accepted.");
  } catch (error) {
    console.error("Build environment rejected: " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
