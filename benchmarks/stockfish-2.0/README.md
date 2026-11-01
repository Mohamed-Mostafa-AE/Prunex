# Stockfish 2.0 historical-engine match

**Status: local opponent version/build fingerprint checks passed; match result transcribed from the owner's run; raw game artifacts are not yet in the repository.**

## Reported result

A local WSL run supplied by the project owner on 2026-11-01 reports the following 64-game match:

| Field | Reported value |
|---|---:|
| Test engine | Prunex 0.8.0 (Stockfish 19-derived) |
| Opponent | Stockfish 2.0 64-bit (UCI identity and historical bench signature checked) |
| Games | 64 |
| Wins | 63 |
| Draws | 1 |
| Losses | 0 |
| Points | 63.5 / 64 |
| Score | 99.22% |
| Nodes per move | 1,000,000 |
| Hash | 256 MB per engine |
| Threads | 1 per engine |
| Openings | 16 |
| Repetitions | 2 |
| Prunex as White / Black | 32 / 32 |
| Draw reason | Threefold repetition |

The local run reported all 64 games complete. This table is transcribed from the terminal output; the PGN and JSONL were not supplied for independent game-by-game recomputation.

## Opponent executable identity checks

The project owner ran the checks against `benchmark-results/deep-1m-256mb/engines/stockfish-2.0`:

| Check | Observed result |
|---|---|
| UCI `id name` | `Stockfish 2.0 64bit` |
| UCI `id author` | `Tord Romstad, Marco Costalba, Joona Kiiski` |
| `bench` nodes searched | **7,224,363** |
| SHA-256 | `760f9c7435b4f498d0188b9ae5b81d6a92636328a932c020fb338a93195bcff2` |

The 7,224,363-node total exactly matches the signature documented in the [official Stockfish 2.0 release announcement](https://stockfishchess.org/blog/2011/stockfish-2/). The UCI identity, matching historical signature, and recorded local SHA-256 together provide a strong practical version/build fingerprint. They are **not** a cryptographic publisher signature and do not independently establish the binary's download provenance. The SHA-256 above is the hash measured locally; it is not represented as an upstream-published checksum.

See [verification.json](verification.json) for the structured record. The [verification script](../../tools/verify_stockfish_2.py) can also be used against a local executable.

## Indicative Elo translation — not an official rating

The closest published CCRL reference identified for this historical release family is **Stockfish 2.0.1 at 3,062 ±19 Elo** on the CCRL 40/15 list. That is a nearby patch release and a reference point; it is **not** a published rating for the exact Stockfish 2.0 binary used in this match. Source: [CCRL Stockfish 2.0.1 engine entry](https://www.computerchess.org/cgi/engine_details.cgi?engine=Stockfish+2.0.1+64-bit).

The match score is 63.5/64 = 99.21875%. The standard Elo score conversion gives:

`ΔR = 400 × log10(p / (1 − p))`

`ΔR = 400 × log10(0.9921875 / 0.0078125) ≈ 841.5`

Adding the approximately 842-point difference to the 3,062 CCRL 2.0.1 reference gives an illustrative match-implied figure of **approximately 3,904**.

This is **not an official Prunex rating**. It is a score-based projection from one 64-game match. The CCRL reference uses a different time control, hardware and opponent pool from this 1,000,000-nodes-per-move match; engine rating scales across testing pools are not directly interchangeable. The [official Stockfish FAQ on Elo](https://official-stockfish.github.io/docs/stockfish-wiki/Stockfish-FAQ.html#the-elo-rating-of-stockfish) explains why engine ratings depend on controlled conditions and sufficiently large game samples.

## Important interpretation

This match compares the reported **Prunex 0.8.0 Stockfish 19-derived build** with historical Stockfish 2.0. It is **not** a result for the independently implemented Prunex 0.5.1 C++20 source. Neither the 99.22% score nor the 3,904 projection should be attributed to the independent 0.5.1 engine.

The 99.22% is the match score for this specific 64-game setup. It is not an Elo rating, a general strength estimate, or an SPRT result. The 3,904 figure is a separately labelled illustrative translation of this sample against a proxy historical rating.

## Raw artifacts and auditability

The local tournament output named these files:

- `benchmark-results/deep-1m-256mb/all-games.pgn`
- `benchmark-results/deep-1m-256mb/results.jsonl`

Those files were not included in the material supplied for this GitHub update, so they are not checked into this repository and the match has not been independently audited from the individual records. Add the original PGN and JSONL to make the match independently reviewable. Do not substitute reconstructed records for the original outputs.

## Reproduction settings

The supplied run used 16 openings, two repetitions, both colour assignments, 1,000,000 nodes per move, 256 MB hash for each engine, and one thread for each engine. The reported schedule contains 32 games with Prunex White and 32 with Prunex Black.

A repeated run should use the exact same engine executables, openings, settings, and runner version. Record both executable hashes with the run.
