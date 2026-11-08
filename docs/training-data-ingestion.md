# Training-data sourcing and ingestion

## What "learning" currently means

The browser experience can save completed games and game reviews. It also
keeps eligible move-quality samples in the local browser database. When a
player explicitly enables the shared position-memory option, eligible,
minimal position/move-quality samples can be contributed to the shared
experience table. The browser can retrieve those samples for matching
positions.

That mechanism is **experience retrieval**, not automatic engine training.
It can reuse a move in a position seen before; it does not update the native
C++ engine's evaluation parameters, search code, or weights. The evaluation
calibration script adjusts expected-points interpretation for review scores;
it does not train or modify the chess engine.

The native C++ Prunex engine does not currently have an automated PGN ingestion
or self-training pipeline. Do not describe the native engine as learning from
all website users' games until a native training-and-validation pipeline has
actually been built and verified.

## Approved source policy

A game being publicly viewable or appearing in a tournament broadcast does not,
by itself, establish permission to bulk-download, redistribute, or use it in a
training corpus. Every imported source must have a recorded license or a
written permission that covers the intended use.

Initial source allowlist:

| Source | Material | Published terms | Handling |
| --- | --- | --- | --- |
| [Lichess open database](https://database.lichess.org/) | Monthly rated-game PGN exports and evaluation-position exports | CC0 for the database exports | Can be used for research, commercial use, modification, and redistribution under the published CC0 terms |
| [Lichess broadcasts](https://database.lichess.org/broadcast/) | Tournament broadcast PGNs | CC BY-SA 4.0 | Preserve attribution and the share-alike terms for adapted/re-published broadcast material |
| Player-submitted games | A user's own PGN or game export | User-provided permission/consent | Record the consent scope; do not silently add private games to a shared corpus |
| Other tournament archives | Tournament PGNs from organizers or publishers | Source-specific | Do not ingest until explicit reuse/training rights are confirmed |

Sources such as tournament organizers, federation archives, publishers, and
other chess websites must be added individually after checking their current
terms. Do not scrape an unrestricted "all sources" feed or bypass access
controls, paywalls, rate limits, or licensing requirements.

## Required corpus manifest

Every imported batch must have a manifest stored next to the dataset:

- source name and canonical source URL;
- exact download URL or archive identifier;
- publication/download date and covered date range;
- license identifier and a copy/link to its terms;
- attribution text and share-alike obligations, if applicable;
- SHA-256 checksum of the downloaded archive;
- importer version and normalization settings;
- raw game count, accepted count, rejected count, and duplicate count.

Keep raw archives and derived datasets separately. Do not upload bulk PGNs or
millions of positions to the user-game tables in Supabase. Those tables are
for private user archives and small, consent-based shared experience samples.
A large training corpus belongs in versioned object storage and offline
training infrastructure.

## Data preparation

1. Verify the manifest and checksum before parsing.
2. Parse PGN headers and move sequences; reject malformed games and illegal
   move sequences.
3. Normalize standard chess separately from variants and Chess960. Never mix
   variant positions into the standard-engine dataset without an explicit
   variant-specific pipeline.
4. Deduplicate using a canonicalized game representation, not player names
   alone. Preserve source provenance when the same game appears in multiple
   archives.
5. Exclude corrupt, incomplete, duplicate, or unsuitable games. Keep a
   reproducible record of filtering decisions.
6. Split train, validation, and test sets by complete game (and preferably by
   tournament/time period) so positions from one game cannot leak across sets.
7. Record player rating/time-control strata where available, but do not treat
   rating metadata as ground-truth engine strength.

## Evaluation labels and actual engine training

A PGN supplies moves and usually a game result; it does not automatically
supply a trusted evaluation for every position. For evaluation calibration,
position scores and eventual results must be paired consistently from the
same side-to-move perspective. Position-score calibration requires scores and eventual game results paired
consistently from the same side-to-move perspective. It changes the review
interpretation layer only; it does not update engine parameters.

A successful data import or lower training loss is not evidence of a stronger
engine. Every candidate native-engine change must pass:

- native correctness and regression suites;
- tactical and endgame test sets;
- held-out evaluation calibration (log loss/Brier score where applicable);
- controlled engine matches with paired colors, fixed openings, time controls,
  hardware, hash/thread settings, adequate game counts, and confidence
  intervals or SPRT;
- a rollback path to the previous known-good engine and network.

## Nodes and strength

A node is one position/search expansion. Increasing a node budget increases
computation, not guaranteed playing strength. A trillion-node budget is not a
sensible per-move production setting for a browser or ordinary desktop: it
could run for an impractical amount of time and does not replace better search,
evaluation, data quality, or match testing. Set budgets from measured
hardware-specific time controls, then benchmark at fixed conditions.
