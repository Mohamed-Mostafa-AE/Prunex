# Stockfish 2.0 match analysis

## Summary

Prunex 0.6.0 (Stockfish 4-derived) scored **18 wins, 30 draws, 16 losses** (33/64 points, 51.56%) in the 64-game equal-node baseline against official Stockfish 2.0. Each engine received 10,000 nodes per move and 64 MB hash; 16 openings were repeated with colors reversed.

| Prunex color | Wins | Draws | Losses | Points |
|---|---:|---:|---:|---:|
| White | 13 | 12 | 7 | 19/32 (59.38%) |
| Black | 5 | 18 | 9 | 14/32 (43.75%) |

A second 64-game test at 100,000 nodes per move and 128 MB hash scored 16 wins, 28 draws, and 20 losses (46.88%). The higher budget did not improve the full match; the Black-side weakness persisted.

## The original 0.6.0 loss to Stockfish 1.3.1

Round 32, Slav Defense, Prunex Black, was the only loss in the separate 64-game Stockfish 1.3.1 match (59W/4D/1L). The crucial transition was:

`47. Ke4 Qxf5+ 48. Kxf5 a5?!`

The sampled Stockfish 4 and Stockfish 2.0 analysis preferred `48...h4!`. Prunex instead played `48...a5?`, making a queenside pawn push while White's king was centralized. White then won the king-and-pawn race; the passed f-pawn became decisive. The game ended:

`76. f7 Kc6 77. f8=Q Kb5 78. Kf6 Kc4 79. Ke5 Kc3 80. Qc5+ Kd2 81. Ke4 Ke2 82. Qc2+ Ke1 83. Ke3 Kf1 84. Qf2#`

This is a practical endgame failure, not a one-move forced mate.

## Four draws in that original Stockfish 1.3.1 match

All four were threefold repetitions:

- **Round 2, Ruy Lopez, Prunex Black:** after an active middlegame, repeated queen checks (`...Qd2+`, `...Qe1+`, `...Qd1+`) recycled the position instead of seeking a new plan.
- **Round 9, Scotch Game, Prunex White:** a queen/rook cycle repeated at `26...Qc3 27.Rc1 Qf6 28.Rd1 Qc3 29.Rc1 Qf6`.
- **Round 54, Scandinavian, Prunex Black:** rook shuffling in a rook ending repeated the same defensive position.
- **Round 62, Grünfeld, Prunex Black:** a late rook/king ending repeated lateral rook moves; Prunex made no safe progress.

The PGN proves the repetitions, not that a forced win existed in any of the four drawn positions.

## Draws against Stockfish 2.0

In the 10k-node baseline there were 30 draws: 23 threefold repetitions, 3 insufficient-material draws, and 4 games that reached the benchmark's 240-ply safety cap. Sixteen of the 23 repetitions occurred with Prunex Black.

The 100k-node match had 28 draws: 18 repetitions, 3 fifty-move-rule draws, 3 insufficient-material draws, and 4 240-ply caps. These are distinct types of outcome: repetition loops show poor progress/draw conversion, while insufficient material is a genuine material draw. A 240-ply cap is a benchmark stopping condition, not a formal chess draw claim.

## Why the losses clustered

The 10k-node 64-game Stockfish 2.0 match had 16 checkmate losses, spread across several openings, with a color imbalance: 9 losses as Black and 7 as White. The recurring themes in sampled 50k-node reviews were:

1. Middlegame tactical choices that traded active pieces or allowed opponent initiative.
2. Incorrect king routes and pawn-race calculation in simplified endings.
3. Passive Black-side defence, often ending in repetition or mate instead of creating counterplay.

Sampled alternatives included `21...Kg7` rather than `21...Qf4` in the Scotch (round 10), `...Be6` rather than `...Bxe2` in the Sicilian (round 16), `...Nf6` rather than `...Nxf4` in the Caro-Kann (round 22), and `...Qd6` rather than `...dxc4` in the Nimzo-Indian (round 34). These are finite-depth candidate improvements, not proofs that each move alone decided its game.

## Later candidates and benchmark controls

- **Prunex 0.7.0** is Stockfish 11-derived. Its first 16-game 100k test scored 11W/4D/1L, but the harness had not applied a neutral contempt setting: it checked the legacy option `Contempt Factor`, while Stockfish 11 exposes `Contempt`. Treat the first result as a default-contempt trial, not a neutral-contempt comparison.
- **Prunex 0.8.0** is Stockfish 19-derived. In its first qualification against official Stockfish 2.0, it scored **16 wins, 0 draws, 0 losses** over 16 games (8 openings, colors balanced), with both engines set to 100,000 nodes/move and 128 MB hash, and Prunex contempt 0. The 64-game confirmation is tracked separately; do not claim a 64-game perfect score until its full PGN/summary confirms it.

All 0.6.0, 0.7.0, and 0.8.0 results are from Stockfish-derived builds, not evidence that the independent Prunex 0.5.x engine itself achieved those strengths. Each derived version should be credited, and GPLv3/source provenance retained.
