# Prunex 0.8.0 — LinkedIn announcement

## Post copy

I’m sharing **Prunex 0.8.0**, an independently developed chess engine written in C++20.

The native engine has its own board representation, legal move generation, iterative-deepening alpha–beta search, position evaluation, and UCI interface. The project also includes a Windows desktop application, a regression suite, and a separate browser experience for playing and reviewing games.

The current native regression suite passes **46/46 tests** across GCC, Clang, AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64 CI. The Windows runner also exercises a legal move, engine reply, paired undo, search cancellation, and clean shutdown.

There’s more work ahead on evaluation and measured playing strength, but I’m pleased with the progress from the engine core to a tested, usable project.

**Source code:** https://github.com/Mohamed-Mostafa-AE/Prunex

**Validation:** [Native test matrix](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42232100427) · [Windows desktop and 46-test run](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42232100449) · [Website and browser tests](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42232100315) · [CodeQL](https://github.com/Mohamed-Mostafa-AE/Prunex/actions/runs/42232100376)

#Cplusplus #ChessProgramming #SoftwareEngineering #SystemsProgramming

## Photo notes

The two supplied screenshots are captures from the live Prunex website. The board shown is the browser experience, not the native Windows desktop application. Use them as product images, not as benchmark or desktop-test evidence.
