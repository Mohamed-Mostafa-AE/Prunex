# Prunex 0.8.0 — LinkedIn announcement

## Post copy

I’m sharing **Prunex 0.8.0**, an independently developed chess engine written in C++20.

The native engine has its own board representation, legal move generation, iterative-deepening alpha–beta search, position evaluation, and UCI interface. The project also includes a Windows desktop application, a regression suite, and a separate browser experience for playing and reviewing games.

The current native regression suite passes **46/46 tests** across GCC, Clang, AddressSanitizer/UndefinedBehaviorSanitizer, and Windows x64 CI.

There’s more work ahead on evaluation and measured playing strength, but I’m pleased with the progress from the engine core to a tested, usable project.

**Source code and build details:**  
https://github.com/Mohamed-Mostafa-AE/Prunex

**Native test workflow:**  
https://github.com/Mohamed-Mostafa-AE/Prunex/actions

#Cplusplus #ChessProgramming #SoftwareEngineering #SystemsProgramming

## Images

Use the checked-in images under `website/public/social/`:

- `prunex-project-overview.webp` — website and project overview. The visible board belongs to the browser application, not the native desktop engine.
- `prunex-browser-demo.webp` — browser chess interface.

The images are product screenshots. They are not presented as evidence of a tournament score or a native Windows desktop capture.
