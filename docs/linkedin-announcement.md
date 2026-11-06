# Prunex 0.8.0 — LinkedIn announcement

## Post

I’m sharing **Prunex 0.8.0**, a C++20 chess-engine project I’ve been building.

The native engine implements its own board representation, legal move generation, iterative-deepening alpha–beta search, position evaluation, and UCI interface. The project also includes a Windows desktop application and a separate browser experience for playing and reviewing games.

The 46-case native regression suite passes on GCC, Clang, AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64. The Windows workflow also exercises move input, an engine reply, undo, search cancellation, board flip, and clean shutdown. Browser tests, WebAssembly parity, and CodeQL checks pass on the current release-candidate commit.

**Project and source:** https://github.com/Mohamed-Mostafa-AE/Prunex

**Validation evidence:** [Native and sanitizer matrix](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273408910) · [Windows x64](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273409049) · [Website and browser tests](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273408962) · [WebAssembly parity](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273408989) · [CodeQL](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42273409011)

#Cplusplus #ChessProgramming #SoftwareEngineering

## Image guidance

Use the two 1200 × 675 product captures prepared with the announcement: the website overview and the native-engine architecture section. They show the interface and documented architecture; they are not benchmark results or screenshots of the native Windows application.
