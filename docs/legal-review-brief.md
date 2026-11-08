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
10. Confirm the legal relationship between the native engine licence, browser dependencies, the third-party browser-engine dependency and artwork notices so the Terms do not overstate a single licence scope.

## Current Egyptian-law findings — 6 November 2026

The following points were added after reviewing Law No. 151 of 2020, Ministerial Decree No. 816 of 2025, the Personal Data Protection Centre's consent guidance, and current legal commentary. They are issues for counsel to apply to the actual operator and audience, not a conclusion that the project is compliant or non-compliant.

- **Law and regulations:** Law No. 151 of 2020 is supplemented by Executive Regulations issued under MCIT Decree No. 816 of 2025. The Decree was published on 1 November 2025 and entered into force on 2 November 2025. The one-year status-regularisation period has therefore elapsed by the date of this review.
- **Children's data:** Article 1 treats children's data as sensitive personal data. Article 12 restricts sensitive-data processing and requires parent/legal-guardian consent for operations concerning children's data, except where law provides otherwise. Regulation 15 specifies explicit written guardian consent before collecting data from children under 15; for children aged 15–18, the child or guardian must provide consent as applicable under the mechanisms determined by the Centre. The product currently has no verified age/guardian-consent workflow. Counsel must determine the service's audience, legal age treatment, and necessary product controls before publication.
- **Games and participation:** Article 12 also states that a child's participation in a game, competition or other activity must not be conditioned on providing more personal data than necessary. Review account creation, cloud-save defaults, game PGNs, optional position-memory sharing, and any third-party analytics against necessity and consent requirements.
- **Cross-border data:** The live Supabase project is in `eu-central-1`; the Neon archive is in AWS `eu-central-1`; the inspected Vercel deployment uses `fra1`. These services process or store account and game data outside Egypt. Article 14 and Regulation 16 address cross-border transfers and licensing/permits. Counsel must confirm the appropriate PDPC authorisations, destination-country requirements, processor arrangements, and transfer consent before relying on these providers for Egyptian users.
- **Lawful basis and consent records:** The PDPC consent guidance requires a clear affirmative action for consent and records of its purpose, management, withdrawal and evidence. The current optional position-memory control records per-review consent in the application; counsel should review whether this meets the applicable standard and what further notices or consent records are required.
- **Regulatory roles:** Counsel should determine whether the actual operator must obtain a licence/permit, appoint a data protection officer or representative, maintain processing/consent records, or meet breach-notification requirements under the law and regulations. Do not infer exemptions from the service's current size or student-led status.

Primary/reference materials:
- [Egypt Personal Data Protection Law No. 151 of 2020 — English reference translation](https://eg.andersen.com/wp-content/uploads/2026/02/Law-No.-151-of-2020-1.pdf) (the official Arabic text controls).
- [Executive Regulations, MCIT Decree No. 816 of 2025 — legal reference and official-gazette details](https://legalin.law/en/our-knowledge/guide/personal-data-protection-law/).
- [Shehata & Partners English translation of Executive Regulations](https://shehatalaw.com/wp-content/uploads/2026/01/Shehata-Partners-Publications-Data-Protection-Executive-Regulations-English.pdf).
- [Personal Data Protection Centre — consent guidance](https://pdpc.gov.eg/assets/pdf-data/Guidelines/DSConsent.pdf).

## Requested counsel deliverable

Please provide:
- redlined versions of both HTML documents or written change instructions;
- jurisdictions and audience assumptions used;
- any required age/consent, transfer, retention, deletion and processor clauses;
- explicit sign-off or a list of blocking changes.

Do not remove the visible draft labels or describe the documents as approved until counsel has reviewed the final implementation and issued written clearance.
