# Stockfish 2.0 historical-engine match

**Status: match result transcribed; opponent version/build fingerprint checks passed locally. Raw game artifacts are not yet in the repository.**

## Reported result

A local WSL run supplied by the project owner on 2026-11-01 reports the following 64-game match:

| Field | Reported value |
|---|---:|
| Test engine | Prunex 0.8.0 (Stockfish 19-derived) |
| Opponent | Stockfish 2.0 64-bit (local UCI identity and bench signature checked) |
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

The local run reported all 64 games complete. The summary is transcribed from the terminal output; the PGN and JSONL were not supplied for independent game-by-game recomputation.

## Opponent executable identity checks

The project owner ran these checks against the local executable at `benchmark-results/deep-1m-256mb/engines/stockfish-2.0`:

| Check | Observed result |
|---|---|
| UCI `id name` | `Stockfish 2.0 64bit` |
| UCI `id author` | `Tord Romstad, Marco Costalba, Joona Kiiski` |
| `bench` nodes searched | **7,224,363** |
| SHA-256 | `760f9c7435b4f498d0188b9ae5b81d6a92636328a932c020fb338a93195bcff2` |

The 7,224,363-node result exactly matches the benchmark signature documented in the [official Stockfish 2.0 release announcement](https://stockfishchess.org/blog/2011/stockfish-2/). That announcement identifies the 2011-01-01 Stockfish 2.0 release and explains that the benchmark should end with this searched-node total.

The UCI identification, matching historical benchmark signature, and recorded local SHA-256 together provide a strong practical version/build fingerprint. They are **not** a cryptographic publisher signature and do not independently establish the binary's download provenance. The SHA-256 above is the hash measured locally from the executable used for the check; it is not represented as an upstream-published checksum.

See [verification.json](verification.json) for the structured record. The repository's [verification script](../../tools/verify_stockfish_2.py) can also be used to perform the checks against a local executable.

## Important interpretation

This benchmark compares the reported **Prunex 0.8.0 Stockfish 19-derived build** with historical Stockfish 2.0. It is **not** a result for the independently implemented Prunex 0.5.1 C++20 source currently described in the repository's main README.

The 99.22% figure is the match score for this specific 64-game setup. It is not an Elo rating, a general strength estimate, or an SPRT result.

## Raw artifacts and auditability

The local tournament output named these files:

- `benchmark-results/deep-1m-256mb/all-games.pgn`
- `benchmark-results/deep-1m-256mb/results.jsonl`

Those files were not included in the material supplied for this GitHub update, so they are not checked into this repository and the game results have not been independently audited from the individual records. Add the original PGN and JSONL to make the match independently reviewable. Do not substitute reconstructed records for the original outputs.

## Reproduction settings

The supplied run used 16 openings, two repetitions, both color assignments, 1,000,000 nodes per move, 256 MB hash for each engine, and one thread for each engine. The reported schedule contains 32 games with Prunex White and 32 with Prunex Black.

A repeated run should use the exact same engine executables, openings, settings, and runner version. Record both executable hashes with the run.
