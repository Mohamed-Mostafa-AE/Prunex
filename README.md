# Prunex 0.8.0

Prunex is a chess-engine project with two distinct code lines: the independently authored C++ 0.5.x engine, and the stronger GPLv3 Stockfish-derived 0.6–0.8 release line. The two must not be conflated.

## Current benchmark candidate: Prunex 0.8.0

Prunex 0.8.0 is derived from the official [Stockfish](https://github.com/official-stockfish/Stockfish) source tag `sf_19`. The sole source modification in this candidate changes the UCI engine display name to identify the Prunex build. Search, evaluation, and NNUE implementation remain Stockfish 19's. This is a transparent, GPLv3-compliant derivative, not a claim that the 0.5.x search core has reached Stockfish 19 strength.

**64-game confirmation against official Stockfish 2.0: 62 wins, 2 draws, 0 losses (98.44%)**. Both engines were built from official source tags and received 100,000 nodes per move and 128 MB hash; 16 openings were played twice with colors balanced (32 games per color). Both draws were threefold repetitions with Prunex playing Black (Nimzo-Indian, round 36; Grünfeld, round 62). The full PGN, JSON summary, executable, source archive, provenance, and licenses are preserved in [GitHub Actions artifact](https://github.com/Mohamed-Mostafa-GT/Prunex/actions/runs/41253517143). This is a strong result but not a perfect score. See [the benchmark report](docs/stockfish-2.0-benchmark.md) for the methodology and historical rating context.

## Earlier Stockfish-derived lines

- **0.7.0:** derived from official Stockfish 11.
- **0.6.0:** derived from official Stockfish 4. Its 64-game match against official Stockfish 1.3.1 scored 59 wins, 4 draws, 1 loss (95.31%) at 10,000 nodes per move, but against Stockfish 2.0 it scored only 18 wins, 30 draws, 16 losses (51.56%) in the 10,000-node 64-game baseline. A 100,000-node test scored 16 wins, 28 draws, 20 losses (46.88%). The weaker Black-side performance and repetition cycles are documented in [the analysis report](docs/stockfish-2.0-analysis.md).

## Independent Prunex 0.5.x engine

The earlier 0.5.x engine remains the independent Prunex C++ search-core line. It uses a custom C++20 search/evaluation implementation. Its 44-test regression suite covers perft, FEN validation, en-passant legality, terminal positions, quiet check evasions, mate-in-one selection, make/undo hash restoration, transposition-table reuse, and UCI move-time/clock search.

The 0.5.1 engine did not beat Stockfish 4 or Stockfish 6 in the recorded fixed-move-time test (0/64 against each). See `TEST_REPORT.md` for the details. The existence of the 0.8.0 derivative should not be represented as evidence that the independent 0.5.x engine has independently achieved this strength.

## Play in the browser

**Live website:** https://prunex-play.vercel.app/

The Vercel site is in `website/`. It contains a compact legal-move chessboard, engine play, move history, undo, board flip, and strength selection. Its browser opponent is Stockfish.js 19 lite single-threaded WebAssembly running locally in a Web Worker. The web engine is an upstream Stockfish component and is not the independently authored Prunex 0.5.x engine. The footer documents the browser stack, benchmark lineage, methodology, attribution, and contact links. The site CI builds and exercises a legal opening move and engine reply in Chromium.

For local development:

```bash
cd website
npm install
npm run dev
```

For Vercel, set the project root directory to `website`, framework to Vite, build command to `npm run build`, and output directory to `dist`. The website CI validates the production build in Chromium, makes a legal opening move, checks that the engine replies, and uploads a verified static artifact.

## Source and licensing

Stockfish-derived release lines and the browser Stockfish.js component are GPLv3-licensed. Their upstream source, provenance, and license are provided with their corresponding release/website artifacts. Preserve the upstream copyright and GPLv3 notices in all redistributions.
