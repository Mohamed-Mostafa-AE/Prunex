# License scope

The root [MIT License](LICENSE) applies to original Prunex contributions in this repository unless a file, directory, or bundled component is explicitly identified as having a separate license or notice.

This includes the original native C++20 engine, the Windows interface, the WebAssembly wrapper, the browser application's original code, project documentation, build files, and native regression tests.

The following items keep their own terms and are not relicensed by the root MIT notice:

- `tools/training/**` is licensed under GPL-3.0-or-later, as stated in `tools/training/LICENSE`.
- Cburnett chess-piece artwork is licensed under GPL-2.0-or-later and retains its attribution and license files.
- Third-party libraries, fonts, and other assets remain subject to their respective licenses.
- PGN corpora and other datasets retain the terms recorded in their source archives and provenance manifests.

### Stockfish 11 piece-square tables

The adapted tables in [third_party/stockfish11](third_party/stockfish11) retain their upstream copyright notices and GPL-3.0-or-later license. Builds made with `PRUNEX_STOCKFISH11_PSQT=ON` combine this work with Prunex and are distributed under GPL-3.0-or-later. The original Prunex files retain their MIT notices. Keep the corresponding source and both applicable license notices with distributions of the combined build.

The MIT License does not grant rights to the Prunex name, logo, or other trademarks. Refer to the individual notices alongside any separately licensed material before redistributing it.
