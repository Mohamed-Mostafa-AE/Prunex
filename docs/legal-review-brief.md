# Counsel review brief — Prunex Play

This is a factual handoff for a qualified lawyer/privacy professional. It is not a legal opinion and does not convert the current public drafts into approved terms.

## Materials to review

- Public draft Privacy Notice: `website/privacy.html`
- Public draft Terms of Use: `website/terms.html`
- Relevant account/identity and archive implementation: `website/src/game-database.js`, `website/api/archive.js`, `supabase/functions/delete-account/index.ts`, `website/supabase/schema.sql`
- Operational data architecture and release notes: `docs/production-readiness.md`

Both web documents are explicitly marked **Draft for review** and dated 4 November 2026.

## Current implementation described by the draft/source

- Website hosting: Vercel.
- Identity provider: Supabase Auth. A guest Supabase account is created for cloud-archive flows. The player can link and verify an email on that existing identity, then set a password; password sign-in and email-based recovery are also implemented. Password values are sent to Supabase Auth and are not stored in Prunex game records or browser storage. The hosted project's manual identity-linking, password policy, confirmation and SMTP settings still require verification.
- Primary private archive: Neon PostgreSQL. Normal archive reads/writes are routed through the same-origin server API. Owner identity is checked against the Supabase token, verified email, and configured `PRUNEX_OWNER_EMAIL`.
- Legacy records: Supabase tables `prunex_games`, `prunex_game_reviews`, and `prunex_position_memory` remain as historical source/fallback data while migration is incomplete.
- Browser-local data: IndexedDB can store games and move/review data on the current device. Deleting an account clears the current browser's local archive; it cannot remotely erase local browser data on other devices.
- Cloud game/review data includes identifiers, timestamps, player colour, outcomes, FEN positions, moves, PGN, review analysis and accuracy data.
- Optional position memory is a distinct data-sharing/lookup feature and should be described precisely. The draft says it is off by default and may expose pseudonymized position/move-quality samples for lookup; it is not automatic retraining of the native engine.
- Provider infrastructure may process IP addresses, request headers, timestamps and diagnostics. The draft does not claim zero provider logging.
- The native C++20 engine is distinct from the browser opponent/review components.

## Questions requiring legal advice

1. Identify the operator/data controller and appropriate contact/business address disclosures.
2. Confirm all applicable jurisdictions based on operator location, target audience and actual user geography. Assess Egyptian data-protection law and any extraterritorial regimes that apply.
3. Determine whether the service is directed to or likely to be used by children/minors; specify age thresholds, age assurance, parental consent and child-data safeguards where required.
4. Identify the lawful basis and notice/consent requirements for guest Auth, email linking, cloud archives, game PGNs, review analysis, optional position-memory sharing, security logs and support requests.
5. Assess whether position-memory sharing is sufficiently optional and informed, how consent is recorded/revoked, and whether shared positions could remain identifiable.
6. Review international transfers, subprocessors, processor agreements, data-location disclosures, retention schedules and provider-specific diagnostic-log retention.
7. Validate access, correction, export, deletion and account-recovery processes, including local data on other devices, backups, and post-deletion backup expiry.
8. Review cookies/local storage/IndexedDB disclosures, tracking/analytics (if any), security incident and breach notification commitments, and contact/complaint handling.
9. Review Terms clauses for acceptable use, third-party tournament rules, user-submitted games/PGNs, dataset licensing, attribution, warranty disclaimers, liability limits, suspension, governing law, disputes and consumer rights.
10. Confirm the legal relationship between the native engine licence, browser dependencies, Stockfish-based components and artwork notices so the Terms do not overstate a single licence scope.

## Requested counsel deliverable

Please provide:
- redlined versions of both HTML documents or written change instructions;
- jurisdictions and audience assumptions used;
- any required age/consent, transfer, retention, deletion and processor clauses;
- explicit sign-off or a list of blocking changes.

Do not remove the visible draft labels or describe the documents as approved until counsel has reviewed the final implementation and issued written clearance.
