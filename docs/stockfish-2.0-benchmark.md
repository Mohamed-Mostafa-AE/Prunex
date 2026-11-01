# Prunex 0.8.0 vs official Stockfish 2.0 — benchmark report

**Result: 62 wins, 2 draws, 0 losses (63/64 points; 98.44%) across 64 games.**

This is a completed head-to-head benchmark, not a perfect score and not an Elo rating.

## Reproducibility and evidence

- GitHub Actions run: [41253517143](https://github.com/Mohamed-Mostafa-GT/Prunex/actions/runs/41253517143)
- Run status: successful
- The run artifact contains the full PGN, JSON summary, Prunex executable, source archive, provenance record, and both GPLv3 license files.
- Opponent source: official Stockfish repository tag `sf_2.0`.
- Tested Prunex source: official Stockfish repository tag `sf_19`, with the UCI engine identification string changed to identify the derivative as Prunex 0.8.0. The search, evaluation, and move-generation implementation remain Stockfish 19's.

## Match conditions

| Parameter | Setting |
|---|---|
| Games | 64 |
| Openings | 16 |
| Repetitions | 2 per opening |
| Color balance | 32 games each as White and Black |
| Node budget | 100,000 nodes per move for each engine |
| Hash | 128 MB per engine |
| Threads | 1 per engine |
| Build | GCC, x86-64, built from source in CI |
| Opening book | Disabled / not used |
| Draw adjudication | python-chess rules, including threefold repetition |

## Results

| Result | Games |
|---|---:|
| Prunex wins | 62 |
| Draws | 2 |
| Prunex losses | 0 |
| Score | 63/64 = 98.4375% |

Both draws occurred with Prunex playing Black:

1. Round 36 — Nimzo-Indian Defense — threefold repetition.
2. Round 62 — Grünfeld Defense — threefold repetition.

There were no losses in this 64-game sample. The two draws remain draws; they are not wins and should not be relabelled.

## What does "3,200 Elo" mean here?

Do not state that Stockfish 2.0 was a 3,200-Elo engine without a rating-list citation. Chess-engine Elo depends on the rating list, hardware, and time control; there is no single official Stockfish Elo.

The CCRL engine-details pages list:
- Stockfish 2.0.1 64-bit: **3062 Elo** on CCRL 40/15 ([CCRL entry](https://www.computerchess.org/cgi/engine_details.cgi?engine=Stockfish+2.0.1+64-bit)).
- Stockfish 2.0.1 32-bit: **3045 Elo** on CCRL 40/15 ([CCRL entry](https://www.computerchess.org/cgi/engine_details.cgi?eng=Stockfish+2.0.1+32-bit&print=Details)).

The official Stockfish release note states Stockfish 2.0.1 was a maintenance release with no functional change and no Elo increase over 2.0 ([official release note](https://stockfishchess.org/blog/2011/stockfish-2-0-1/)). Thus, the 2.0.1 ratings are useful historical context for 2.0, but they are not an Elo measurement of the exact CI binary.

## Follow-up at a deeper node budget

A separate 64-game follow-up at 1,000,000 nodes per move and 256 MB hash per engine is planned as a local Windows/WSL run. The earlier hosted attempt was interrupted and did not produce a completed result. The resumable local runner and its setup are documented in [the local benchmark guide](local-deep-benchmark.md). Until its summary records all 64 games, there is no deep-search result to report.

## What this result does and does not show

It shows that the tested Stockfish 19-derived Prunex 0.8.0 build scored 98.44% against the tested official Stockfish 2.0 build under the stated node-limited conditions.

It does **not** show:
- a 3,200 Elo rating for Prunex;
- a perfect score (there were two draws);
- superiority to current Stockfish;
- that the independently authored Prunex 0.5.x engine independently achieved this strength.

The 0.8.0 benchmark candidate is a GPLv3 Stockfish 19 derivative. The browser site uses a separate Stockfish.js 19.0.1 lite single-threaded WebAssembly package. The browser opponent is not the tournament binary.

## Suggested accurate public wording

> Prunex 0.8.0, a GPLv3 derivative of official Stockfish 19, scored 98.44% in a completed 64-game match against an independently compiled official Stockfish 2.0 build: 62 wins, 2 draws, and 0 losses. Both engines used one thread, 128 MB hash, and 100,000 nodes per move, with 16 openings and colors balanced. The full PGN, benchmark summary, source provenance, and licenses are available in the GitHub Actions artifact. This result is a controlled head-to-head benchmark, not an independently established Elo rating.

## Sources

- [Official Stockfish 2.0 announcement](https://stockfishchess.org/blog/2011/stockfish-2/)
- [Official Stockfish 2.0.1 maintenance-release announcement](https://stockfishchess.org/blog/2011/stockfish-2-0-1/)
- [CCRL Stockfish 2.0.1 64-bit rating entry](https://www.computerchess.org/cgi/engine_details.cgi?engine=Stockfish+2.0.1+64-bit)
- [CCRL Stockfish 2.0.1 32-bit rating entry](https://www.computerchess.org/cgi/engine_details.cgi?eng=Stockfish+2.0.1+32-bit&print=Details)
