# Syzygy endgame probing

Build the native UCI executable with the probe enabled.

```sh
cmake -S . -B build -DPRUNEX_ENABLE_SYZYGY=ON
cmake --build build --config Release
```

In the chess GUI, set the engine's `SyzygyPath` option to a folder with the `.rtbw` and `.rtbz` files. From a UCI terminal, the equivalent command is `setoption name SyzygyPath value /path/to/tables`. The engine reports the largest piece count found. Use `setoption name SyzygyPath value <empty>` to disable probing.

At the root, a successful probe chooses a legal move that preserves the outcome given by the tables. The probe uses the position's half-move clock and en passant square. Prunex searches normally when a table is missing, castling remains available, or the GUI requests infinite analysis.

[Syzygy tablebase files](https://tablebase.lichess.ovh/tables/standard/) · [Fathom upstream source](https://github.com/jdart1/Fathom/tree/c9c6fef0dddc05d2e242c183acf5833149ab676d)
