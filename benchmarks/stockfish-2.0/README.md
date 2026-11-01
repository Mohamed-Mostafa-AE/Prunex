# Stockfish 2.0 historical-engine match

**Status: result transcribed; opponent binary verification pending.**

## Reported result

A local WSL run supplied by the project owner on 2026-11-01 reports the following 64-game match:

| Field | Reported value |
|---|---:|
| Test engine | Prunex 0.8.0 (Stockfish 19-derived) |
| Opponent | Official Stockfish 2.0 64-bit |
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

The local run reported all 64 games complete. The summary above is transcribed from the terminal output; it has not been independently recomputed from the PGN in this repository.

## Important interpretation

This benchmark compares the reported **Prunex 0.8.0 Stockfish 19-derived build** with historical Stockfish 2.0. It is **not** a result for the independently implemented Prunex 0.5.1 C++20 source currently described in the repository's main README.

The 99.22% figure is the match score for this specific 64-game setup. It is not an Elo rating, a general strength estimate, or an SPRT result.

## Ensuring the opponent is historical Stockfish 2.0—not Lichess

The Stockfish project's own release announcement dates Stockfish 2.0 to **2011-01-01** and documents its build/benchmark signature: running `stockfish bench` should finish with **7,224,363 searched nodes**.

- Official release announcement: https://stockfishchess.org/blog/2011/stockfish-2/
- Lichess browser port project: https://github.com/lichess-org/stockfish.wasm

The Lichess repository describes a WebAssembly port for browser analysis. It is not the historical native Stockfish 2.0 release binary.

This terminal transcript labels the opponent "Official Stockfish 2.0", but it does not include the executable's UCI identification, `bench` signature, or SHA-256. A label printed by a tournament wrapper is not sufficient proof of executable identity. Therefore the opponent identity remains **pending verification** until the local executable passes both checks below.

### Verify the exact opponent executable

From the WSL shell, run the checker against the exact path used by the tournament:

```bash
python3 tools/verify_stockfish_2.py --engine "/absolute/path/to/the/stockfish-2.0-executable"
```

A passing check must report:

- a UCI `id name` containing `Stockfish 2.0`;
- a `stockfish bench` result of exactly `7224363` nodes;
- the executable's SHA-256 hash.

Save the complete JSON output with the benchmark artifacts. This check is a practical version/build fingerprint, not a cryptographic publisher signature; retain the original download/source and its provenance as well.

## Raw artifacts

The local tournament output named these files:

- `benchmark-results/deep-1m-256mb/all-games.pgn`
- `benchmark-results/deep-1m-256mb/results.jsonl`

Those files were not present in the material supplied for this GitHub update, so they are not represented here as checked-in or independently audited. Add the original PGN, JSONL, opponent executable verification JSON, and executable SHA-256 before treating this as a fully reproducible public benchmark.

## Reproduction settings

The supplied run used 16 openings, two repetitions, both color assignments, 1,000,000 nodes per move, 256 MB hash for each engine, and one thread for each engine. The reported schedule contains 32 games with Prunex White and 32 with Prunex Black.

A repeated run should use the exact same engine executables, openings, settings, and runner version. Record both executable hashes with the run.
