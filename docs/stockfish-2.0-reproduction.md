# Verified 64-game match and replay evidence

This workflow creates a reproducible, color-balanced 64-game record for the current Prunex 0.8.0 native C++20 build against the pinned official Stockfish 2.0 source release.

## Match protocol

- 16 fixed opening positions.
- Each opening is repeated twice.
- Prunex plays White and Black in each repetition: 32 games per color.
- Each engine is asked to search up to 1,000,000 nodes per move by default. Prunex enforces this limit strictly. The pinned Stockfish 2.0 source checks `go nodes` during periodic search polling (`NodesBetweenPolls = min(MaxNodes, 30000)`), so its observed count may exceed the request by up to 30,000 nodes. The runner records every actual count and applies only that bounded allowance to Stockfish 2.0; it never relaxes Prunex's strict cap.
- Stockfish 2.0 uses a recorded 256 MiB Hash setting and one thread. Prunex uses its fixed native transposition table; this difference is recorded rather than described as equal memory allocation.
- The workflow records engine identities, source commits, executable SHA-256 hashes, every move, FEN before each move, available search telemetry, game results, and termination reasons.

The 64-game score is a match result, not an Elo rating or proof of general superiority. Because the legacy opponent's node limit is polled rather than checked on every node, the protocol is a matched requested budget with a disclosed, bounded polling tolerance—not a claim that both engines stop on the exact same node.

## Opponent verification

The workflow checks the official source tag and pinned commit `aa2de53a83ca5423c8c8007abf71f9afdf589d93`, the UCI identity, and the historical 16-position depth-12 bench. The expected official console aggregate is 7,224,363 nodes.

The Stockfish 2.0 console aggregate and per-position `bench.txt` `Nodes:` entries are distinct counters. The recorded historical build reports 7,224,363 in its console summary while the sum of the 16 per-position entries is 7,224,315 (a 48-node difference). Verification therefore requires the official console aggregate and exactly 16 per-position records, retains the raw logs, and records the delta. It does not incorrectly require the two counters to be equal.

The historical 1 November 2026 owner-supplied 63–1–0 report is not part of this test. Its archived metadata did not include raw PGN/JSONL and did not verify the opponent executable identity, so it is not evidence for this independently built Prunex source.

## Replay and recordings

After all 64 PGNs have been written and validated, the workflow creates:

- `all-games.pgn`: the authoritative, complete move records.
- `games.jsonl`: per-game and per-move FEN, SAN/UCI, result, and search telemetry.
- `evidence/replay.html`: a self-contained offline viewer with game selection, move navigation, autoplay, playback speed, and the same three synthesized move-sound profiles as the Prunex website (Classic wooden tap, Soft felt tap, and Quiet click). Record this viewer on the desktop to capture the actual move sounds.
- `evidence/64-game-replay.mp4`: a rendered move-by-move replay derived from the PGN, with an AAC audio track using the website's default Classic wooden tap profile.
- `evidence/64-game-final-positions.png`: a contact sheet of the 64 final positions derived from the PGNs.
- `evidence/stockfish-2.0-*.txt`: the opponent's raw UCI and benchmark evidence.
- `stockfish-verification.json`, `summary.json`, and `SHA256SUMS.txt`: verification, aggregate match outcome, source/build identities, and file hashes.

The viewer and video are generated only after the match script has produced 64 completed PGNs. Both are derived from the recorded games; neither invents moves or asks an engine to replay/recalculate them. The MP4 includes the Classic wooden tap sounds; the interactive HTML viewer also lets you switch between Classic wooden tap, Soft felt tap, and Quiet click.

The self-contained HTML viewer can be opened locally in a modern browser. Click Play once to enable browser audio. It has no external runtime dependency.

## GitHub Actions usage

- Pull requests run the native build, regression suite, opponent verifier unit tests, replay-renderer integration test, and opponent verification. They do not run the full 64-game match.
- A merge to `main` that changes this workflow or its tools triggers the full match automatically.
- `workflow_dispatch` can run it manually with a custom node budget and Stockfish Hash setting.
- The full or partial evidence directory is uploaded as a GitHub Actions artifact with 90-day retention.

A failed run must not be described as a completed match. A successful build or opponent verification alone is not a 64-game result; the match step must complete and produce 64 valid PGNs.
