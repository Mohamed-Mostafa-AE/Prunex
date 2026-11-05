# Stockfish 2.0 historical match evidence

This directory preserves the machine-readable summary and source provenance from the 64-game match. The complete PGN, tested executable, source archive, and upstream license files remain in the original GitHub Actions artifact linked below.

## Result

- 64 games: 62 wins, 2 draws, 0 losses.
- 63/64 points: 98.44%.
- 32 games as White and 32 as Black.
- 16 openings, each played four times.
- 100,000 nodes per move, 128 MB hash per engine, one thread per engine, two side-reversed repeats.

## Critical source-lineage qualification

The tested executable labelled “Prunex 0.8.0” was built from official Stockfish 19 source tag `sf_19`, commit `edb0d9db6731067ec50ce619ff372b463bc4dd5d`. The sole recorded source edit changes the UCI engine name. This was **not** the independently implemented native C++20 Prunex engine and does not establish the native engine's Elo or playing strength.

## Primary records

- Original Actions run: https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/41253517143
- Original tournament/build job: https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/41253517143/job/124691757657
- Full PGN and executable artifact (artifact ID 13061744082): https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/41253517143/artifacts/13061744082
- Independent artifact/PGN-summary audit: https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42066798928
- Audit job log: https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42066798928/job/127383005009
- Full methodology and limitations: ../../docs/stockfish-2-comparison.md

## Recount and limitations

The retained PGN was independently recounted from its game headers: 64 rounds, the stated results and color balance, 16 openings with four games each, 62 checkmates and two threefold repetitions. The original match harness also validates legal moves as they are applied. The separate artifact checker validates PGN headers, result totals, opening/color balance, summary agreement, and SHA-256 checksums; it does not replay every SAN move. The artifact does not record the Stockfish 2.0 binary hash or resolved commit SHA, so those are not claimed here.

The 1,000,000-node 63–1–0 result is not included: it has no corresponding raw PGN/JSONL artifact and is not independently audited.
