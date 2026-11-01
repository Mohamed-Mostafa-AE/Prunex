# Stockfish 2.0 benchmark post-mortem

## Baseline result

The reference benchmark is run against the official Stockfish `sf_2.0` source tag. Both executables are built from source with GCC for x86-64. Conditions for the current 64-game baseline:

- One thread per engine
- 64 MB transposition table per engine
- 10,000 nodes per move
- 16 openings, two repetitions, colors alternated
- No opening book; Stockfish 2.0's minimum-think setting set to zero where supported

**Baseline score:** 18 wins, 30 draws, 16 losses (33/64 points, 51.56%).

By color:
- Prunex White: 13 wins, 12 draws, 7 losses (19/32 points; 59.38%)
- Prunex Black: 5 wins, 18 draws, 9 losses (14/32 points; 43.75%)

This is a matched-node benchmark, not an Elo rating or a claim of a perfect score.

## Why the games were drawn

The 30 drawn games break down as follows:

- 23 threefold repetitions
- 3 insufficient-material endings
- 4 games reaching the benchmark's 240-ply cap

Most of the repetition draws are perpetual-check loops, especially with Prunex playing Black. Representative examples include:

- Ruy Lopez, rounds 2 and 4: repeated knight checks and queen checks.
- French Defense, rounds 18 and 20: Black's queen cycles between a1/a2 with repeated checks.
- English Opening, round 42: repeated rook checks.
- Grünfeld, rounds 62 and 64: repeated queen-check cycles.

A positive contempt setting may help Prunex avoid some repetitions, but it cannot turn a genuinely forced draw or an insufficient-material ending into a win. It can also turn safe draws into losses, so it must be evaluated in matches rather than assumed to help.

## Loss distribution

The 16 losses occurred in rounds:
`10, 12, 14, 16, 22, 34, 37, 38, 41, 43, 49, 52, 57, 60, 61, 63`.

Nine of those losses were with Prunex Black and seven with Prunex White. Several losses came from tactical or strategic middlegame decisions, then converted into a lost pawn/rook endgame or checkmate.

## Sample move-level review

These are independent 100,000-node searches from selected PGN positions, using both Stockfish 2.0 and the Stockfish 4-derived Prunex core as references. They are diagnostic screens, not a complete proof that every alternative wins; the isolated FEN searches do not carry the entire game history.

- **Round 10, Scotch, Black, before 13...Bd7:** both reference engines selected `...Be6` instead of the played `...Bd7`. Later, before 21...Qf4, Stockfish 4 preferred `...Qd6` and Stockfish 2.0 preferred `...Kg7`. The played queen sortie `...Qf4` was an important further loss of coordination.
- **Round 12, Scotch, Black, before 21...Be7:** both reference engines selected `...Qg5`. The played `...Be7` allowed White's queen and passed pawn to remain very active.
- **Round 22, Caro-Kann, Black, before 17...Nxf4:** both reference engines selected `...Nf6` rather than the played knight capture. The capture opens lines around Black's king and enables White's direct attack.
- **Round 34, Nimzo-Indian, Black, before 21...Rbd8:** the Stockfish 4 reference accepted the played rook move; Stockfish 2.0 preferred `...Re8`. This is a smaller disagreement than the tactical errors above.
- **Round 37, King's Indian, White:** the opening choices `1.d4` and `9.h3` were slightly less preferred in the reference searches than `1.e4` and a developing bishop move. These are not, by themselves, the decisive blunders.

The complete PGN and engine-analysis logs are more useful than isolated centipawn values; scores from different root colors/depths must not be compared as if they were a calibrated probability of winning.

## Next improvement sequence

1. Compare deeper node budgets and several contempt settings under the same Stockfish 2.0 test harness.
2. Prioritize Black-side opening stability and king safety in the Scotch, Sicilian, Caro-Kann, and Nimzo-Indian games.
3. Add the identified tactical positions as regression cases.
4. Re-run the 64-game benchmark at the selected settings and publish the PGN and JSON summary.

The current engine is a Stockfish 4-derived GPLv3 release, not the independent Prunex 0.5.x search implementation. All public descriptions should retain that distinction.


## Prunex 0.8.0 full confirmation (2026-10-31)

The completed 64-game confirmation artifact is available from [GitHub Actions run 41253517143](https://github.com/Mohamed-Mostafa-GT/Prunex/actions/runs/41253517143). Its JSON summary and complete PGN were downloaded and inspected.

- **Result:** 62 wins, 2 draws, 0 losses (63/64 points; 98.44%).
- **Engines:** Prunex 0.8.0 derived from official Stockfish 19 (tag `sf_19`); opponent compiled from official Stockfish 2.0 (tag `sf_2.0`).
- **Conditions:** 100,000 nodes per move, 128 MB hash each, one thread, 16 openings, two repetitions, 32 games per color, no opening book.
- **Draws:** round 36, Nimzo-Indian Defense, and round 62, Grünfeld Defense. Both were recorded as threefold repetitions with Prunex Black. No losses occurred.
- **Interpretation:** the 64-game result is a 98.44% score, not a perfect score. It is a benchmark of a Stockfish 19-derived GPLv3 engine against Stockfish 2.0, not evidence that the independent Prunex 0.5.x engine independently achieved this strength.

The next experiment should investigate draw avoidance with controlled, documented changes and rerun the same color-balanced opening suite. Do not modify or suppress repetition adjudication to manufacture wins; report draws faithfully.
