# Prunex 0.8.0 — LinkedIn announcement

## Post copy

I’m sharing **Prunex 0.8.0**, a C++20 chess-engine project I’ve been building.

The native engine implements its own board representation, legal move generation, iterative-deepening alpha–beta search, position evaluation, and UCI interface. The project also includes a Windows desktop application and a separate browser experience for playing and reviewing games.

The 46-case regression suite passes on GCC, Clang, AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64. The Windows GUI smoke test also completes a legal move, engine reply, paired undo, search cancellation, board flip, and clean shutdown. Browser tests, WebAssembly parity, and both CodeQL analyses pass as well.

I’m continuing to improve search and evaluation, with an emphasis on reproducible testing and measurable progress.

**Project and source:** https://github.com/Mohamed-Mostafa-AE/Prunex

**Validation evidence:** [Native tests and sanitizers](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005141) · [Windows build and GUI test](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005114) · [Windows binary artifact](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005114/artifacts/13520266801) · [Website and Playwright](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005146) · [WebAssembly parity](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005158) · [CodeQL](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42251005205)

#Cplusplus #ChessProgramming #SoftwareEngineering #SystemsProgramming

## Image notes

The two supplied 1200 × 675 images are captures from the latest responsive website review: one shows the Prunex website overview and the other shows the browser chess experience. They are product visuals, not benchmark results or screenshots of the native Windows application.
