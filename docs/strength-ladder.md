# Prunex Strength Ladder

## Objective

Improve Prunex through measurable, independently implemented search and evaluation work. Use GitHub for source history, builds, regressions, controlled matches, and permanent benchmark records.

No strength claim is made in advance. Every rung is earned through reproducible results.

## Stage 01 — baseline opponent

The first opponent is the pinned Stockfish 2.0 source build already supported by the repository.

- 64 games total, 32 with Prunex as White and 32 as Black.
- 16 fixed opening positions, each repeated twice.
- Default search budget: 1,000,000 nodes per move for both engines.
- One thread per engine.
- Prunex native transposition table: `PRUNEX_TT_BITS=22`.
- Opponent Hash: 256 MiB by default.
- Pin and record the opponent source commit, executable hash, verifier output, and local node-budget patch.
- Retain every PGN, FEN, move, per-move node count, available search telemetry, result, and checksum.

A 64-game result above 50% is a positive screening result for this fixed suite, not an Elo estimate. Repeat the stage with a fresh opening seed before promotion. If the result is not positive or the repeated result does not confirm it, stay on this rung, inspect the losses, improve Prunex, and retest.

## Later stages

Only after Stage 01 is cleared:

1. Select one stronger, precisely pinned opponent build.
2. Keep engine settings, hardware, node/time budget, color balance, and evidence collection controlled.
3. Run the same paired-color screening procedure.
4. Promote only after the result is repeatable; otherwise return to analysis and improvement.
5. Record each rung independently rather than replacing prior results.

The next opponent is selected after the previous stage has been demonstrated. The ladder configuration and evidence should never imply a result that has not been measured.

## GitHub recordkeeping

- Pull requests preserve every code change and its regression evidence.
- Pushes to `main` that touch the active engine, match harness, tests, ladder workflow, or stage documentation run the native regression suite and the active 64-game baseline stage.
- Manual workflow dispatches can repeat the baseline with an explicitly selected node budget and opponent hash size.
- Each completed match produces the full PGN and per-move telemetry plus the interactive replay, sound-enabled MP4, final-position poster, opponent verification, and checksums. The complete evidence directory is copied to a permanent run folder on `strength-ladder-progress`.
- Each recorded run has its own directory and is never overwritten by a later attempt.
- Keep failed and cancelled workflow runs identifiable; do not report them as completed matches.

This programme measures progress rather than announcing a target strength before the evidence exists.
