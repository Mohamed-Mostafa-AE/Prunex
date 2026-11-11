# Verified 64-game baseline match and replay evidence

This workflow creates a reproducible, color-balanced 64-game record for the current Prunex native C++20 build against a build of the pinned official Stockfish 2.0 source release with a narrowly scoped, disclosed node-limit polling patch.

## Match protocol

- 16 fixed opening positions.
- Each opening is repeated twice.
- Prunex plays White and Black in each repetition: 32 games per color.
- Each engine is asked to search up to 1,000,000 nodes per move by default. Prunex enforces this limit strictly. The pinned Stockfish 2.0 source is built with `tools/stockfish-2.0-match/patches/stockfish-2-node-budget.patch`: it polls both the main search and quiescence search every 800 nodes. The runner records every actual per-move count and allows Stockfish 2.0 no more than 1,000 nodes of overshoot as a hard validation ceiling. The tighter polling interval is intended to keep observed overshoot below that ceiling; the ceiling is not a target. Prunex's strict cap is never relaxed.
- Stockfish 2.0 uses a recorded 256 MiB Hash setting and one thread. Prunex uses a native transposition table configured with `PRUNEX_TT_BITS=22`; the match summary records its exact table bit count and entry count. This is a disclosed, controlled configuration, not a claim of byte-identical table layouts.
- The workflow records engine identities, source commits, executable SHA-256 hashes, every move, FEN before each move, available search telemetry, game results, and termination reasons.

The 64-game score is a match result, not an Elo rating or proof of general superiority. It is the first screening gate in a staged strength programme. A result above 50% is positive evidence for this fixed opening suite, but it should be repeated with a fresh opening seed before moving to the next opponent tier.

## Opponent verification

The workflow checks the official source tag and pinned commit `aa2de53a83ca5423c8c8007abf71f9afdf589d93`, then applies the repository patch above and records its SHA-256 beside the retained patch file. It verifies the UCI identity and the historical 16-position depth-12 bench on the patched build. The expected official console aggregate is 7,224,363 nodes.

The Stockfish 2.0 console aggregate and per-position `bench.txt` `Nodes:` entries are distinct counters. The recorded historical build reports 7,224,363 in its console summary while the sum of the 16 per-position entries is 7,224,315 (a 48-node difference). Verification therefore requires the official console aggregate and exactly 16 per-position records, retains the raw logs, and records the delta. It does not incorrectly require the two counters to be equal.

The historical 1 November 2026 owner-supplied 63–1–0 report is not part of this test. Its archived metadata did not include raw PGN/JSONL and did not verify the opponent executable identity, so it is not evidence for this independently built Prunex source.

## Replay and recordings

After all 64 PGNs have been written and validated, the workflow creates:

- `all-games.pgn`: the authoritative, complete move records.
- `games.jsonl`: per-game and per-move FEN, SAN/UCI, result, and search telemetry.
- `evidence/replay.html`: a self-contained offline viewer with game selection, move navigation, autoplay, playback speed, and the three Prunex website move-sound profiles.
- `evidence/64-game-replay.mp4`: a rendered move-by-move replay derived from the PGN, with an AAC audio track.
- `evidence/64-game-final-positions.png`: a contact sheet of the 64 final positions derived from the PGNs.
- `stockfish-verification.json`, `summary.json`, and `SHA256SUMS.txt`: verification, aggregate match outcome, source/build identities, and file hashes.

The viewer and video are generated only after the match script has produced all 64 games. Both are derived from the recorded games; neither invents moves nor asks an engine to replay or recalculate them.

## GitHub Actions usage

- A push to `main` builds Prunex with the configured native table and runs the complete regression suite. It does not start an opponent match.
- To run the current baseline stage, open **Actions → Prunex Strength Ladder → Run workflow**. The default run uses 1,000,000 nodes per move, a 256 MiB opponent Hash setting, one thread per engine, and the balanced 64-game opening suite.
- A successful baseline run uploads replay media and complete evidence as a GitHub Actions artifact.
- Machine-readable progress is also committed to the `strength-ladder-progress` branch under `progress/stages/01-stockfish-2.0/run-N/`. This retains the PGN, per-move telemetry, result summary, opponent verification, and checksums in version history.
- A new opponent tier is not started until the current stage has a positive, verified result and the repeat test has confirmed it.

A failed, cancelled, or incomplete run is never recorded as a completed match. The run must produce and validate all 64 PGNs before the stage record is committed.
