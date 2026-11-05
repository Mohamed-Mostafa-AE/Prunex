# Historical Stockfish 2.0 matchup — evidence record

**Scope:** this is a historical experiment involving a Stockfish 19-derived test executable labelled "Prunex 0.8.0". It is not a match result for the independently implemented native C++20 Prunex engine.

## Archived 64-game result

The successful GitHub Actions run on 2026-10-31 produced a complete PGN and machine-readable summary. The retained artifact was downloaded and the PGN headers were independently recounted against the summary.

| Measure | Result |
|---|---:|
| Games | 64 |
| Prunex-labelled test build wins | **62** |
| Draws | **2** |
| Losses | **0** |
| Points | **63 / 64** |
| Score | **98.44%** |
| Opening suite | 16 openings, 4 games per opening |
| Colour balance | 32 games as White, 32 as Black |
| Nodes per move | 100,000 |
| Hash | 128 MB per engine |
| Threads | 1 per engine |
| Repetitions | 2 per opening; colours reversed |

Both draws were threefold repetitions with the test build playing Black: Nimzo-Indian Defense (round 36) and Grünfeld Defense (round 62).

The PGN contains all 64 rounds. Its header records identify the test build, opponent, opening, colour, node control, contempt setting, result and termination. The benchmark harness checks that each engine returns a legal move before applying it. Its final summary and the PGN agree on the 62–2–0 result.

## Build lineage and limits

The historical workflow checked out the official Stockfish repository at tag `sf_19`, built it for x86-64, and made one source edit to the UCI display name so that it identified the test executable as `Prunex 0.8.0 (Stockfish 19-derived)`. The recorded Stockfish 19 source commit in the uploaded provenance file is `edb0d9db6731067ec50ce619ff372b463bc4dd5d`.

The opponent was checked out from the official Stockfish repository at tag `sf_2.0` and built for x86-64 in the same workflow. The PGN's opponent label is `Stockfish 2.0`. The archived artifact does not contain a separately recorded Stockfish 2.0 binary hash, so this report does not claim a cryptographic fingerprint of that compiled opponent binary.

This experiment establishes the outcome of this specific 64-game, equal-node-control run. It does **not** establish:
- an Elo rating for the tested build;
- a rating for the native C++20 Prunex engine;
- that the current website's Stockfish.js browser package is byte-identical to the benchmark executable;
- a general or tournament-certified strength rating.

## Primary GitHub evidence

- [Successful GitHub Actions run #41253517143](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/41253517143)
- [Download the retained benchmark artifact](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/41253517143/artifacts/13061744082) — includes the complete PGN, summary JSON, test executable, Stockfish 19-derived source archive, provenance text and both GPLv3 license files. The artifact was listed as unexpired when checked on 2026-11-05 and has a displayed expiry of 2027-01-29.
- [Workflow source at the tested commit](https://github.com/Mohamed-Mostafa-AE/Prunex/blob/0b359558b42204a099e8391d7b5cc17d5d31352c/.github/workflows/prunex-sf19-full.yml)
- [Tournament runner at the tested commit](https://github.com/Mohamed-Mostafa-AE/Prunex/blob/0b359558b42204a099e8391d7b5cc17d5d31352c/tools/prunex_stockfish4_match.py)
- [Official Stockfish 19 source tag](https://github.com/official-stockfish/Stockfish/tree/sf_19)
- [Official Stockfish 2.0 source tag](https://github.com/official-stockfish/Stockfish/tree/sf_2.0)

### Archived artifact checksums

These SHA-256 values were calculated from the downloaded GitHub Actions artifact and its files.

| File | SHA-256 |
|---|---|
| GitHub artifact ZIP | `2dc1107808fcef3371e98dd40fe93c86e6c9953d8ceea1301bc061519145369e` |
| Complete PGN | `71727644f4f6582aab6714ae6e998d7d65a31bca7134f8d5d47836c0c89d2c72` |
| Summary JSON | `8417593569b9d2a031036e2e5952f0e009d79f49c22b2f1edcf8143a83e740fd` |
| Test executable labelled Prunex 0.8.0 | `607003a34908f6526753fb7b69f88401bcea511b6444f775ff3f16afb6743e4f` |
| Stockfish 19-derived source archive | `7848f632b55e2c3401a81210bffd35da78c4f3b8d5bb3a0b4b700b68e58e72f6` |

The GitHub artifact's published digest matched the ZIP's SHA-256 calculated after download.

## Separate 1,000,000-node result

A different local run is documented in the repository history as 63 wins, 1 draw and 0 losses (63.5/64, 99.22%) at 1,000,000 nodes per move and 256 MB hash per engine. That result is **owner-reported, not independently audited from a supplied raw PGN/JSONL in the archived Actions artifact**. It is therefore kept separate and is not the headline result on the website. Do not merge the two scorelines or describe the 1M-node result as part of Actions run #41253517143.

## Reproduction

The workflow and runner links above provide the historical build/test procedure. Download the artifact and run the repository's PGN summary checker against its PGN and summary JSON to verify the round count, W/D/L, score, openings, colours and run settings. A new native-engine strength claim requires a separate tournament using the independent C++20 executable under its own identity.
