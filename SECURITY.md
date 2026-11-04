# Security policy

## Reporting a vulnerability

Please report security vulnerabilities privately through GitHub's **Report a vulnerability** feature on this repository, rather than opening a public issue.

Include the affected file or component, reproducible steps, and the potential impact. Do not include passwords, access tokens, private keys, production game exports, or personal data in a report.

## Scope

Reports are welcome for:
- the native C++20 engine and Windows desktop application;
- the separate browser application and bundled third-party components;
- Supabase Auth, database policies, Edge Functions and migrations;
- build, dependency, and deployment configuration.

## Supported release

The current native release identifier is **Prunex 0.8.0**. The website and browser demo are validated as separate components. A fix in one component does not imply that every other component has been updated.

## Security controls and limitations

The repository uses private vulnerability reporting, dependency update automation, CodeQL analysis, native and browser regression workflows, restrictive deployment response headers, and owner-scoped database policies. Anonymous cloud accounts are an intentional product feature. They are protected by owner-scoped RLS and Supabase Auth rate limits. Cloudflare Turnstile is an optional anti-abuse control for the one-time guest-account creation request; it is not required for browsing or chess gameplay.

Automated scans and tests reduce risk but are not a penetration test, legal review, or security guarantee. Production credentials must remain in provider secret stores and must never be committed or exposed through browser-prefixed environment variables.
