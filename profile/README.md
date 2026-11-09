<!--
Prunex profile project presentation.
Keep this README focused on the native engine and link to the repository for implementation details.
-->

<div align="center">
  <img src="https://raw.githubusercontent.com/Mohamed-Mostafa-AE/Prunex/main/website/public/prunex-mark.png" alt="Prunex mark" width="112" />
  <h1>Mohamed Mostafa</h1>
  <p><strong>Student Developer · C++ · Chess-Engine Engineering · Aerospace Engineering</strong></p>
  <p>
    <a href="https://github.com/Mohamed-Mostafa-AE/Prunex">Prunex</a> ·
    <a href="https://prunex-play.vercel.app/">Prunex Play</a>
  </p>
</div>

---

I build software projects that combine algorithmic problem-solving with practical engineering. My current focus is chess-engine development, C++ systems, search algorithms, and the intersection of computation and engineering.

## Featured project

### [Prunex](https://github.com/Mohamed-Mostafa-AE/Prunex)

An independently developed chess-engine project with a native C++20 engine, a Windows desktop interface, and a separate browser chess experience.

**Native engine**
- 0x88 board representation and legal move generation
- Zobrist hashing and a transposition table
- Iterative-deepening negamax alpha–beta / PVS search
- Aspiration windows, move ordering, late-move reductions, quiescence, and verified null-move pruning
- Repetition, fifty-move, and insufficient-material draw handling
- Handcrafted tapered middlegame/endgame evaluation
- Universal Chess Interface (UCI)

**Engineering**
- CMake-based native builds
- Regression tests across GCC, Clang, sanitizers, and Windows x64
- A separate WebAssembly build with native-parity checks
- Offline PGN ingestion, dataset provenance, native evaluation annotation, and held-out calibration diagnostics

The browser experience is a separate application, but its opponent and review worker execute the same Prunex C++20 engine compiled to WebAssembly. The native and browser builds share the engine's handcrafted evaluator.

[Explore the repository →](https://github.com/Mohamed-Mostafa-AE/Prunex)

## Technical interests

- **Languages:** C++, Python, TypeScript, JavaScript
- **Systems & tooling:** CMake, Git, GitHub Actions, WebAssembly
- **Application development:** React, Node.js, Supabase
- **Engineering interests:** search algorithms, computational methods, software architecture, aerospace systems

## Current direction

Improving Prunex's search and evaluation through reproducible benchmarks, stronger regression coverage, and carefully controlled experiments. I am also interested in applying software and computational techniques to aerospace and other engineering problems.

---

<div align="center">
  <sub>Build carefully. Measure honestly. Improve continuously.</sub>
</div>
